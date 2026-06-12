# Elevated Windows Bypass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect elevated (admin) Windows target windows and pass wheel events through without smooth-scroll processing, fixing the broken-scroll bug when SmoothScroll runs non-elevated and targets an elevated IDE.

**Architecture:** Add `is_target_elevated()` to the `ProcessQuery` trait (default `false`, Windows override). The Windows implementation uses `OpenProcessToken` + `GetTokenInformation(TokenIntegrityLevel)` to detect `SECURITY_MANDATORY_HIGH_RID`, cached with the same 100ms HWND-based TTL as the existing process-name cache. `EngineSink::resolve_active()` calls this check and returns `None` for elevated targets, causing `HookDecision::Pass`.

**Tech Stack:** Rust, `windows-sys` (needs new `Win32_Security` feature), `parking_lot::Mutex`, existing TTL caching pattern.

---

## File Map

| File | Role |
|---|---|
| `crates/platform/src/types.rs` | Add `IntegrityLevel` enum |
| `crates/platform/src/traits.rs` | Add `is_target_elevated()` default method to `ProcessQuery` |
| `crates/platform/src/windows/process_query.rs` | Implement `is_target_elevated()` + `IntegrityCache` |
| `crates/platform/Cargo.toml` | Add `Win32_Security` feature to `windows-sys` |
| `src-tauri/src/hook_wiring.rs` | Call `is_target_elevated()` in `resolve_active()` + add unit tests |

---

## Task 1: Add `IntegrityLevel` enum to `types.rs`

**Files:**
- Modify: `crates/platform/src/types.rs`

- [ ] **Step 1: Add enum**

After the `WindowRect` struct, add:

```rust
/// Windows process integrity level, used to detect elevated (admin) apps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntegrityLevel {
    /// Normal integrity — smooth scroll applies.
    Medium,
    /// Elevated (administrator/UAC) integrity — smooth scroll is bypassed
    /// because UIPI blocks synthetic input from reaching these processes.
    High,
    /// Query failed — treat as Medium to avoid silent scroll breaks.
    Unknown,
}
```

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform` — expect: OK.

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/types.rs
git commit -m "feat(platform): add IntegrityLevel enum"
```

---

## Task 2: Add `is_target_elevated()` to `ProcessQuery` trait

**Files:**
- Modify: `crates/platform/src/traits.rs`

- [ ] **Step 1: Add method to trait**

In `traits.rs`, add to the `ProcessQuery` trait (before the closing `}` of the trait):

```rust
    /// Returns true if the window under the cursor belongs to a process
    /// running at High (elevated) integrity level. Used to bypass smooth
    /// scrolling for admin apps that UIPI would otherwise block.
    ///
    /// The default returns `false` (safe — bypass is skipped on macOS and
    /// on non-Windows builds). Windows overrides this in
    /// `WindowsProcessQuery`.
    fn is_target_elevated(&self) -> bool {
        false
    }
```

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform` — expect: OK.

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/traits.rs
git commit -m "feat(platform): add is_target_elevated() to ProcessQuery trait"
```

---

## Task 3: Add `Win32_Security` to `windows-sys` features

**Files:**
- Modify: `crates/platform/Cargo.toml`

- [ ] **Step 1: Add feature**

In the `[target.'cfg(windows)'.dependencies]` section of `crates/platform/Cargo.toml`, add `"Win32_Security"` to the `windows-sys` features list:

