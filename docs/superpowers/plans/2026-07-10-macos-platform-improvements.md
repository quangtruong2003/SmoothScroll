# macOS Platform Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three issues in the macOS platform: (1) replace deprecated Carbon hotkey API with CGEventTap, (2) implement `foreground_process_id()`, (3) implement dynamic refresh rate detection.

**Architecture:** Three independent changes to `crates/platform/src/macos/`. The hotkey rewrite uses a global `OnceLock<HotkeyRegistry>` that `MacosMouseHook::install()` populates when the event tap is created. `MacosHotkey::register()` then reads from that lock. This avoids any ordering dependency between `build()` and `install()`. Process query and display are simple implementations reusing existing NSWorkspace/NSScreen AppKit APIs.

**Tech Stack:** Rust, raw Quartz FFI (already in use), objc2 with app-kit (already in dependencies), CGEventTap.

---

## File Structure

```
crates/platform/src/macos/
├── event_tap.rs       # Add kCGEventKeyDown interception + key callback dispatch
├── hotkey.rs          # Rewrite: CGEventTap-based, multiple hotkeys, full keymap
├── process_query.rs   # Add foreground_process_id() implementation
├── display.rs         # Implement primary_refresh_rate_hz() via NSScreen
└── mod.rs             # (existing — no changes needed)

crates/platform/Cargo.toml  # (no changes needed — Carbon linked via #[link] in .rs, not in Cargo.toml)
```

---

## Task 1: Rewrite Hotkey — CGEventTap-Based

### Overview

Replace `Carbon RegisterEventHotKey` (deprecated) with CGEventTap. Extend `event_tap.rs` to also intercept `kCGEventKeyDown = 10` events and dispatch key events to a hotkey registry.

### Files

- Modify: `crates/platform/src/macos/event_tap.rs`
- Rewrite: `crates/platform/src/macos/hotkey.rs`

### Key Design Decisions

1. **Single tap, dual dispatch**: Same `CGEventTap` handles both scroll (22) and key (10) events. The callback dispatches to either `sink.on_wheel_ext()` or the hotkey registry.

2. **Hotkey registry**: `Arc<Mutex<HashMap<(modifiers, keycode), Callback>>>` allows multiple hotkeys. Each registration stores the (modifiers, keycode) → callback mapping.

3. **Modifier matching**: Compare CGEventFlags bits against the registered hotkey's modifiers. CGEventGetFlags() returns bits: Shift=0x100, Cmd=0x200, Option=0x400, Control=0x800.

