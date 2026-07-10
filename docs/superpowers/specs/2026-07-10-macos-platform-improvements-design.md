# macOS Platform Improvements — 2026-07-10

## Status

**Spec draft** — pending user review before implementation.

---

## Context

The macOS platform implementation in `crates/platform/src/macos/` is functional for core smooth scroll (intercept → emit), but has several gaps compared to the Linux implementation and uses a deprecated Carbon API for hotkeys.

**Goal**: Achieve Linux parity for core functionality, eliminate deprecated dependencies, and ensure the macOS build is production-ready.

---

## Current State Assessment

### ✅ Working (Production Ready)

| Component | File | Status |
|-----------|------|--------|
| Scroll Interception | `event_tap.rs` | CGEventTap on kCGHIDEventTap — solid |
| Scroll Emission | `wheel_emitter.rs` | CGEventPost with IsContinuous=1 — correct |
| Accessibility Signals | `accessibility.rs` | Reduce Motion polling via objc2 — working |
| Autostart | `autostart.rs` | LaunchAgent with gui/<uid> domain — complete |
| Permissions | `permissions.rs` | AXIsProcessTrustedWithOptions — working |
| Foreground Process Name | `process_query.rs` | NSWorkspace.frontmostApplication — working |

### ⚠️ Partial / Stubbed

| Component | File | Current State | Impact |
|-----------|------|---------------|--------|
| Hotkey | `hotkey.rs` | Carbon RegisterEventHotKey — deprecated API, only ~20 keys supported, single hotkey only | HIGH — limits user customization |
| Foreground Process ID | `process_query.rs` | Returns `None` — should return `frontmostApplication.processIdentifier` | MEDIUM — affects per-app settings by PID |
| Process Name Under Cursor | `process_query.rs` | Returns `None` — macOS doesn't expose cursor window via public API | LOW — rarely used |
| Display Refresh Rate | `display.rs` | Hardcoded to 60Hz | LOW — engine has fallbacks |

### ❌ Not Implemented

| Component | File | Status | Impact |
|-----------|------|--------|--------|
| Fullscreen Detection | `fullscreen.rs` | Always returns `false` | LOW — depends on engine usage |
| Window Geometry | `window_geom.rs` | Fully stubbed | LOW — advanced features only |
| Monitor Enumeration | `window_geom.rs` | Returns empty `Vec` | LOW — advanced features only |

---

## Scope: Phase 1 (Core First)

This spec covers **Phase 1 only** — the minimum set of improvements needed for a production macOS release:

1. **Hotkey improvements** — replace Carbon with CGEventTap
2. **foreground_process_id()** — implement the stub
3. **Display refresh rate** — dynamic detection from NSScreen

**Out of scope for Phase 1**: window_geom, fullscreen detection, process_name_under_cursor, list_visible_processes.

---

## 1. Hotkey: Migrate from Carbon to CGEventTap

### Problem

The current `hotkey.rs` uses `RegisterEventHotKey` from the Carbon framework, which is deprecated since macOS 10.8 and may be removed in future macOS versions. Additionally:

- Only ~20 ASCII keys mapped (missing: arrows, F1-F12, Escape, numpad, etc.)
- Only **one hotkey** can be registered at a time (`static mut CALLBACK`)
- Carbon API requires manual memory management

### Solution: Extend CGEventTap

The project already has a CGEventTap infrastructure in `event_tap.rs` for scroll interception. We can extend it to also intercept keyboard events (`kCGEventKeyDown = 10`).

**Architecture**:
- Modify `event_tap.rs` to intercept BOTH `kCGEventScrollWheel` (22) AND `kCGEventKeyDown` (10)
- Create a new `hotkey.rs` that registers key callbacks to a shared registry
- Use `CGEventGetIntegerValueField` with field `7` (keycode) to get the key
- Remove Carbon dependency entirely

### Keycode Mapping

macOS virtual keycodes are stable. Map common accelerator keys:

