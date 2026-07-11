# S2 macOS Scroll Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the macOS double-scroll issue by respecting `HookDecision::Swallow` in the event tap callback, and document criteria for macOS stubs (A4).

**Architecture:** macOS CGEventTap currently ignores `_v_decision` and `_h_decision` and always returns the original event. By returning `null_mut()` when the engine returns `HookDecision::Swallow`, Quartz will swallow the original event, leaving only the engine's synthetic pulses, resolving the double-scroll.

**Tech Stack:** Rust (crates/platform target macOS).

## Global Constraints
- Target only macOS.
- Tests mandatory: verify compile + verify correct imports.

---

### Task 1: Respect `HookDecision` in CGEventTap (A3)

**Files:**
- Modify: `crates/platform/src/macos/event_tap.rs:218-220` (use `HookDecision` to conditional null-return)
- Modify: `crates/platform/src/macos/event_tap.rs:10` (import `HookDecision`)

- [ ] **Step 1: Import `HookDecision`**

Open `crates/platform/src/macos/event_tap.rs`. Add `HookDecision` to the imports at line 10.
```rust
use crate::types::{HookDecision, ModifierKeys, PlatformError, Result};
```

- [ ] **Step 2: Conditional return in event_callback**

Modify `event_callback` scroll arm (lines 218-220):
```rust
            let v_decision = cb.sink.on_wheel_ext(v_delta, mods, input_source);
            let h_decision = cb.sink.on_hwheel_ext(h_delta, input_source);
            if v_decision == HookDecision::Swallow || h_decision == HookDecision::Swallow {
                return std::ptr::null_mut();
            }
```

- [ ] **Step 3: Compile check**

Run: `cargo check`

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/macos/event_tap.rs
git commit -m "fix(platform): respect HookDecision to swallow original scroll on macOS"
```

---

### Task 2: Document macOS stubs acceptance criteria (A4)

**Files:**
- Modify: `crates/platform/src/macos/process_query.rs`, `crates/platform/src/macos/fullscreen.rs`, `crates/platform/src/macos/window_geom.rs` (add doc comments documenting stub criteria for future implementer)

- [ ] **Step 1: Document process_query.rs stubs**

Add doc comments to `process_name_under_cursor` and `list_visible_processes` in `process_query.rs`:
```rust
    // Stub criteria: future implementer must use AXUIElementCopyElementAtPosition
    // to find the UI element under cursor, query its AXWindow, and get the pid.
```

- [ ] **Step 2: Document fullscreen.rs stubs**

Add comments to `is_foreground_fullscreen` in `fullscreen.rs`:
```rust
    // Stub criteria: future implementer must query the frontmost app's window frame
    // via Accessibility APIs and check if it matches NSScreen.mainScreen.frame.
```

- [ ] **Step 3: Document window_geom.rs stubs**

Add comments to `cursor_in_window` / `list_monitors` in `window_geom.rs`.

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/macos/process_query.rs crates/platform/src/macos/fullscreen.rs crates/platform/src/macos/window_geom.rs
git commit -m "docs(platform): add macOS stubs acceptance criteria comments"
```