4. **Keycode extraction**: `CGEventGetIntegerValueField(event, 7)` returns the virtual keycode (same as Carbon's virtual keycodes).

5. **No Carbon**: Remove `#[link(name = "Carbon", kind = "framework")]` from `hotkey.rs`. Carbon was linked via `#[link]` attribute in the .rs file, NOT in Cargo.toml.

---

### Step 1: Extend event_tap.rs — Add HotkeyRegistry and Key Event Interception

**Modify: `crates/platform/src/macos/event_tap.rs`**

Add these imports near the top (after the existing imports around line 18-20):

```rust
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::sync::Mutex;  // ADD THIS — for HotkeyRegistry
use std::collections::HashMap;  // ADD THIS
```

Add the `HotkeyRegistry` struct and global lock after the `ScrollInputSource` impl (after line 96):

```rust
/// Thread-safe hotkey registry. Stores (modifiers, keycode) → callback mappings.
/// Shared between the event tap callback and MacosHotkey::register().
pub struct HotkeyRegistry {
    callbacks: HashMap<(u32, u16), Box<dyn Fn() + Send + Sync>>,
}

impl HotkeyRegistry {
    pub fn new() -> Self {
        Self { callbacks: HashMap::new() }
    }

    pub fn register(
        &mut self,
        modifiers: u32,
        keycode: u16,
        callback: Box<dyn Fn() + Send + Sync>,
    ) -> Option<Box<dyn Fn() + Send + Sync>> {
        self.callbacks.insert((modifiers, keycode), callback)
    }

    pub fn unregister(&mut self, modifiers: u32, keycode: u16) -> Option<Box<dyn Fn() + Send + Sync>> {
        self.callbacks.remove(&(modifiers, keycode))
    }

    pub fn dispatch(&self, keycode: u16, flags: u32) {
        // Exact modifier+keycode match only (same as X11/Linuc behavior)
        if let Some(cb) = self.callbacks.get(&(flags, keycode)) {
            cb();
        }
    }
}

impl Default for HotkeyRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Global registry — initialized by install_on_main_thread, read by MacosHotkey::register().
/// Uses OnceLock pattern: set once during install, read many times during hotkey registration.
static HOTKEY_REGISTRY: std::sync::OnceLock<Mutex<HotkeyRegistry>> = std::sync::OnceLock::new();
```

Add `kCGEventKeyDown` constant after the other constants (around line 38):

```rust
const kCGHIDEventTap: u32 = 0;
const kCGHeadInsertEventTap: u32 = 0;
const kCGEventKeyDown: u32 = 10;  // ADD THIS — for hotkey interception
```

Add `read_keycode` helper function after `read_horizontal_delta` (after line 125):

```rust
/// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
unsafe fn read_keycode(event: CGEventRef) -> u16 {
    CGEventGetIntegerValueField(event, 7) as u16
}
```

Modify `TapCallback` struct (line 131) to include the registry:

```rust
struct TapCallback {
    sink: Arc<dyn HookEventSink>,
    run_loop_source: CFRunLoopSourceRef,
    tap: CFMachPortRef,
    hotkey_registry: Arc<Mutex<HotkeyRegistry>>,  // ADD THIS
}
```

Modify `event_callback` (around line 141) to dispatch key events:

```rust
unsafe extern "C" fn event_callback(
    _proxy: CGEventTapProxy,
    event_type: u32,
    event: CGEventRef,
    _user_info: *mut std::os::raw::c_void,
) -> CGEventRef {
    let cb_ptr = CALLBACK_PTR.load(Ordering::SeqCst);
    if cb_ptr.is_null() {
        return event;
    }
    let cb = &*cb_ptr;

    match event_type {
        22 => {
            // kCGEventScrollWheel — existing scroll handling (no changes needed)
            let source = ScrollInputSource::from_event(event);
            let v_delta = read_vertical_delta(event);
            let h_delta = read_horizontal_delta(event);
            let mods = read_modifiers(event);
            let input_source = match source {
                ScrollInputSource::Trackpad => smoothscroll_core::input_source::InputSource::Touchpad,
                ScrollInputSource::Mouse => smoothscroll_core::input_source::InputSource::Wheel,
            };
            let _v_decision = cb.sink.on_wheel_ext(v_delta, mods, input_source);
            let _h_decision = cb.sink.on_hwheel_ext(h_delta, input_source);
        }
        10 => {
            // kCGEventKeyDown — dispatch to hotkey registry
            let keycode = read_keycode(event);
            let flags = CGEventGetFlags(event);
            cb.hotkey_registry.lock().unwrap().dispatch(keycode, flags);
        }
        _ => {}
    }

    event
}
```

Modify `events_of_interest` in `install_on_main_thread` (line 234):

```rust
// kCGEventScrollWheel = 22, kCGEventKeyDown = 10
let events_of_interest: u64 = (1 << 22) | (1 << 10);
```

Modify `TapCallback` construction (line 262):

```rust
let cb = Box::new(TapCallback {
    sink,
    run_loop_source,
    tap,
    hotkey_registry: Arc::new(Mutex::new(HotkeyRegistry::new())),
});
```

After the `TapCallback` is created, initialize the global registry (after line 268):

```rust
let _ = HOTKEY_REGISTRY.set(cb.hotkey_registry.lock().unwrap());
```

(Or more safely, using the Arc clone from the Box:)

```rust
// Initialize global registry so MacosHotkey can register callbacks before
// the tap is actually installed (during build()).
if HOTKEY_REGISTRY.get().is_none() {
    let _ = HOTKEY_REGISTRY.set(Mutex::new(HotkeyRegistry::new()));
}
```

Modify `InstalledTap` struct to include the registry (add after line 284):

```rust
pub struct InstalledTap {
    pub source: CFRunLoopSourceRef,
    pub tap: CFMachPortRef,
    pub running: Arc<AtomicBool>,
    pub hotkey_registry: Arc<Mutex<HotkeyRegistry>>,  // ADD THIS
}
```

Update `InstalledTap` construction at the end of `install_on_main_thread` (line 276-280):

```rust
Ok(InstalledTap {
    source: run_loop_source,
    tap,
    running: Arc::new(AtomicBool::new(true)),
    hotkey_registry: cb.hotkey_registry.clone(),
})
```

Export `HotkeyRegistry` and `HOTKEY_REGISTRY` from `event_tap.rs` for use by `hotkey.rs`:

Add to the `pub mod event_tap` exports in `mod.rs`:

```rust
pub use event_tap::{run_event_loop, ScrollInputSource, HotkeyRegistry, HOTKEY_REGISTRY};
```

---

### Step 2: Rewrite hotkey.rs — Using Global Registry

**Rewrite: `crates/platform/src/macos/hotkey.rs`**

Replace the entire file content:

```rust
//! Global hotkey registration via CGEventTap.
//!
//! Hotkeys are dispatched through the shared event tap (event_tap.rs). Each
//! registered hotkey stores a (modifiers, keycode) → callback mapping in the
//! global `HOTKEY_REGISTRY`. When kCGEventKeyDown fires, the tap's callback
//! looks up the (flags, keycode) pair and invokes the matching callback.
//!
//! This replaces the deprecated Carbon RegisterEventHotKey API.

#![cfg(target_os = "macos")]

use crate::macos::event_tap::HOTKEY_REGISTRY;
use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
use std::sync::Mutex;

// ---------------------------------------------------------------------------
// Modifiers — CGEventFlags bit positions
// CGEventGetFlags() returns: Shift=0x100, Cmd=0x200, Option=0x400, Control=0x800
// ---------------------------------------------------------------------------

const MOD_SHIFT: u32 = 0x00000100;
const MOD_CMD: u32 = 0x00000200;
const MOD_OPTION: u32 = 0x00000400;
const MOD_CONTROL: u32 = 0x00000800;

// ---------------------------------------------------------------------------
// Keycode mapping — macOS virtual keycodes (same as Carbon)
// ---------------------------------------------------------------------------

fn parse_key(s: &str) -> Result<u16> {
    match s.to_ascii_lowercase().as_str() {
        // Function keys
        "f1" => Ok(122), "f2" => Ok(120), "f3" => Ok(99),
        "f4" => Ok(118), "f5" => Ok(96), "f6" => Ok(97),
        "f7" => Ok(98), "f8" => Ok(101), "f9" => Ok(109),
        "f10" => Ok(103), "f11" => Ok(111), "f12" => Ok(118),
        "f13" => Ok(105), "f14" => Ok(107), "f15" => Ok(113),
        "f16" => Ok(106), "f17" => Ok(64), "f18" => Ok(79),
        "f19" => Ok(80), "f20" => Ok(90),

        // Arrow keys
        "up" | "arrowup" => Ok(126),
        "down" | "arrowdown" => Ok(125),
        "left" | "arrowleft" => Ok(123),
        "right" | "arrowright" => Ok(124),

        // Special keys
        "escape" | "esc" => Ok(53),
        "space" => Ok(49),
        "return" | "enter" => Ok(36),
        "tab" => Ok(48),
        "backspace" => Ok(51),
        "delete" => Ok(117),
        "home" => Ok(115),
        "end" => Ok(119),
        "pageup" => Ok(116),
        "pagedown" => Ok(121),

        // ASCII letter/number keys
        s if s.len() == 1 => {
            let c = s.chars().next().unwrap().to_ascii_lowercase();
            let code = match c {
                'a' => 0,  's' => 1,  'd' => 2,  'f' => 3,  'h' => 4,
                'g' => 5,  'z' => 6,  'x' => 7,  'c' => 8,  'v' => 9,
                'b' => 11, 'q' => 12, 'w' => 13, 'e' => 14, 'r' => 15,
                'y' => 16, 't' => 17, '1' => 18, '2' => 19, '3' => 20,
                '4' => 21, '6' => 22, '5' => 23, '=' => 24, '9' => 25,
                '7' => 26, '-' => 27, '8' => 28, '0' => 29, ']' => 30,
                'o' => 31, 'u' => 32, '[' => 33, 'i' => 34, 'p' => 35,
                'l' => 37, 'j' => 38, '\'' => 39, 'k' => 40, ';' => 41,
                '\\' => 42, ',' => 43, '/' => 44, 'n' => 45, 'm' => 46,
                '.' => 47, '`' => 50,
                _ => return Err(PlatformError::Os(format!("unsupported key '{s}'"))),
            };
            Ok(code)
        }

        _ => Err(PlatformError::Os(format!("unsupported key '{s}'"))),
    }
}

