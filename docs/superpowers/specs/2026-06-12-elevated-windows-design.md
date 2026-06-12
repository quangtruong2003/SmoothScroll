# Design: Auto-Bypass Elevated (Admin) Windows on Windows

**Status:** Draft
**Date:** 2026-06-12
**Authors:** CLAUDE

## Problem

When SmoothScroll runs at normal (medium) integrity level and the user opens an IDE or other application with administrator privileges (high integrity level), scrolling breaks completely:

1. SmoothScroll's `WH_MOUSE_LL` hook successfully captures wheel events (journal hooks bypass UIPI).
2. The engine swallows the raw event and emits smoothed pulses via `SendInput` / `PostMessageW`.
3. **UIPI (User Interface Privilege Isolation)** blocks `SendInput` and `PostMessageW` from delivering events to a higher-integrity process. The return value may be misleadingly success-like, and the event is silently lost.
4. The scroll never reaches the elevated app.

The same problem does **not** occur when SmoothScroll itself runs elevated — in that case UIPI allows cross-IL input because the sender is equal or higher.

## Goals

1. **Zero regressions** — apps at normal integrity level behave exactly as before.
2. **Automatic detection** — no user configuration required.
3. **Minimal overhead** — integrity level check must not add measurable latency to the scroll hot path.
4. **Preserve user intent** — smooth scrolling is bypassed *only* for elevated targets; non-admin apps still get smooth scroll.

## Solution: Integrity-Level Gate in `EngineSink`

The fix lives entirely in the Windows code path. The design adds an integrity-level check to `EngineSink::resolve_active()` — when the target window belongs to a high-integrity process, it returns `None`, which causes `route_vertical_with_source` / `route_horizontal_with_source` to emit `HookDecision::Pass`.

### Architecture

```
wheel event fires
    │
    ▼
low_level_proc (mouse_hook.rs)
    │
    ▼
EngineSink::on_wheel_ext
    │
    ▼
resolve_active()              ← NEW: integrity gate here
    ├── process_name_under_cursor()
    │       └── (existing cache, 50ms TTL)
    ├── foreground_process_name()
    │       └── (existing cache, 50ms TTL)
    └── is_target_elevated()  ← NEW: integrity check
            │
            ├─ High Integrity → return None (bypass engine)
            └─ Medium/Low     → return Some(settings) (normal path)
    │
    ▼
route_vertical_with_source
    ├─ Some(settings) → HookDecision::Swallow (engine processes)
    └─ None           → HookDecision::Pass   (raw event forwarded)
```

### New Component: `IntegrityLevelCache`

A `parking_lot::Mutex`-protected cache stored inside `WindowsProcessQuery` (since it already holds a `CacheEntry` struct with TTL-based caching). The cache maps `(HWND → IntegrityLevel)` and uses the same 100ms TTL as process-name resolution.

```rust
#[derive(Default)]
struct IntegrityCache {
    last_check: Option<Instant>,
    last_hwnd: usize,
    cached_level: Option<IntegrityLevel>,
}

enum IntegrityLevel {
    High,     // Elevated (Admin/UAC)
    Medium,   // Normal
    Unknown,  // Query failed
}
```

### New Trait Method: `ProcessQuery::is_process_elevated`

```rust
pub trait ProcessQuery: Send + Sync {
    fn process_name_under_cursor(&self) -> Option<String>;
    fn foreground_process_id(&self) -> Option<u32>;
    fn list_visible_processes(&self) -> Vec<ProcessInfo>;
    fn foreground_process_name(&self) -> Option<String>;

    /// Returns true if the process under the cursor runs at High (elevated)
    /// integrity level. Uses a TTL cache keyed on HWND.
    fn is_target_elevated(&self) -> bool { false } // default: no-op (macOS)
}
```

Windows implementation (in `process_query.rs`):