```rust
// From Apple HIDDriverKeys.h
const KEYCODE_ESCAPE: u16 = 53;
const KEYCODE_F1: u16 = 122;
const KEYCODE_F2: u16 = 120;
const KEYCODE_F3: u16 = 99;
const KEYCODE_F4: u16 = 118;
const KEYCODE_F5: u16 = 96;
const KEYCODE_F6: u16 = 97;
const KEYCODE_F7: u16 = 98;
const KEYCODE_F8: u16 = 101;
const KEYCODE_F9: u16 = 109;
const KEYCODE_F10: u16 = 103;
const KEYCODE_F11: u16 = 111;
const KEYCODE_F12: u16 = 118;
const KEYCODE_UP: u16 = 126;
const KEYCODE_DOWN: u16 = 125;
const KEYCODE_LEFT: u16 = 123;
const KEYCODE_RIGHT: u16 = 124;
const KEYCODE_SPACE: u16 = 49;
const KEYCODE_RETURN: u16 = 36;
```

### Modifier Mapping

```rust
const MOD_SHIFT: u32 = 0x0200;      // CGEventFlags::MASK_SHIFT
const MOD_CMD: u32 = 0x0100;        // CGEventFlags::MASK_COMMAND  
const MOD_OPTION: u32 = 0x0800;    // CGEventFlags::MASK_ALT
const MOD_CONTROL: u32 = 0x0400;    // CGEventFlags::MASK_CONTROL
```

### File Changes

1. **`event_tap.rs`** — Add key event interception to `events_of_interest`:
   ```rust
   let events_of_interest: u64 = (1 << 22) | (1 << 10); // scroll + key
   ```

2. **`event_tap.rs`** — Add key event callback dispatch:
   ```rust
   unsafe extern "C" fn event_callback(...) -> CGEventRef {
       match event_type {
           22 => handle_scroll_event(event),
           10 => handle_key_event(event),  // NEW
           _ => event,
       }
   }
   ```

3. **`hotkey.rs`** — Rewrite without Carbon:
   - Add `Arc<Mutex<HashMap<u32, Box<dyn Fn()>>>>` for multiple hotkey support
   - Parse accelerator string to (modifiers, keycode)
   - Check modifier flags from CGEvent
   - Invoke registered callback on match

### Backward Compatibility

- Keep the same `Hotkey::register(accel, callback)` API
- Existing accelerator strings like `"Cmd+Shift+S"` should continue to work
- New accelerator strings like `"Escape"` should now work

### Testing

- [ ] Register hotkey `Escape` — verify callback fires
- [ ] Register hotkey `Cmd+Shift+S` — verify callback fires with correct modifiers
- [ ] Register 3+ hotkeys simultaneously — verify all work
- [ ] Unregister hotkey — verify it stops firing
- [ ] Test on macOS 14 (Sonoma) and macOS 15 (Sequoia beta) — verify Carbon-free operation

---

## 2. Process Query: Implement `foreground_process_id()`

### Problem

`foreground_process_id()` returns `None` instead of the frontmost app's PID. This is already implemented for `foreground_process_name()` and `foreground_process_info()` — just needs one additional method.

### Solution

Reuse the existing `NSWorkspace.frontmostApplication` code:

```rust
fn foreground_process_id(&self) -> Option<u32> {
    use objc2::msg_send;
    use objc2_app_kit::{NSRunningApplication, NSWorkspace};
    unsafe {
        let self_pid = std::process::id() as i32;
        let workspace = NSWorkspace::sharedWorkspace();
        let app: Option<Retained<NSRunningApplication>> =
            msg_send_id![&*workspace, frontmostApplication];
        let app = app?;
        let pid: i32 = msg_send![&*app, processIdentifier];
        if pid == self_pid {
            None
        } else {
            Some(pid as u32)
        }
    }
}
```

### Testing

- [ ] Call `foreground_process_id()` when Safari is frontmost — verify returns Safari's PID
- [ ] Call when SmoothScroll itself is frontmost — verify returns `None`
- [ ] Call when no app is frontmost — verify returns `None`