/// Parse "Cmd+Shift+S" → (MOD_CMD | MOD_SHIFT, 1)
fn parse_accelerator(raw: &str) -> Result<(u32, u16)> {
    let mut mods = 0u32;
    let mut keycode: Option<u16> = None;

    for part in raw.split('+').map(|p| p.trim()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= MOD_CONTROL,
            "alt" | "option" => mods |= MOD_OPTION,
            "shift" => mods |= MOD_SHIFT,
            "cmd" | "command" | "super" | "win" | "commandorcontrol" => mods |= MOD_CMD,
            other => {
                if keycode.is_some() {
                    return Err(PlatformError::Os(format!(
                        "multiple keys in accelerator '{raw}'"
                    )));
                }
                keycode = Some(parse_key(other)?);
            }
        }
    }

    let keycode = keycode.ok_or_else(|| PlatformError::Os(format!("no key in '{raw}'")))?;
    Ok((mods, keycode))
}

// ---------------------------------------------------------------------------
// RAII handle — unregisters on drop
// ---------------------------------------------------------------------------

struct InstalledHotkey {
    modifiers: u32,
    keycode: u16,
}

impl Drop for InstalledHotkey {
    fn drop(&mut self) {
        if let Some(reg) = HOTKEY_REGISTRY.get() {
            let _ = reg.lock().unwrap().unregister(self.modifiers, self.keycode);
        }
    }
}