```rust
fn get_process_integrity_level(pid: u32) -> IntegrityLevel {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if handle.is_null() { return IntegrityLevel::Unknown; }

        // GetTokenInformation with TokenIntegrityLevel
        let mut token_handle: windows_sys::Win32::Foundation::HANDLE = 0;
        let ok = OpenProcessToken(handle, TOKEN_QUERY, &mut token_handle);
        CloseHandle(handle);
        if ok == 0 { return IntegrityLevel::Unknown; }

        let mut size: u32 = 0;
        GetTokenInformation(
            token_handle,
            TokenIntegrityLevel,
            std::ptr::null_mut(),
            0,
            &mut size,
        );
        if size == 0 { CloseHandle(token_handle); return IntegrityLevel::Unknown; }

        let mut buffer = vec![0u8; size as usize];
        let ok = GetTokenInformation(
            token_handle,
            TokenIntegrityLevel,
            buffer.as_mut_ptr() as _,
            size,
            &mut size,
        );
        CloseHandle(token_handle);
        if ok == 0 { return IntegrityLevel::Unknown; }

        let label = &*(buffer.as_ptr() as *const TOKEN_MANDATORY_LABEL);
        let sid = (*label).Sid;
        let attr = (*label).Attributes;
        if (attr & SE_GROUP_INTEGRITY) == 0 { return IntegrityLevel::Medium; }

        let sub_auth = *(sid.add(4) as *const u32); // OFFSET_TO_SID_SUB_AUTHORITY
        if sub_auth == SECURITY_MANDATORY_HIGH_RID {
            IntegrityLevel::High
        } else {
            IntegrityLevel::Medium
        }
    }
}
```

### `resolve_active()` modification

In `hook_wiring.rs`, add an early exit:

```rust
fn resolve_active(&self) -> Option<Arc<EffectiveSettings>> {
    // ... existing process-name cache logic ...

    let (under_cursor, foreground) = { /* existing fetch */ };

    // NEW: bypass engine for elevated targets
    #[cfg(windows)]
    {
        if self.state.processes.is_target_elevated() {
            return None; // → HookDecision::Pass
        }
    }

    // ... rest of existing logic ...
}
```

### Performance

| Operation | Cost |
|---|---|
| Integrity check (cache hit) | 0 syscall, ~10ns |
| Integrity check (cache miss) | 1 `OpenProcess` + 1 `OpenProcessToken` + 1 `GetTokenInformation` + 2 `CloseHandle` ≈ 5-20 µs |
| Cache TTL | 100ms, keyed on HWND (same as process-name cache) |
| Cache invalidation | On HWND change (same as process-name) |

The 5-20 µs cost only occurs once per new window under cursor (within 100ms throttle), not per wheel event. This is well within acceptable latency.

### macOS

macOS does not have an equivalent to UIPI. The new method has a no-op default in the trait (`false`). No macOS implementation needed.

## Files Changed

| File | Change |
|---|---|
| `crates/platform/src/traits.rs` | Add `is_target_elevated()` default method |
| `crates/platform/src/types.rs` | Add `IntegrityLevel` enum |
| `crates/platform/src/windows/process_query.rs` | Implement `is_target_elevated()` + `IntegrityCache` |
| `crates/platform/src/windows/mod.rs` | Re-export `IntegrityLevel` if needed |
| `src-tauri/src/hook_wiring.rs` | Call `is_target_elevated()` in `resolve_active()` |

## Verification Plan

1. **Unit test** — mock `is_target_elevated()` returning `true`; verify `on_wheel()` returns `HookDecision::Pass`.
2. **Unit test** — mock `is_target_elevated()` returning `false`; verify `on_wheel()` returns `HookDecision::Swallow`.
3. **Manual test (requires elevated app)** — open VS Code as Admin, scroll; should scroll natively without smooth scroll.
4. **Manual test (normal)** — open VS Code normally, scroll; should smooth scroll as before.
5. **Regression** — verify all existing tests pass.

## Open Questions

1. **Should we log when bypassing elevated targets?** A `tracing::debug` entry helps users understand why smooth scroll isn't applied. Recommended: yes, at debug level.
2. **Should we expose elevated-target detection in the UI?** A status indicator in the tray panel or settings page showing "Smooth scroll paused for elevated app (VS Code Admin)" would improve UX. Out of scope for initial fix; can be added later.
3. **What about elevated apps that SmoothScroll itself is injecting into non-elevated targets?** Not possible via UIPI (only blocks higher IL, not lower), so no action needed.
