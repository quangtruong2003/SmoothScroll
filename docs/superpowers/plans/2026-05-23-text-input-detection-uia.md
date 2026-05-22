# UIA Text Input Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Win32 class-name whitelist in `text_input_detector.rs` with Windows UI Automation (UIA) so `keyboard_smart_text_skip` correctly skips scroll when focused in any text input — including browser web content and Electron apps.

**Architecture:** `is_focus_in_text_input()` public API stays identical; only the implementation changes. New implementation calls `IUIAutomation::GetFocusedElement()` via COM, checks `CurrentControlType()` against `UIA_EditControlTypeId` and `UIA_DocumentControlTypeId`, and caches the result for 50 ms to handle key-repeat events without repeated COM calls.

**Tech Stack:** Rust, `windows` crate 0.58 (`Win32_UI_Accessibility` + `Win32_System_Com`), Windows only.

**Spec:** `docs/superpowers/specs/2026-05-23-text-input-detection-uia-design.md`

---

## File Map

| File | Change |
|------|--------|
| `crates/platform/Cargo.toml` | Add `windows` crate under `[target.'cfg(windows)'.dependencies]` |
| `crates/platform/src/windows/text_input_detector.rs` | Full rewrite — remove Win32 class logic, add UIA + cache |

No other files change. `keyboard_sink.rs` calls `is_focus_in_text_input()` unchanged.

---

### Task 1: Add `windows` crate dependency

**Files:**
- Modify: `crates/platform/Cargo.toml`

- [ ] **Step 1: Add dependency**

In `crates/platform/Cargo.toml`, append these two lines inside the existing `[target.'cfg(windows)'.dependencies]` block (after the closing `]` of the `windows-sys` features list):

```toml
windows = { version = "0.58", features = [
    "Win32_UI_Accessibility",
    "Win32_System_Com",
] }
```

The block should look like this after the edit:

```toml
[target.'cfg(windows)'.dependencies]
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
] }
windows = { version = "0.58", features = [
    "Win32_UI_Accessibility",
    "Win32_System_Com",
] }
```

- [ ] **Step 2: Verify dependency resolves**

```powershell
cargo check -p smoothscroll_platform
```

Expected: compiles without errors. Cargo will download `windows` crate on first run.

- [ ] **Step 3: Commit**

```powershell
git add crates/platform/Cargo.toml Cargo.lock
git commit -m "chore: add windows crate for UIA support in platform crate"
```

---

### Task 2: Write failing tests (RED)

**Files:**
- Modify: `crates/platform/src/windows/text_input_detector.rs`

The old file has no `CACHE` static. Adding tests that reference `CACHE` will cause a compile error — this is the failing state (RED).

- [ ] **Step 1: Append test module to existing file**

Add the following block at the very end of `crates/platform/src/windows/text_input_detector.rs` (after line 51, before EOF):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn does_not_panic() {
        let _ = is_focus_in_text_input();
    }

    #[test]
    fn cache_is_populated_after_first_call() {
        {
            let mut guard = CACHE.lock().unwrap();
            *guard = None;
        }
        let _ = is_focus_in_text_input();
        let guard = CACHE.lock().unwrap();
        assert!(guard.is_some(), "cache should be populated after first call");
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure (RED)**

```powershell
cargo test -p smoothscroll_platform text_input
```

Expected output includes:
```
error[E0425]: cannot find value `CACHE` in this scope
```

This confirms the tests are meaningfully testing the new behaviour that doesn't exist yet.

---

### Task 3: Implement UIA-based detection (GREEN)

**Files:**
- Rewrite: `crates/platform/src/windows/text_input_detector.rs`

Replace the **entire contents** of `crates/platform/src/windows/text_input_detector.rs` with:

```rust
#![cfg(windows)]

use std::sync::Mutex;
use std::time::{Duration, Instant};

use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, UIA_DocumentControlTypeId, UIA_EditControlTypeId,
};

const CACHE_TTL: Duration = Duration::from_millis(50);

static CACHE: Mutex<Option<(Instant, bool)>> = Mutex::new(None);

pub fn is_focus_in_text_input() -> bool {
    let mut guard = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if let Some((ts, val)) = *guard {
        if ts.elapsed() < CACHE_TTL {
            return val;
        }
    }
    let result = query_uia_focus();
    *guard = Some((Instant::now(), result));
    result
}

fn query_uia_focus() -> bool {
    unsafe {
        // COM init is idempotent per thread; ignore return value.
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let automation: IUIAutomation =
            match CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER) {
                Ok(a) => a,
                Err(_) => return false,
            };

        let element = match automation.GetFocusedElement() {
            Ok(e) => e,
            Err(_) => return false,
        };

        let control_type = match element.CurrentControlType() {
            Ok(ct) => ct,
            Err(_) => return false,
        };

        // UIA_EditControlTypeId = 50004: <input>, native Edit controls, browser address bars
        // UIA_DocumentControlTypeId = 50030: <textarea>, contenteditable, rich editors
        control_type == UIA_EditControlTypeId || control_type == UIA_DocumentControlTypeId
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn does_not_panic() {
        // UIA may not be available in headless CI; we just verify no panic.
        let _ = is_focus_in_text_input();
    }

    #[test]
    fn cache_is_populated_after_first_call() {
        {
            let mut guard = CACHE.lock().unwrap();
            *guard = None;
        }
        let _ = is_focus_in_text_input();
        let guard = CACHE.lock().unwrap();
        assert!(guard.is_some(), "cache should be populated after first call");
    }
}
```

- [ ] **Step 2: Run tests — expect GREEN**

```powershell
cargo test -p smoothscroll_platform text_input
```

Expected:
```
test windows::text_input_detector::tests::does_not_panic ... ok
test windows::text_input_detector::tests::cache_is_populated_after_first_call ... ok
test result: ok. 2 passed; 0 failed
```

- [ ] **Step 3: Run full platform test suite — no regressions**

```powershell
cargo test -p smoothscroll_platform
```

Expected: all tests pass.

- [ ] **Step 4: Verify full workspace compiles**

```powershell
cargo check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```powershell
git add crates/platform/src/windows/text_input_detector.rs
git commit -m "fix: replace Win32 class whitelist with UIA for text input detection

Previously, is_focus_in_text_input() used a hardcoded list of Win32
window class names (Edit, RichEdit, etc.) and checked for a Win32
caret. Browsers and Electron apps render inputs via the GPU compositor
and never set a Win32 caret, so the detector always returned false
while the user was typing in a browser text field.

Replace the implementation with IUIAutomation::GetFocusedElement() +
CurrentControlType() check. UIA providers are implemented by all
modern browsers, Electron, and native Win32 apps. Add a 50 ms result
cache to avoid COM overhead on key-repeat events."
```

---

### Task 4: Manual verification

No automated test can cover real browser inputs. Verify these cases manually after building:

```powershell
npx tauri dev
```

| App | Action | Expected |
|-----|--------|---------|
| Chrome | Focus `<input>` on any site, press Space | Space appears as text, no scroll |
| Chrome | Focus `<textarea>` on any site, press Space | Space appears as text, no scroll |
| Chrome | Click page body (no input focused), press Space | Page scrolls down |
| Firefox | Focus `<input>`, press Space | Space appears as text, no scroll |
| Edge | Focus address bar, press Space | Space appears as text, no scroll |
| VS Code | Focus editor or search, press Space | Space appears as text, no scroll |
| Notepad | Focus edit area, press Space | Space appears as text, no scroll |
| Any window | No text input focused, press Space | Page/app scrolls |