unsafe impl Send for InstalledHotkey {}
unsafe impl Sync for InstalledHotkey {}

// ---------------------------------------------------------------------------
// MacosHotkey
// ---------------------------------------------------------------------------

pub struct MacosHotkey;

impl MacosHotkey {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MacosHotkey {
    fn default() -> Self {
        Self::new()
    }
}

impl Hotkey for MacosHotkey {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        let (mods, keycode) = parse_accelerator(&accel.raw)?;

        let registry = HOTKEY_REGISTRY.get().ok_or_else(|| {
            PlatformError::Os("hotkey registry not initialized — is smooth scroll installed?".into())
        })?;

        let mut reg = registry.lock().unwrap();
        if reg.callbacks.contains_key(&(mods, keycode)) {
            return Err(PlatformError::Os(format!(
                "hotkey '{accel}' already registered"
            )));
        }
        reg.register(mods, keycode, on_pressed);

        Ok(HotkeyHandle::new(Box::new(InstalledHotkey {
            modifiers: mods,
            keycode,
        })))
    }
}
```

### Step 3: Export from event_tap.rs (mod.rs doesn't change)

The `pub mod event_tap` in `mod.rs` already re-exports items. Since `HotkeyRegistry` and `HOTKEY_REGISTRY` are defined in `event_tap.rs`, they will be accessible via `crate::macos::event_tap::HOTKEY_REGISTRY` from `hotkey.rs`. No changes to `mod.rs` are needed.

### Step 4: Build Verification

Try syntax check (will fail on Windows but validates code structure):

```bash
cd D:/SmoothScroll && pnpm exec cargo check --package smoothscroll_platform
```

On macOS:
```bash
cd D:/SmoothScroll && pnpm exec cargo build --package smoothscroll_platform
```

### Step 5: Verify No Carbon References

```bash
grep -r "Carbon" crates/platform/src/macos/
grep -r "RegisterEventHotKey" crates/platform/src/macos/
```

Expected: no matches (Carbon was linked via `#[link]` in the .rs file, not in Cargo.toml).

---

## Task 2: Implement `foreground_process_id()`

### Files

- Modify: `crates/platform/src/macos/process_query.rs`

### Step 1: Implement the Method

In `crates/platform/src/macos/process_query.rs`, replace the stub `foreground_process_id()` (around line 54-56):

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

This reuses the exact same pattern already used in `foreground_process_name()` and `foreground_process_info()`.

### Step 2: Verify Compilation

Run:
```bash
cd D:/SmoothScroll && pnpm exec cargo check --package smoothscroll_platform
```

Expected: no errors.

### Step 3: Commit

```bash
git add crates/platform/src/macos/process_query.rs
git commit -m "macos: implement foreground_process_id() via NSWorkspace"
```

---

## Task 3: Implement Dynamic Refresh Rate

### Files

- Modify: `crates/platform/src/macos/display.rs`

### Step 1: Check Existing Dependencies