---

## 3. Display Query: Dynamic Refresh Rate

### Problem

`primary_refresh_rate_hz()` always returns `60`, ignoring ProMotion displays (120-240Hz) and external monitors with higher refresh rates.

### Solution

Use `NSScreen.maximumFramesPerSecond`:

```rust
fn primary_refresh_rate_hz(&self) -> u32 {
    use objc2::msg_send;
    use objc2_app_kit::NSScreen;
    unsafe {
        let screen = NSScreen::mainScreen()?;
        let rate: f64 = msg_send![&*screen, maximumFramesPerSecond];
        if rate > 0.0 && rate.is_finite() {
            Some(rate as u32)
        } else {
            None
        }
    }
    .unwrap_or(60) // fallback
}
```

### Caveats

- `NSScreen::mainScreen()` returns the screen containing the menu bar
- For multi-monitor setups, the "primary" screen is the one with the menu bar
- If `maximumFramesPerSecond` returns 0 (rare), fall back to 60

### Testing

- [ ] MacBook Pro with ProMotion (120Hz) — verify returns ~120
- [ ] External 144Hz monitor — verify returns ~144
- [ ] No screen available (edge case) — verify returns 60 (fallback)

---

## 4. Dependency Cleanup

### Remove Carbon Framework

After hotkey migration, remove Carbon linking from `Cargo.toml`:

```toml
# REMOVE this line from [target.'cfg(target_os = "macos")'.dependencies]
carbon = { version = "...", optional = true }
```

### Verify No Other Carbon Usage

```bash
grep -r "Carbon" crates/platform/src/macos/
# Expected: no matches
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `crates/platform/src/macos/event_tap.rs` | Add key event interception |
| `crates/platform/src/macos/hotkey.rs` | Rewrite without Carbon |
| `crates/platform/src/macos/process_query.rs` | Implement `foreground_process_id()` |
| `crates/platform/src/macos/display.rs` | Dynamic refresh rate from NSScreen |
| `crates/platform/Cargo.toml` | Remove Carbon dependency |

---

## Testing Strategy

### Unit Tests

Each file should have unit tests for the happy path and error cases:

- `hotkey.rs`: Test key parsing, modifier detection, callback invocation
- `process_query.rs`: Test PID returns correct value (mock NSWorkspace if needed)
- `display.rs`: Test fallback to 60 when NSScreen unavailable

### Integration Tests

- [ ] Full scroll flow: raw wheel → interception → engine → emission → app receives smooth scroll
- [ ] Hotkey registration: register → trigger → callback fires → unregister → stops firing
- [ ] Accessibility: Enable Reduce Motion → verify smooth scroll disables
- [ ] Autostart: Enable → verify LaunchAgent plist created → reboot → app launches

### Manual Testing Checklist

- [ ] Accessibility permission granted (System Settings → Privacy → Accessibility)
- [ ] Smooth scroll works in Safari (trackpad)
- [ ] Smooth scroll works in Safari (mouse wheel)
- [ ] Cmd+Shift+S hotkey toggles smooth scroll
- [ ] Escape key triggers configured action
- [ ] ProMotion display reports correct refresh rate
- [ ] App appears in System Settings → Login Items when autostart enabled

---

## Rollback Plan

If issues arise:

1. **Revert hotkey changes**: Keep Carbon in Cargo.toml, restore old `hotkey.rs` from git
2. **Revert all changes**: `git checkout HEAD -- crates/platform/src/macos/`
3. **CI verification**: macOS tests should continue to pass during migration

---

## Success Criteria

Phase 1 is complete when:

- [ ] All existing macOS scroll tests pass
- [ ] New hotkey tests pass (including arrow keys, F-keys, Escape)
- [ ] `foreground_process_id()` returns correct PID
- [ ] Refresh rate matches actual display rate on ProMotion Macs
- [ ] No Carbon framework references in codebase
- [ ] Manual testing on real macOS hardware confirms smooth scroll works