```toml
windows-sys = { version = "0.59", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
    "Win32_UI_Input_KeyboardAndMouse",
    "Win32_System_LibraryLoader",
    "Win32_System_Threading",
    "Win32_System_ProcessStatus",
    "Win32_Graphics_Gdi",
    "Win32_System_Registry",
    "Win32_Media",
    "Win32_Security",      # NEW: for TokenIntegrityLevel, OpenProcessToken, GetTokenInformation
] }
```

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform` — expect: OK (may see warnings about unused imports; those are fine — they'll be used in Task 4).

- [ ] **Step 2: Commit**

```bash
git add crates/platform/Cargo.toml
git commit -m "chore(platform): add Win32_Security feature to windows-sys"
```

---

## Task 4: Implement `is_target_elevated()` in `WindowsProcessQuery`

**Files:**
- Modify: `crates/platform/src/windows/process_query.rs`

- [ ] **Step 1: Add imports**

In `process_query.rs`, add to the `use` block at the top:

```rust
use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::Security::{
    GetTokenInformation, OpenProcessToken, TokenIntegrityLevel,
    TOKEN_MANDATORY_LABEL, TOKEN_QUERY,
    SE_GROUP_INTEGRITY, SECURITY_MANDATORY_HIGH_RID,
};
use windows_sys::Win32::System::Threading::OpenProcess;
```

Note: The existing `OpenProcess` import is already there (from `Win32_System_Threading`), so only add the two new import lines.

- [ ] **Step 2: Add `IntegrityCache` struct**

After the existing `CacheEntry` struct (after line 32), add:

```rust
/// Cached integrity level for the current HWND. Uses the same 100ms TTL
/// as CacheEntry so both invalidate together on window change.
#[derive(Default)]
struct IntegrityCache {
    last_check: Option<Instant>,
    last_hwnd: usize,
    cached_level: Option<IntegrityLevel>,
}
```

- [ ] **Step 3: Add `IntegrityCache` field to `WindowsProcessQuery`**

In the struct definition:

```rust
pub struct WindowsProcessQuery {
    cache: Mutex<CacheEntry>,
    integrity_cache: Mutex<IntegrityCache>, // ADD THIS LINE
}
```

- [ ] **Step 4: Initialize the new field in `new()`**

```rust
pub fn new() -> Self {
    Self {
        cache: Mutex::new(CacheEntry::default()),
        integrity_cache: Mutex::new(IntegrityCache::default()), // ADD THIS LINE
    }
}
```

- [ ] **Step 5: Add the raw syscall helper**

After the `process_name_for_pid` function (after line 190), add:

```rust
/// Returns the integrity level of the process with the given PID.
/// Returns `IntegrityLevel::Unknown` on any error (OpenProcess, OpenProcessToken,
/// or GetTokenInformation failure).
fn get_process_integrity_level(pid: u32) -> IntegrityLevel {
    use crate::types::IntegrityLevel;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle == 0 {
            return IntegrityLevel::Unknown;
        }

        let mut token_handle: HANDLE = 0;
        let ok = OpenProcessToken(handle, TOKEN_QUERY, &mut token_handle);
        CloseHandle(handle);
        if ok == 0 {
            return IntegrityLevel::Unknown;
        }

        let mut size: u32 = 0;
        GetTokenInformation(
            token_handle,
            TokenIntegrityLevel,
            std::ptr::null_mut(),
            0,
            &mut size,
        );
        if size == 0 {
            CloseHandle(token_handle);
            return IntegrityLevel::Unknown;
        }

        let mut buffer = vec![0u8; size as usize];
        let ok = GetTokenInformation(
            token_handle,
            TokenIntegrityLevel,
            buffer.as_mut_ptr() as _,
            size,
            &mut size,
        );
        CloseHandle(token_handle);
        if ok == 0 {
            return IntegrityLevel::Unknown;
        }

        let label = &*(buffer.as_ptr() as *const TOKEN_MANDATORY_LABEL);
        let sid = (*label).Sid;
        let attr = (*label).Attributes;
        if (attr & SE_GROUP_INTEGRITY) == 0 {
            return IntegrityLevel::Medium;
        }

        // SECURITY_MANDATORY_HIGH_RID = 0x3000
        let sub_auth = *(sid.add(core::mem::size_of::<u32>()) as *const u32);
        if sub_auth == SECURITY_MANDATORY_HIGH_RID {
            IntegrityLevel::High
        } else {
            IntegrityLevel::Medium
        }
    }
}
```

- [ ] **Step 6: Implement `is_target_elevated()` on `ProcessQuery`**

In the `impl ProcessQuery for WindowsProcessQuery` block (after `list_visible_processes`, before `foreground_process_name`), add:

```rust
fn is_target_elevated(&self) -> bool {
    use crate::types::IntegrityLevel;

    let now = Instant::now();
    let mut cache = self.integrity_cache.lock();

    // Check cache (same TTL as CacheEntry)
    if let Some(t) = cache.last_check {
        if now.saturating_duration_since(t) < TTL {
            return cache.cached_level == Some(IntegrityLevel::High);
        }
    }

    // Get HWND under cursor
    let mut pt = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut pt) } == 0 {
        return false;
    }
    let hwnd = unsafe { WindowFromPoint(pt) };
    if hwnd.is_null() {
        return false;
    }
    let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
    let root_usize = root as usize;

    // Invalidate cache if HWND changed
    if root_usize != cache.last_hwnd {
        cache.last_hwnd = root_usize;
        cache.cached_level = None;
    }

    // If we already cached a non-elevated result for this HWND, reuse it
    if let Some(level) = cache.cached_level {
        cache.last_check = Some(now);
        return level == IntegrityLevel::High;
    }

    // Query integrity level
    let mut pid: u32 = 0;
    unsafe { GetWindowThreadProcessId(root, &mut pid) };
    let level = if pid != 0 {
        get_process_integrity_level(pid)
    } else {
        IntegrityLevel::Unknown
    };

    cache.cached_level = Some(level);
    cache.last_check = Some(now);
    level == IntegrityLevel::High
}
```

Note: This function references `POINT`, `GetAncestor`, `GA_ROOT`, `GetCursorPos`, `WindowFromPoint`, and `GetWindowThreadProcessId` which are already imported in the file.

- [ ] **Step 7: Add `IntegrityLevel` import**

In `process_query.rs`, add to the `use crate::types` import line:

```rust
use crate::types::{IntegrityLevel, ProcessInfo, ProcessQuery};
```

The existing `ProcessInfo` and `ProcessQuery` imports are already there.

- [ ] **Step 8: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll_platform` — expect: OK (no errors).