In `crates/platform/Cargo.toml`, `objc2-app-kit` already has the `NSScreen` feature? Let me check:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc2-app-kit = { version = "0.2", default-features = false, features = [
    "std",
    "NSWorkspace",
    "NSRunningApplication",
    "NSResponder",
] }
```

`NSScreen` is NOT in the features list. We need to add it.

### Step 2: Add NSScreen Feature to Cargo.toml

**Modify: `crates/platform/Cargo.toml`**

Change:

```toml
objc2-app-kit = { version = "0.2", default-features = false, features = [
    "std",
    "NSWorkspace",
    "NSRunningApplication",
    "NSResponder",
] }
```

To:

```toml
objc2-app-kit = { version = "0.2", default-features = false, features = [
    "std",
    "NSWorkspace",
    "NSRunningApplication",
    "NSResponder",
    "NSScreen",
] }
```

### Step 3: Implement primary_refresh_rate_hz

**Modify: `crates/platform/src/macos/display.rs`**

Replace the stub with:

```rust
#![cfg(target_os = "macos")]
use crate::traits::DisplayQuery;

pub struct MacosDisplayQuery;

impl DisplayQuery for MacosDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        use objc2::msg_send;
        use objc2_app_kit::NSScreen;

        unsafe {
            // NSScreen::mainScreen() returns the screen containing the menu bar.
            // On a single-display Mac, this is always the primary screen.
            let screen = NSScreen::mainScreen();

            match screen {
                Some(ref s) => {
                    // maximumFramesPerSecond returns 0 if the display's refresh
                    // rate cannot be determined (e.g., headless or VM without
                    // graphics acceleration). Fall back to 60.
                    let rate: f64 = msg_send![&**s, maximumFramesPerSecond];
                    if rate > 0.0 && rate.is_finite() {
                        rate as u32
                    } else {
                        60
                    }
                }
                None => 60, // No screen available — shouldn't happen on a real Mac
            }
        }
    }
}
```

Note: `&**s` dereferences twice — first `&s` gives `&Retained<NSScreen>`, then `**s` gives `&NSScreen` (the underlying objc2 type). The `msg_send!` macro needs the underlying type.

### Step 4: Verify Compilation

Run:
```bash
cd D:/SmoothScroll && pnpm exec cargo check --package smoothscroll_platform
```

Expected: no errors.

### Step 5: Commit

```bash
git add crates/platform/Cargo.toml crates/platform/src/macos/display.rs
git commit -m "macos: detect refresh rate via NSScreen.maximumFramesPerSecond"
```

---

## Task 4: Integration Test & Final Verification

### Step 1: Full Build

On macOS hardware:
```bash
cd D:/SmoothScroll && pnpm run build:wasm && cd src-tauri && npx tauri build
```

Expected: builds successfully on macOS.

### Step 2: Test Hotkey Registration

Manual test checklist:
- [ ] Register `Escape` hotkey → verify callback fires when Escape pressed
- [ ] Register `Cmd+Shift+S` → verify fires with Cmd+Shift held, not with just Shift
- [ ] Register multiple hotkeys (3+) → verify all fire independently
- [ ] Unregister one hotkey → verify it stops firing while others still work

### Step 3: Test foreground_process_id()

Manual test:
- [ ] In a test app, call `foreground_process_id()` when Safari is frontmost → verify returns Safari's PID
- [ ] Call when SmoothScroll itself is frontmost → verify returns `None`
- [ ] Call when no app is frontmost → verify returns `None`

### Step 4: Test Refresh Rate

- [ ] MacBook Pro with ProMotion → verify returns ~120 (or actual rate)
- [ ] External 144Hz monitor → verify returns ~144
- [ ] VM without graphics acceleration → verify returns 60 (fallback)

### Step 5: Final Commit

```bash
git add -A && git commit -m "macos platform: hotkey CGEventTap rewrite, foreground_process_id, dynamic refresh rate"
```

---

## Rollback Plan

If issues arise at any step:

1. **Revert hotkey changes**: `git checkout HEAD~1 -- crates/platform/src/macos/hotkey.rs crates/platform/src/macos/event_tap.rs crates/platform/src/macos/mod.rs`
2. **Revert process_query changes**: `git checkout HEAD~1 -- crates/platform/src/macos/process_query.rs`
3. **Revert display changes**: `git checkout HEAD~1 -- crates/platform/src/macos/display.rs crates/platform/Cargo.toml`
4. **Full revert**: `git checkout HEAD -- crates/platform/src/macos/`

---

## Success Criteria

- [ ] All three tasks completed
- [ ] No Carbon framework references in codebase
- [ ] `foreground_process_id()` returns correct PID for frontmost app
- [ ] Refresh rate matches actual display rate on ProMotion Macs
- [ ] Multiple hotkeys can be registered simultaneously
- [ ] Arrow keys, F-keys, Escape all work as hotkeys
- [ ] Cargo check passes on current platform
- [ ] Manual testing on real macOS hardware confirms all features work