- [ ] **Step 9: Commit**

```bash
git add crates/platform/src/windows/process_query.rs
git commit -m "feat(windows): implement is_target_elevated() with UAC detection"
```

---

## Task 5: Wire `is_target_elevated()` into `EngineSink::resolve_active()`

**Files:**
- Modify: `src-tauri/src/hook_wiring.rs`

- [ ] **Step 1: Add the integrity gate**

In `resolve_active()` (around line 104), after the existing `let (under_cursor, foreground) = { ... }` block, add the check before the `let start = Instant::now()` line:

```rust
        let (under_cursor, foreground) = {
            let mut cache = self.process_cache.lock();
            cache.get(|| {
                (
                    self.state.processes.process_name_under_cursor(),
                    self.state.processes.foreground_process_name(),
                )
            })
        };

        // NEW: bypass engine for elevated (admin) target windows.
        // UIPI blocks SendInput/PostMessageW from a medium-IL sender to a
        // high-IL target, so swallowing the event would silently lose scroll.
        // Forwarding the raw event preserves native scroll instead.
        #[cfg(windows)]
        if self.state.processes.is_target_elevated() {
            if tracing::enabled!(tracing::Level::DEBUG) {
                tracing::debug!("bypassing engine for elevated target");
            }
            return None;
        }
```

- [ ] **Step 2: Run cargo check**

Run: `cd D:/SmoothScroll && cargo check -p smoothscroll --manifest-path src-tauri/Cargo.toml` — expect: OK.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/hook_wiring.rs
git commit -m "fix(engine): auto-bypass smooth scroll for elevated (admin) targets"
```

---

## Task 6: Add unit tests for the elevated bypass behavior

**Files:**
- Modify: `src-tauri/src/hook_wiring.rs`

- [ ] **Step 1: Create elevated-capable `ProcessQuery` stub**

In the test module, after the existing `StaticProcessQuery` struct definition, add:

```rust
    struct ElevatedStaticProcessQuery {
        under_cursor: Option<String>,
        foreground: Option<String>,
        elevated: bool,
    }
    impl ProcessQuery for ElevatedStaticProcessQuery {
        fn process_name_under_cursor(&self) -> Option<String> {
            self.under_cursor.clone()
        }
        fn foreground_process_id(&self) -> Option<u32> {
            None
        }
        fn list_visible_processes(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
        fn foreground_process_name(&self) -> Option<String> {
            self.foreground.clone()
        }
        fn is_target_elevated(&self) -> bool {
            self.elevated
        }
    }
```

- [ ] **Step 2: Add helper to construct elevated test state**

```rust
    fn make_state_with_elevation(
        settings: AppSettings,
        under_cursor: Option<&str>,
        elevated: bool,
    ) -> Arc<AppState> {
        let eff = EffectiveSettings::from_settings(&settings);
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
            settings: Arc::new(RwLock::new(settings.clone())),
            effective: Arc::new(ArcSwap::from_pointee(eff)),
            effective_per_profile: Arc::new(RwLock::new(HashMap::new())),
            mouse_hook: Arc::new(StubHook),
            emitter: Arc::new(StubEmitter),
            zoom_emitter: Arc::new(StubEmitter),
            processes: Arc::new(ElevatedStaticProcessQuery {
                under_cursor: under_cursor.map(|s| s.to_string()),
                foreground: None,
                elevated,
            }),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            fullscreen_detector: Arc::new(StubFullscreen),
            window_geom: Arc::new(StubWindowGeom),
            last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
            persistor: Arc::new(SettingsPersistor::spawn()),
            reduce_motion: Arc::new(AtomicBool::new(false)),
            accessibility: Arc::new(StubAccessibility),
            rm_watch_handle: Arc::new(parking_lot::Mutex::new(None)),
            last_foreground_at_tray_open: Arc::new(parking_lot::Mutex::new(None)),
        })
    }
```

- [ ] **Step 3: Add test — elevated target passes through**

Add as a new test function after the existing tests:

```rust
    #[test]
    fn elevated_target_passes_through() {
        // When is_target_elevated() returns true, the engine should not
        // process the event — it passes through instead. This prevents
        // scroll from being silently lost when SmoothScroll runs non-elevated
        // and the user scrolls in an elevated (admin) IDE.
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), true);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn non_elevated_target_swallows_normally() {
        // When is_target_elevated() returns false, normal scroll swallowing
        // applies (regression check — behavior must not change for non-elevated).
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), false);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    fn elevated_horizontal_wheel_passes_through() {
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), true);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }
```

- [ ] **Step 4: Run the new tests**

Run: `cd D:/SmoothScroll && cargo test -p smoothscroll --lib -- hook_wiring --nocapture` — expect: 3 PASS (plus all existing tests pass).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/hook_wiring.rs
git commit -m "test(hook_wiring): add elevated bypass unit tests"
```

---

## Task 7: Full regression test

**Files:** (none — verification only)

- [ ] **Step 1: Run all tests**

Run: `cd D:/SmoothScroll && cargo test -p smoothscroll_platform -p smoothscroll --lib` — expect: all pass.

- [ ] **Step 2: Build the WASM engine**

Run: `cd D:/SmoothScroll && npm run build:wasm` — expect: success (generates `src/lib/engine-wasm/`).

- [ ] **Step 3: Build release exe**

Run: `cd D:/SmoothScroll/src-tauri && npx tauri build` — expect: compilation succeeds, exe at `src-tauri/target/release/bundle/nsis/SmoothScroll_<version>_x64-setup.exe`.

---

## Self-Review Checklist

- [ ] Spec coverage: Every section in the design spec has a corresponding task? **Yes** — UIPI root cause (covered by Tasks 4+5), integrity check (Task 4), cache (Task 4), trait extension (Task 2), type definition (Task 1), `resolve_active()` gate (Task 5), tests (Task 6), verification (Task 7).
- [ ] No placeholders: No "TODO", "TBD", "fill in later" anywhere.
- [ ] Type consistency: `IntegrityLevel` enum defined in `types.rs`, imported in `process_query.rs`, referenced by name throughout Tasks 1+4. `is_target_elevated()` matches the trait method name in Task 2.
- [ ] All new Win32 APIs covered: `OpenProcessToken` (in `Win32_Security`), `GetTokenInformation` (in `Win32_Security`), `TokenIntegrityLevel` constant, `TOKEN_QUERY` constant, `TOKEN_MANDATORY_LABEL` struct, `SE_GROUP_INTEGRITY` attribute, `SECURITY_MANDATORY_HIGH_RID` constant — all covered in Task 3 + 4.
- [ ] No cross-task interference: each task builds on the previous one's commit, so bisect is clean.
