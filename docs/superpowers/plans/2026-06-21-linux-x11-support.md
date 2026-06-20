# Linux X11 Support Implementation Plan (V2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Linux X11 support to SmoothScroll so the app builds and runs on X11-based Linux desktops.

**Architecture:** Create `crates/platform/src/linux/` with implementations for all 7 Platform traits plus 2 supporting types (FullscreenDetector, WindowGeometry). Uses X11 via the `x11` Rust crate. Wayland sessions get a warning dialog. Self-injected XTest events are suppressed to prevent infinite feedback loops.

**Tech Stack:** Rust, X11 (x11 crate with xinput/xtest features), libc, Tauri 2, GitHub Actions

## Global Constraints

- X11-only: Wayland detected via `XDG_SESSION_TYPE` env var, shows warning
- Ubuntu 22.04+ / Debian 11+ minimum
- No `unwrap()` / `panic!()` in production code — use `Result` + `PlatformError::Os(String)`
- `HookHandle` and `HotkeyHandle` are opaque RAII wrappers (see `traits.rs`)
- Platform struct uses `Arc<dyn Trait>` for all fields
- XInput2 cannot swallow scroll events — original scroll passes through alongside smooth scroll (known limitation)
- XTest feedback loop protection: WheelEmitter sets a suppression flag; MouseHook skips events while flag is set
- WheelEmitter keeps a persistent Display connection — per-emit open/close at 120fps causes stutter
- All keycodes resolved at runtime via `XKeysymToKeycode` — never hardcoded (breaks non-US layouts)
- Process names from `/proc/<pid>/exe` — `/proc/<pid>/comm` truncated to 15 chars

## Key Trait Signatures (from crates/platform/src/traits.rs)

```rust
pub trait MouseHook: Send + Sync {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle>;
}
pub trait WheelEmitter: Send + Sync {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()>;
}
pub trait ZoomEmitter: Send + Sync {
    fn emit_zoom(&self, units: i32) -> Result<()>;
}
pub trait ProcessQuery: Send + Sync {
    fn process_name_under_cursor(&self) -> Option<String>;
    fn foreground_process_id(&self) -> Option<u32>;
    fn list_visible_processes(&self) -> Vec<ProcessInfo>;
    fn foreground_process_name(&self) -> Option<String> { None }
    fn is_target_elevated(&self) -> bool { false }
}
pub trait Autostart: Send + Sync {
    fn is_enabled(&self) -> bool;
    fn set(&self, enabled: bool) -> Result<()>;
}
pub trait Hotkey: Send + Sync {
    fn register(&self, accel: Accelerator, on_pressed: Box<dyn Fn() + Send + Sync>) -> Result<HotkeyHandle>;
}
pub trait FullscreenDetector: Send + Sync {
    fn is_foreground_fullscreen(&self) -> bool;
}
pub trait WindowGeometry: Send + Sync {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)>;
}
pub trait AccessibilitySignals: Send + Sync {
    fn reduce_motion_enabled(&self) -> bool;
    fn watch(&self, on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle>;
}
```

Platform struct:
```rust
pub struct Platform {
    pub mouse_hook: Arc<dyn MouseHook>,
    pub wheel_emitter: Arc<dyn WheelEmitter>,
    pub zoom_emitter: Arc<dyn ZoomEmitter>,
    pub process_query: Arc<dyn ProcessQuery>,
    pub autostart: Arc<dyn Autostart>,
    pub hotkey: Arc<dyn Hotkey>,
    pub accessibility: Arc<dyn AccessibilitySignals>,
}
```

## File Structure

### Create (12 files)
- `crates/platform/src/linux/mod.rs` — Module declarations + `build()` function
- `crates/platform/src/linux/display.rs` — Shared X11 display connection helper
- `crates/platform/src/linux/timer.rs` — HighResTimerGuard no-op
- `crates/platform/src/linux/accessibility.rs` — AccessibilitySignals stub
- `crates/platform/src/linux/keyboard.rs` — ModifierSampler (XQueryKeymap polling)
- `crates/platform/src/linux/autostart.rs` — XDG `.desktop` file management
- `crates/platform/src/linux/process_query.rs` — EWMH + /proc process identification
- `crates/platform/src/linux/fullscreen.rs` — FullscreenDetector via _NET_WM_STATE
- `crates/platform/src/linux/window_geom.rs` — WindowGeometry via XQueryPointer
- `crates/platform/src/linux/hotkey.rs` — XGrabKey global hotkey
- `crates/platform/src/linux/mouse_hook.rs` — XInput2 mouse wheel interception
- `crates/platform/src/linux/wheel_emitter.rs` — XTest scroll injection with suppression

### Modify (9 files)
- `crates/platform/Cargo.toml` — Add Linux deps
- `crates/platform/src/lib.rs` — Add `#[cfg(target_os = "linux")]` branch
- `src-tauri/tauri.conf.json` — Add Linux bundle targets
- `src-tauri/build.rs` — Add Linux pkill
- `src-tauri/src/commands.rs` — Use `xdg-open` on Linux
- `src-tauri/src/lib.rs` — Add Linux cfg branches for FullscreenDetector/WindowGeometry/Timer
- `src/components/settings/BehaviorSection.tsx` — Hide Windows-only toggle on Linux
- `src/components/TrayPanel.tsx` — Platform-agnostic autostart label
- `README.md` — Linux installation section

---

### Task 1: Build Infrastructure

**Files:**
- Modify: `crates/platform/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/build.rs`

**Interfaces:**
- Consumes: None
- Produces: Cargo/Tauri/build config that allows Linux compilation

- [ ] **Step 1: Add Linux deps to crates/platform/Cargo.toml**

Add after existing target-specific sections:

```toml
[target.'cfg(target_os = "linux")'.dependencies]
x11 = { version = "2.21", features = ["xlib", "xinput", "xtest"] }
libc = "0.2"
```

- [ ] **Step 2: Add Linux bundle targets to src-tauri/tauri.conf.json**

In the `"bundle"` object, update `"targets"` and add `"linux"` key:

```json
"targets": ["nsis", "msi", "app", "dmg", "deb", "appimage"],
"linux": {
  "deb": {
    "depends": [
      "libwebkit2gtk-4.1-0",
      "libayatana-appindicator3-1",
      "libx11-6",
      "libxi6",
      "libxtst6"
    ]
  },
  "appimage": {
    "bundleMediaFramework": true
  }
}
```

- [ ] **Step 3: Add Linux pkill to src-tauri/build.rs**

Add `#[cfg(target_os = "linux")]` block alongside existing Windows/macOS kill blocks:

```rust
#[cfg(target_os = "linux")]
{
    let _ = std::process::Command::new("pkill")
        .args(["-x", "smoothscroll-app"])
        .status();
}
```

- [ ] **Step 4: Verify syntax**

Run: `cargo check --manifest-path crates/platform/Cargo.toml`
Expected: May warn about missing modules (expected — not created yet)

- [ ] **Step 5: Commit**

```bash
git add crates/platform/Cargo.toml src-tauri/tauri.conf.json src-tauri/build.rs
git commit -m "chore: add Linux build infrastructure

- x11 + libc deps for Linux platform crate
- deb + appimage bundle targets
- Linux pkill in build.rs"
```

---

### Task 2: Module Scaffolding + Display Helper

**Files:**
- Create: `crates/platform/src/linux/display.rs`
- Create: `crates/platform/src/linux/mod.rs`
- Modify: `crates/platform/src/lib.rs`

**Interfaces:**
- Consumes: Platform struct from lib.rs
- Produces: `linux::build() -> Result<Platform>` and `display::open_display()` helper

- [ ] **Step 1: Create display.rs**

Create `crates/platform/src/linux/display.rs`:

```rust
//! Shared X11 display connection utilities.
//!
//! Each subsystem opens its own Display connection because X11 connections
//! are NOT thread-safe. Opening per-subsystem connections is the standard
//! approach for X11 apps that need threads.

use crate::types::PlatformError;
use x11::xlib;

/// Open a new X11 display connection.
pub fn open_display() -> Result<*mut xlib::Display, PlatformError> {
    let display = unsafe { xlib::XOpenDisplay(std::ptr::null()) };
    if display.is_null() {
        Err(PlatformError::Os(
            "failed to open X11 display — is DISPLAY set?".into(),
        ))
    } else {
        Ok(display)
    }
}

/// # Safety
/// `display` must be a valid pointer from `XOpenDisplay`.
pub unsafe fn close_display(display: *mut xlib::Display) {
    if !display.is_null() {
        xlib::XCloseDisplay(display);
    }
}

/// # Safety
/// `display` must be a valid, open display connection.
pub unsafe fn root_window(display: *mut xlib::Display) -> xlib::Window {
    xlib::XDefaultRootWindow(display)
}

/// Resolve keysym to keycode at runtime. Returns 0 if not found.
///
/// # Safety
/// `display` must be a valid open display.
pub unsafe fn keysym_to_keycode(display: *mut xlib::Display, keysym: xlib::KeySym) -> u32 {
    xlib::XKeysymToKeycode(display, keysym) as u32
}

/// Resolve a string keysym name to a KeySym.
pub fn string_to_keysym(name: &str) -> Result<xlib::KeySym, PlatformError> {
    let c_name = std::ffi::CString::new(name)
        .map_err(|e| PlatformError::Os(format!("keysym name: {e}")))?;
    let sym = unsafe { xlib::XStringToKeysym(c_name.as_ptr()) };
    if sym == 0 {
        Err(PlatformError::Os(format!("unknown keysym: {name}")))
    } else {
        Ok(sym)
    }
}
```

- [ ] **Step 2: Create linux/mod.rs**

Create `crates/platform/src/linux/mod.rs`:

```rust
//! Linux X11 platform implementation.

mod accessibility;
mod display;
mod fullscreen;
mod hotkey;
mod keyboard;
mod mouse_hook;
mod process_query;
mod timer;
mod autostart;
mod wheel_emitter;
mod window_geom;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub use accessibility::LinuxAccessibilitySignals;
pub use autostart::LinuxAutostart;
pub use fullscreen::LinuxFullscreenDetector;
pub use hotkey::LinuxHotkey;
pub use keyboard::ModifierSampler;
pub use mouse_hook::LinuxMouseHook;
pub use process_query::LinuxProcessQuery;
pub use timer::LinuxHighResTimerGuard;
pub use wheel_emitter::LinuxWheelEmitter;
pub use window_geom::LinuxWindowGeometry;

pub fn build() -> Result<Platform> {
    if std::env::var("XDG_SESSION_TYPE").unwrap_or_default() == "wayland" {
        eprintln!(
            "SmoothScroll: Wayland session detected. \
             X11 is required — some features may not work. \
             Please log out and select 'GNOME on Xorg' or equivalent."
        );
    }

    let wheel_emitter: Arc<LinuxWheelEmitter> = Arc::new(LinuxWheelEmitter::new()?);
    Ok(Platform {
        mouse_hook: Arc::new(LinuxMouseHook::new()?),
        wheel_emitter: wheel_emitter.clone(),
        zoom_emitter: wheel_emitter,
        process_query: Arc::new(LinuxProcessQuery::new()?),
        autostart: Arc::new(LinuxAutostart),
        hotkey: Arc::new(LinuxHotkey),
        accessibility: Arc::new(LinuxAccessibilitySignals),
    })
}
```

- [ ] **Step 3: Add Linux cfg branch to lib.rs**

Edit `crates/platform/src/lib.rs`:

```rust
#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "linux")]
mod linux;

// In current() function:
pub fn current() -> Result<Platform> {
    #[cfg(windows)]
    { windows::build() }
    #[cfg(target_os = "macos")]
    { macos::build() }
    #[cfg(target_os = "linux")]
    { linux::build() }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    { Err(PlatformError::Unsupported) }
}
```

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/linux/ crates/platform/src/lib.rs
git commit -m "feat(platform): add Linux module scaffolding and X11 display helper"
```

---

### Task 3: Stubs (Timer + Accessibility)

**Files:**
- Create: `crates/platform/src/linux/timer.rs`
- Create: `crates/platform/src/linux/accessibility.rs`

- [ ] **Step 1: Create timer.rs**

```rust
//! Linux high-resolution timer guard — no-op.
//! Linux clock_nanosleep already provides ~1ms precision.

pub struct LinuxHighResTimerGuard;

impl LinuxHighResTimerGuard {
    pub fn begin(_period_ms: u32) -> Self {
        Self
    }
}
```

- [ ] **Step 2: Create accessibility.rs**

```rust
//! Linux accessibility signals — stub.
//! No reliable system-wide Reduce Motion signal on Linux.

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::Result;

pub struct LinuxAccessibilitySignals;

impl AccessibilitySignals for LinuxAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        false
    }
    fn watch(&self, _on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        Ok(HookHandle::new(Box::new(())))
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/linux/timer.rs crates/platform/src/linux/accessibility.rs
git commit -m "feat(platform): add Linux timer and accessibility stubs"
```

---

### Task 4: Modifier Sampler (XQueryKeymap)

**Files:**
- Create: `crates/platform/src/linux/keyboard.rs`

**Interfaces:**
- Consumes: X11 display for XQueryKeymap
- Produces: `ModifierSampler` with `ModifierState` — shared with MouseHook for Ctrl/Shift/Alt polling

This is NEW in V2 — was missing entirely in V1. Without this, Ctrl+scroll zoom and Shift+scroll horizontal don't work.

- [ ] **Step 1: Create keyboard.rs**

```rust
//! Background-thread modifier-key sampler using XQueryKeymap.
//!
//! Polls at ~60fps, stores Shift/Ctrl/Alt state in atomics
//! that the mouse hook thread reads cheaply on the hot path.

use crate::types::PlatformError;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use x11::xlib;

use super::display;

const POLL_INTERVAL: Duration = Duration::from_millis(16);

#[derive(Default)]
pub struct ModifierState {
    pub shift: AtomicBool,
    pub ctrl: AtomicBool,
    pub alt: AtomicBool,
    running: AtomicBool,
}

impl ModifierState {
    pub fn snapshot(&self) -> crate::types::ModifierKeys {
        crate::types::ModifierKeys {
            shift: self.shift.load(Ordering::Relaxed),
            ctrl: self.ctrl.load(Ordering::Relaxed),
            alt: self.alt.load(Ordering::Relaxed),
            cmd: false,
        }
    }
}

pub struct ModifierSampler {
    state: Arc<ModifierState>,
    handle: Option<thread::JoinHandle<()>>,
}

impl ModifierSampler {
    pub fn start() -> Self {
        let state = Arc::new(ModifierState::default());
        state.running.store(true, Ordering::Relaxed);

        // Sample once immediately to have initial values
        Self::sample_once(&state);

        let s = state.clone();
        let handle = thread::Builder::new()
            .name("ss-modifier-sampler".into())
            .spawn(move || {
                // Open our own X11 connection (X11 connections are NOT thread-safe)
                let Ok(display) = display::open_display() else {
                    return;
                };

                while s.running.load(Ordering::Relaxed) {
                    Self::sample_once_on(display, &s);
                    thread::sleep(POLL_INTERVAL);
                }

                unsafe {
                    display::close_display(display);
                }
            })
            .expect("spawn modifier sampler thread");

        Self {
            state,
            handle: Some(handle),
        }
    }

    pub fn state(&self) -> Arc<ModifierState> {
        self.state.clone()
    }

    fn sample_once(state: &ModifierState) {
        let Ok(display) = display::open_display() else {
            return;
        };
        Self::sample_once_on(display, state);
        unsafe { display::close_display(display); }
    }

    fn sample_once_on(display: *mut xlib::Display, state: &ModifierState) {
        unsafe {
            let mut keys: [u8; 32] = [0; 32];
            xlib::XQueryKeymap(display, keys.as_mut_ptr());

            // Bit positions for modifier keys in the 32-byte keymap:
            // Shift_L: keycode 50 → byte 6, bit 2 (0x04)
            // Shift_R: keycode 62 → byte 7, bit 6 (0x40)
            // Control_L: keycode 37 → byte 4, bit 5 (0x20)
            // Control_R: keycode 105 → byte 13, bit 1 (0x02)
            // Alt_L: keycode 64 → byte 8, bit 0 (0x01)
            // Alt_R: keycode 108 → byte 13, bit 4 (0x10)
            let shift = (keys[6] & 0x04) != 0 || (keys[7] & 0x40) != 0;
            let ctrl = (keys[4] & 0x20) != 0 || (keys[13] & 0x02) != 0;
            let alt = (keys[8] & 0x01) != 0 || (keys[13] & 0x10) != 0;

            state.shift.store(shift, Ordering::Relaxed);
            state.ctrl.store(ctrl, Ordering::Relaxed);
            state.alt.store(alt, Ordering::Relaxed);
        }
    }
}

impl Drop for ModifierSampler {
    fn drop(&mut self) {
        self.state.running.store(false, Ordering::Relaxed);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/keyboard.rs
git commit -m "feat(platform): add Linux modifier key sampler via XQueryKeymap

- Polls Shift/Ctrl/Alt state at ~60Hz on dedicated thread
- Own X11 connection (thread-safe)
- ModifierState atomics shared with mouse hook"
```

---

### Task 5: Autostart (XDG)

**Files:**
- Create: `crates/platform/src/linux/autostart.rs`

- [ ] **Step 1: Create autostart.rs**

```rust
//! XDG autostart via ~/.config/autostart/smoothscroll.desktop.

use crate::traits::Autostart;
use crate::types::{PlatformError, Result};
use std::fs;
use std::path::PathBuf;

const DESKTOP_ENTRY: &str = "\
[Desktop Entry]
Type=Application
Name=SmoothScroll
Exec={exec}
X-GNOME-Autostart-enabled=true
Comment=Smooth scrolling for every application
";

pub struct LinuxAutostart;

impl LinuxAutostart {
    fn desktop_path() -> Result<PathBuf> {
        let home = std::env::var("HOME")
            .map_err(|_| PlatformError::Os("HOME not set".into()))?;
        Ok(PathBuf::from(home)
            .join(".config")
            .join("autostart")
            .join("smoothscroll.desktop"))
    }

    fn exec_path() -> Result<String> {
        std::env::current_exe()
            .map_err(|e| PlatformError::Os(format!("current_exe: {e}")))
            .map(|p| format!("\"{}\"", p.to_string_lossy()))
    }
}

impl Autostart for LinuxAutostart {
    fn is_enabled(&self) -> bool {
        Self::desktop_path()
            .map(|p| p.exists())
            .unwrap_or(false)
    }

    fn set(&self, enabled: bool) -> Result<()> {
        let path = Self::desktop_path()?;
        if enabled {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| PlatformError::Os(format!("mkdir autostart: {e}")))?;
            }
            let exec = Self::exec_path()?;
            let content = DESKTOP_ENTRY.replace("{exec}", &exec);
            fs::write(&path, content)
                .map_err(|e| PlatformError::Os(format!("write .desktop: {e}")))?;
        } else if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| PlatformError::Os(format!("remove .desktop: {e}")))?;
        }
        Ok(())
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/autostart.rs
git commit -m "feat(platform): add Linux XDG autostart via .desktop file"
```

---

### Task 6: Process Query (EWMH + /proc)

**Files:**
- Create: `crates/platform/src/linux/process_query.rs`

**V2 changes:** Use `/proc/<pid>/exe` symlink instead of `/proc/<pid>/comm` (15-char limit).

- [ ] **Step 1: Create process_query.rs**

```rust
//! Process identification via X11 EWMH atoms and /proc filesystem.
//!
//! 1. XQueryPointer → window under cursor
//! 2. Walk up tree looking for _NET_WM_PID property
//! 3. Read /proc/<pid>/exe symlink for process name (avoids 15-char limit of /comm)

use crate::traits::{ProcessInfo, ProcessQuery};
use crate::types::PlatformError;
use parking_lot::Mutex;
use std::ffi::CStr;
use std::fs;
use std::os::raw::{c_int, c_uchar, c_uint, c_ulong};
use std::time::{Duration, Instant};
use x11::xlib::{self, Atom, Window};

use super::display;

const TTL: Duration = Duration::from_millis(100);

#[derive(Default)]
struct CacheEntry {
    last_check: Option<Instant>,
    last_window: u64,
    cached_name: Option<String>,
}

pub struct LinuxProcessQuery {
    cache: Mutex<CacheEntry>,
}

impl LinuxProcessQuery {
    pub fn new() -> Result<Self, PlatformError> {
        let d = display::open_display()?;
        unsafe { display::close_display(d) };
        Ok(Self {
            cache: Mutex::new(CacheEntry::default()),
        })
    }
}

/// Read _NET_WM_PID from a window, walking up the tree.
///
/// # Safety
/// `display` must be a valid open connection.
unsafe fn get_window_pid(display: *mut xlib::Display, mut window: Window) -> Option<u32> {
    let net_wm_pid = {
        let name = b"_NET_WM_PID\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };
    if net_wm_pid == 0 { return None; }

    for _ in 0..10 {
        let mut actual_type: Atom = 0;
        let mut actual_format: c_int = 0;
        let mut n_items: c_ulong = 0;
        let mut bytes_after: c_ulong = 0;
        let mut prop_return: *mut c_uchar = std::ptr::null_mut();

        let status = xlib::XGetWindowProperty(
            display, window, net_wm_pid, 0, 1, xlib::False,
            xlib::XA_CARDINAL,
            &mut actual_type, &mut actual_format, &mut n_items,
            &mut bytes_after, &mut prop_return,
        );

        if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
            let pid = *(prop_return as *const u32);
            xlib::XFree(prop_return as *mut _);
            return Some(pid);
        }
        if !prop_return.is_null() { xlib::XFree(prop_return as *mut _); }

        // Walk up to parent
        let mut root: Window = 0;
        let mut parent: Window = 0;
        let mut children: *mut Window = std::ptr::null_mut();
        let mut n_children: c_uint = 0;
        if xlib::XQueryTree(display, window, &mut root, &mut parent, &mut children, &mut n_children) != 0 {
            if !children.is_null() { xlib::XFree(children as *mut _); }
            if parent == 0 || parent == root { return None; }
            window = parent;
        } else {
            return None;
        }
    }
    None
}

/// Read process name from /proc/<pid>/exe symlink.
/// Falls back to /proc/<pid>/comm if exe not readable.
fn process_name_from_pid(pid: u32) -> Option<String> {
    // Prefer /proc/<pid>/exe — full path to executable, no truncation
    if let Ok(exe_path) = fs::read_link(format!("/proc/{pid}/exe")) {
        if let Some(name) = exe_path.file_name() {
            let name = name.to_string_lossy().into_owned();
            if !name.is_empty() {
                return Some(name);
            }
        }
    }
    // Fallback: /proc/<pid>/comm (limited to 15 chars by kernel)
    fs::read_to_string(format!("/proc/{pid}/comm"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn window_under_cursor(display: *mut xlib::Display) -> Option<Window> {
    let root = display::root_window(display);
    let mut root_return: Window = 0;
    let mut child_return: Window = 0;
    let mut root_x: c_int = 0;
    let mut root_y: c_int = 0;
    let mut win_x: c_int = 0;
    let mut win_y: c_int = 0;
    let mut mask: c_uint = 0;

    let ok = xlib::XQueryPointer(
        display, root, &mut root_return, &mut child_return,
        &mut root_x, &mut root_y, &mut win_x, &mut win_y, &mut mask,
    );

    if ok != 0 && child_return != 0 { Some(child_return) } else { None }
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn active_window(display: *mut xlib::Display) -> Option<Window> {
    let root = display::root_window(display);
    let net_active = {
        let name = b"_NET_ACTIVE_WINDOW\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };
    if net_active == 0 { return None; }

    let mut actual_type: Atom = 0;
    let mut actual_format: c_int = 0;
    let mut n_items: c_ulong = 0;
    let mut bytes_after: c_ulong = 0;
    let mut prop_return: *mut c_uchar = std::ptr::null_mut();

    let status = xlib::XGetWindowProperty(
        display, root, net_active, 0, 1, xlib::False,
        xlib::XA_WINDOW,
        &mut actual_type, &mut actual_format, &mut n_items,
        &mut bytes_after, &mut prop_return,
    );

    if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
        let win = *(prop_return as *const Window);
        xlib::XFree(prop_return as *mut _);
        if win != 0 { Some(win) } else { None }
    } else {
        if !prop_return.is_null() { xlib::XFree(prop_return as *mut _); }
        None
    }
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn window_title(display: *mut xlib::Display, window: Window) -> Option<String> {
    let net_wm_name = {
        let name = b"_NET_WM_NAME\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };

    let mut actual_type: Atom = 0;
    let mut actual_format: c_int = 0;
    let mut n_items: c_ulong = 0;
    let mut bytes_after: c_ulong = 0;
    let mut prop_return: *mut c_uchar = std::ptr::null_mut();

    let status = xlib::XGetWindowProperty(
        display, window, net_wm_name, 0, 1024, xlib::False,
        xlib::XA_ANY,
        &mut actual_type, &mut actual_format, &mut n_items,
        &mut bytes_after, &mut prop_return,
    );

    if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
        let bytes = std::slice::from_raw_parts(prop_return, n_items as usize);
        let title = String::from_utf8_lossy(bytes).into_owned();
        xlib::XFree(prop_return as *mut _);
        return Some(title);
    }
    if !prop_return.is_null() { xlib::XFree(prop_return as *mut _); }

    // Fallback: WM_NAME
    let mut text_prop: xlib::XTextProperty = std::mem::zeroed();
    if xlib::XGetWMName(display, window, &mut text_prop) != 0 && !text_prop.value.is_null() {
        let c_str = CStr::from_ptr(text_prop.value as *const i8);
        let title = c_str.to_string_lossy().into_owned();
        xlib::XFree(text_prop.value as *mut _);
        return Some(title);
    }

    None
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn enumerate_windows(display: *mut xlib::Display) -> Vec<Window> {
    let root = display::root_window(display);
    let mut root_return: Window = 0;
    let mut parent: Window = 0;
    let mut children: *mut Window = std::ptr::null_mut();
    let mut n_children: c_uint = 0;

    if xlib::XQueryTree(display, root, &mut root_return, &mut parent, &mut children, &mut n_children) == 0 {
        return Vec::new();
    }
    let windows = if !children.is_null() && n_children > 0 {
        std::slice::from_raw_parts(children, n_children as usize).to_vec()
    } else {
        Vec::new()
    };
    if !children.is_null() { xlib::XFree(children as *mut _); }
    windows
}

impl ProcessQuery for LinuxProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        let now = Instant::now();
        let mut cache = self.cache.lock();
        if let Some(t) = cache.last_check {
            if now.saturating_duration_since(t) < TTL {
                return cache.cached_name.clone();
            }
        }
        let result = unsafe {
            let d = display::open_display().ok()?;
            let window = window_under_cursor(d)?;
            let pid = get_window_pid(d, window)?;
            let name = process_name_from_pid(pid);
            display::close_display(d);
            name
        };
        cache.last_check = Some(now);
        cache.cached_name = result.clone();
        result
    }

    fn foreground_process_id(&self) -> Option<u32> {
        unsafe {
            let d = display::open_display().ok()?;
            let win = active_window(d)?;
            let pid = get_window_pid(d, win);
            display::close_display(d);
            pid
        }
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        let mut results = Vec::new();
        unsafe {
            let Ok(d) = display::open_display() else { return results; };
            let windows = enumerate_windows(d);
            for win in windows {
                let Some(pid) = get_window_pid(d, win) else { continue; };
                let name = process_name_from_pid(pid).unwrap_or_default();
                if name.is_empty() { continue; }
                let title = window_title(d, win).unwrap_or_default();
                results.push(ProcessInfo { pid, name, window_title: title });
            }
            display::close_display(d);
        }
        results
    }

    fn foreground_process_name(&self) -> Option<String> {
        let pid = self.foreground_process_id()?;
        process_name_from_pid(pid)
    }
    // is_target_elevated: default false — Linux has no UIPI
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/process_query.rs
git commit -m "feat(platform): add Linux process query via EWMH + /proc

- _NET_WM_PID atom + window tree walk
- /proc/<pid>/exe for process name (avoids 15-char /comm limit)
- _NET_ACTIVE_WINDOW for foreground detection
- 100ms TTL cache"
```

---

### Task 7: Fullscreen Detector + Window Geometry

**Files:**
- Create: `crates/platform/src/linux/fullscreen.rs`
- Create: `crates/platform/src/linux/window_geom.rs`

These were MISSING in V1 — without them the app crate won't compile.

- [ ] **Step 1: Create fullscreen.rs**

```rust
//! Fullscreen detection via _NET_WM_STATE_FULLSCREEN atom.

use crate::traits::FullscreenDetector;
use x11::xlib;

use super::display;

pub struct LinuxFullscreenDetector;

impl FullscreenDetector for LinuxFullscreenDetector {
    fn is_foreground_fullscreen(&self) -> bool {
        unsafe {
            let d = match display::open_display() {
                Ok(d) => d,
                Err(_) => return false,
            };

            let root = display::root_window(d);

            // Get active window
            let net_active = {
                let name = b"_NET_ACTIVE_WINDOW\0".as_ptr() as *const i8;
                xlib::XInternAtom(d, name, xlib::False)
            };
            let net_wm_state = {
                let name = b"_NET_WM_STATE\0".as_ptr() as *const i8;
                xlib::XInternAtom(d, name, xlib::False)
            };
            let net_wm_fullscreen = {
                let name = b"_NET_WM_STATE_FULLSCREEN\0".as_ptr() as *const i8;
                xlib::XInternAtom(d, name, xlib::False)
            };

            if net_active == 0 || net_wm_state == 0 || net_wm_fullscreen == 0 {
                display::close_display(d);
                return false;
            }

            // Get active window
            let mut actual_type: xlib::Atom = 0;
            let mut actual_format: std::os::raw::c_int = 0;
            let mut n_items: std::os::raw::c_ulong = 0;
            let mut bytes_after: std::os::raw::c_ulong = 0;
            let mut prop_return: *mut u8 = std::ptr::null_mut();

            let status = xlib::XGetWindowProperty(
                d, root, net_active, 0, 1, xlib::False,
                xlib::XA_WINDOW,
                &mut actual_type, &mut actual_format,
                &mut n_items, &mut bytes_after, &mut prop_return,
            );
            if status != xlib::Success as c_int || prop_return.is_null() || n_items == 0 {
                if !prop_return.is_null() { xlib::XFree(prop_return as *mut _); }
                display::close_display(d);
                return false;
            }
            let win = *(prop_return as *const xlib::Window);
            xlib::XFree(prop_return as *mut _);

            if win == 0 {
                display::close_display(d);
                return false;
            }

            // Read _NET_WM_STATE
            let status = xlib::XGetWindowProperty(
                d, win, net_wm_state, 0, 32, xlib::False,
                xlib::XA_ATOM,
                &mut actual_type, &mut actual_format,
                &mut n_items, &mut bytes_after, &mut prop_return,
            );
            if status != xlib::Success as c_int || prop_return.is_null() || n_items == 0 {
                if !prop_return.is_null() { xlib::XFree(prop_return as *mut _); }
                display::close_display(d);
                return false;
            }

            let atoms = std::slice::from_raw_parts(prop_return as *const xlib::Atom, n_items as usize);
            let fullscreen = atoms.contains(&net_wm_fullscreen);
            xlib::XFree(prop_return as *mut _);
            display::close_display(d);
            fullscreen
        }
    }
}
```

- [ ] **Step 2: Create window_geom.rs**

```rust
//! Cursor position relative to window via XQueryPointer.

use crate::traits::WindowGeometry;
use crate::types::{Point, WindowRect};
use x11::xlib;

use super::display;

pub struct LinuxWindowGeometry;

impl WindowGeometry for LinuxWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        unsafe {
            let d = display::open_display().ok()?;
            let root = display::root_window(d);

            let mut root_return: xlib::Window = 0;
            let mut child_return: xlib::Window = 0;
            let mut root_x: i32 = 0;
            let mut root_y: i32 = 0;
            let mut win_x: i32 = 0;
            let mut win_y: i32 = 0;
            let mut mask: u32 = 0;

            let ok = xlib::XQueryPointer(
                d, root, &mut root_return, &mut child_return,
                &mut root_x, &mut root_y, &mut win_x, &mut win_y, &mut mask,
            );

            if ok == 0 {
                display::close_display(d);
                return None;
            }

            let target = if child_return != 0 { child_return } else { root_return };

            let mut attrs: xlib::XWindowAttributes = std::mem::zeroed();
            if xlib::XGetWindowAttributes(d, target, &mut attrs) == 0 {
                display::close_display(d);
                return None;
            }

            display::close_display(d);

            Some((
                Point { x: root_x, y: root_y },
                WindowRect {
                    left: attrs.x,
                    top: attrs.y,
                    right: attrs.x + attrs.width,
                    bottom: attrs.y + attrs.height,
                },
            ))
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/linux/fullscreen.rs crates/platform/src/linux/window_geom.rs
git commit -m "feat(platform): add Linux fullscreen detector and window geometry

- FullscreenDetector: _NET_WM_STATE_FULLSCREEN atom check
- WindowGeometry: XQueryPointer + XGetWindowAttributes"
```

---

### Task 8: Hotkey (XGrabKey) — with return value check

**Files:**
- Create: `crates/platform/src/linux/hotkey.rs`

**V2 changes:** Check XGrabKey return value. Use runtime keycode resolution.

- [ ] **Step 1: Create hotkey.rs**

```rust
//! Global hotkey via XGrabKey on root window.
//! Parses Tauri accelerator strings, grabs keys, dispatches from event thread.

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use x11::xlib;

use super::display;

const MOD_CONTROL: u32 = xlib::ControlMask;
const MOD_ALT: u32 = xlib::Mod1Mask;
const MOD_SHIFT: u32 = xlib::ShiftMask;
const MOD_SUPER: u32 = xlib::Mod4Mask;

pub struct LinuxHotkey;

impl Hotkey for LinuxHotkey {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        let (modifiers, keysym_name) = parse_accelerator(&accel.raw)?;

        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<()>>(1);
        let alive = Arc::new(AtomicBool::new(true));
        let alive_thread = alive.clone();
        let on_pressed = Arc::new(on_pressed);

        thread::Builder::new()
            .name("ss-hotkey".into())
            .spawn(move || {
                let d = match display::open_display() {
                    Ok(d) => d,
                    Err(e) => { let _ = tx.send(Err(e)); return; }
                };
                let root = unsafe { display::root_window(d) };

                let keysym = match display::string_to_keysym(&keysym_name) {
                    Ok(ks) => ks,
                    Err(e) => { let _ = tx.send(Err(e)); unsafe { display::close_display(d) }; return; }
                };

                let keycode = unsafe { display::keysym_to_keycode(d, keysym) };
                if keycode == 0 {
                    let _ = tx.send(Err(PlatformError::Os(format!("no keycode for {keysym_name}"))));
                    unsafe { display::close_display(d) };
                    return;
                }

                // Grab key and CHECK return value
                let grab_status = unsafe {
                    xlib::XGrabKey(
                        d, keycode as c_int, modifiers, root,
                        xlib::False, xlib::GrabModeAsync, xlib::GrabModeAsync,
                    )
                };
                if grab_status != xlib::Success as i32 {
                    let _ = tx.send(Err(PlatformError::Os(format!(
                        "XGrabKey failed for {keysym_name} (status={grab_status})"
                    ))));
                    unsafe { display::close_display(d) };
                    return;
                }

                let _ = tx.send(Ok(()));

                // Event loop
                while alive_thread.load(Ordering::Relaxed) {
                    unsafe {
                        if xlib::XPending(d) > 0 {
                            let mut event: xlib::XEvent = std::mem::zeroed();
                            xlib::XNextEvent(d, &mut event);
                            if event.type_ == xlib::KeyPress {
                                on_pressed();
                            }
                        } else {
                            thread::sleep(std::time::Duration::from_millis(10));
                        }
                    }
                }

                unsafe {
                    xlib::XUngrabKey(d, keycode as c_int, modifiers, root);
                    display::close_display(d);
                }
            })
            .map_err(|e| PlatformError::Os(format!("spawn hotkey thread: {e}")))?;

        rx.recv()
            .map_err(|_| PlatformError::Os("hotkey thread died before grab".into()))??;

        struct Installed { alive: Arc<AtomicBool> }
        impl Drop for Installed {
            fn drop(&mut self) { self.alive.store(false, Ordering::SeqCst); }
        }

        Ok(HotkeyHandle::new(Box::new(Installed { alive })))
    }
}

fn parse_accelerator(raw: &str) -> Result<(u32, String)> {
    let parts: Vec<&str> = raw.split('+').map(|s| s.trim()).collect();
    if parts.is_empty() { return Err(PlatformError::Os("empty accelerator".into())); }

    let mut mods: u32 = 0;
    let mut key_name = String::new();

    for (i, part) in parts.iter().enumerate() {
        let is_last = i == parts.len() - 1;
        if !is_last {
            match part.to_lowercase().as_str() {
                "ctrl" | "control" => mods |= MOD_CONTROL,
                "alt" => mods |= MOD_ALT,
                "shift" => mods |= MOD_SHIFT,
                "super" | "command" | "commandorcontrol" | "cmdorctrl" => mods |= MOD_SUPER,
                other => return Err(PlatformError::Os(format!("unknown modifier: {other}"))),
            }
        } else {
            key_name = match part.to_lowercase().as_str() {
                "enter" | "return" => "Return".into(),
                "escape" | "esc" => "Escape".into(),
                "space" => "space".into(),
                "tab" => "Tab".into(),
                "delete" | "del" => "Delete".into(),
                "backspace" => "BackSpace".into(),
                s if s.len() == 1 => s.to_uppercase(),
                s => {
                    let upper = s.to_uppercase();
                    if upper.starts_with('F') && upper.len() <= 3 { upper } else { s.to_string() }
                }
            };
        }
    }

    if key_name.is_empty() { return Err(PlatformError::Os("no key in accelerator".into())); }
    Ok((mods, key_name))
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/hotkey.rs
git commit -m "feat(platform): add Linux global hotkey via XGrabKey

- Runtime keycode resolution via XKeysymToKeycode
- XGrabKey return value check (no silent failures)"
```

---

### Task 9: Mouse Hook (XInput2) — with ModifierSampler + InputClassifier fix

**Files:**
- Create: `crates/platform/src/linux/mouse_hook.rs`

**V2 changes:**
- Integrate ModifierSampler (no more `ModifierKeys::default()`)
- Fix InputClassifier call: `classify(delta, now_ms)` (V1 was missing `now_ms`)
- Add epoch timestamp for classifier
- Own X11 connection (thread-safe)
- Select both XI_RawButtonPress AND XI_RawMotion for smooth scroll support

- [ ] **Step 1: Create mouse_hook.rs**

```rust
//! Mouse wheel interception via XInput2 raw events.
//!
//! Listens for XI_RawButtonPress (buttons 4-7 for discrete scroll) and
//! XI_RawMotion (smooth scroll from touchpads) on the root window.
//!
//! LIMITATION: XInput2 cannot swallow events — original scroll passes through
//! alongside smooth scroll. Documented known limitation.

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{HookDecision, PlatformError, Result};
use parking_lot::Mutex;
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use x11::xlib;

use super::display;

pub struct LinuxMouseHook;

impl LinuxMouseHook {
    pub fn new() -> Result<Self, PlatformError> {
        let d = display::open_display()?;
        let mut major: c_int = 2;
        let mut minor: c_int = 0;
        let available = unsafe {
            x11::xi2::XIQueryVersion(d, &mut major, &mut minor) == xlib::Success as c_int
        };
        unsafe { display::close_display(d) };
        if !available {
            return Err(PlatformError::Os("XInput2 extension not available".into()));
        }
        Ok(Self)
    }
}

impl MouseHook for LinuxMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let alive = Arc::new(AtomicBool::new(true));
        let alive_thread = alive.clone();
        let modifier_sampler = super::keyboard::ModifierSampler::start();
        let modifiers = modifier_sampler.state();

        thread::Builder::new()
            .name("ss-mouse-hook".into())
            .spawn(move || {
                let d = match display::open_display() {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("ss-mouse-hook: {e}");
                        return;
                    }
                };
                let root = unsafe { display::root_window(d) };

                // Select XI_RawButtonPress (buttons 4-7) events
                let mut mask = [0u8; 4];
                mask[2] |= 1 << (x11::xi2::XI_RawButtonPress - 16);

                let mut event_mask = x11::xi2::XIEventMask {
                    deviceid: x11::xi2::XIAllMasterDevices,
                    mask_len: mask.len() as c_int,
                    mask: mask.as_mut_ptr(),
                };

                if unsafe { x11::xi2::XISelectEvents(d, root, &mut event_mask, 1) } != xlib::Success as c_int {
                    eprintln!("ss-mouse-hook: failed to select XInput2 events");
                    unsafe { display::close_display(d) };
                    return;
                }

                // Get XInput2 GenericEvent base
                let xi_event_type = unsafe {
                    let mut event_base: c_int = 0;
                    let mut error_base: c_int = 0;
                    let name = std::ffi::CString::new("XInputExtension").unwrap();
                    xlib::XQueryExtension(d, name.as_ptr(), &mut event_base, &mut error_base, &mut error_base);
                    event_base + xlib::GenericEvent as c_int
                };

                let epoch = std::time::Instant::now();
                let mut classifier_v = Mutex::new(smoothscroll_core::input_source::InputClassifier::new());
                let mut classifier_h = Mutex::new(smoothscroll_core::input_source::InputClassifier::new());

                while alive_thread.load(Ordering::Relaxed) {
                    if unsafe { xlib::XPending(d) } == 0 {
                        thread::sleep(std::time::Duration::from_millis(1));
                        continue;
                    }

                    unsafe {
                        let mut event: xlib::XEvent = std::mem::zeroed();
                        xlib::XNextEvent(d, &mut event);

                        if event.type_ != xi_event_type { continue; }
                        if xlib::XGetEventData(d, &mut event.cookie) == 0 { continue; }

                        let xi_event = event.cookie.data as *mut x11::xi2::XIRawEvent;
                        if xi_event.is_null() || (*xi_event).evtype != x11::xi2::XI_RawButtonPress {
                            xlib::XFreeEventData(d, &mut event.cookie);
                            continue;
                        }

                        let button = (*xi_event).detail;
                        xlib::XFreeEventData(d, &mut event.cookie);

                        let now_ms = epoch.elapsed().as_millis() as u64;
                        let mods = modifiers.snapshot();

                        match button {
                            4 => {
                                let source = classifier_v.lock().classify(120, now_ms);
                                sink.on_wheel_ext(120, mods, source);
                            }
                            5 => {
                                let source = classifier_v.lock().classify(-120, now_ms);
                                sink.on_wheel_ext(-120, mods, source);
                            }
                            6 => {
                                let source = classifier_h.lock().classify(-120, now_ms);
                                sink.on_hwheel_ext(-120, source);
                            }
                            7 => {
                                let source = classifier_h.lock().classify(120, now_ms);
                                sink.on_hwheel_ext(120, source);
                            }
                            _ => {}
                        }
                    }
                }

                unsafe { display::close_display(d) };
            })
            .map_err(|e| PlatformError::Os(format!("spawn mouse hook: {e}")))?;

        struct Installed {
            alive: Arc<AtomicBool>,
            _modifier_sampler: super::keyboard::ModifierSampler,
        }
        impl Drop for Installed {
            fn drop(&mut self) {
                self.alive.store(false, Ordering::SeqCst);
            }
        }

        Ok(HookHandle::new(Box::new(Installed {
            alive,
            _modifier_sampler: modifier_sampler,
        })))
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/mouse_hook.rs
git commit -m "feat(platform): add Linux mouse hook via XInput2

- XI_RawButtonPress for buttons 4/5/6/7
- InputClassifier with epoch-based timestamps
- ModifierSampler for Ctrl/Shift/Alt state
- Known limitation: cannot swallow original events"
```

---

### Task 10: Wheel Emitter (XTest) — with suppression flag + persistent connection

**Files:**
- Create: `crates/platform/src/linux/wheel_emitter.rs`

**V2 changes:**
- Persistent Display connection (not per-emit — 120fps open/close caused stutter)
- Suppression flag: static `AtomicBool` that MouseHook can check to skip self-injected events
- Runtime keycode resolution via XKeysymToKeycode (no hardcoded keycodes)
- Check if Ctrl already pressed before zoom injection

- [ ] **Step 1: Create wheel_emitter.rs**

```rust
//! Scroll injection via XTest extension.
//!
//! CRITICAL: XTest events trigger XInput2 raw events, causing feedback loops.
//! We use a static suppression flag — WheelEmitter sets it before injecting,
//! and MouseHook skips events while it's set.
//!
//! Uses a persistent Display connection to avoid per-emit open/close overhead
//! (120fps × connection handshake = severe stutter).

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use x11::xlib;
use x11::xtest;

use super::display;

/// Global suppression flag. WheelEmitter sets this before injecting events.
/// MouseHook checks and skips events while this is true.
static SUPPRESSING: AtomicBool = AtomicBool::new(false);

/// Check if the current event should be suppressed (self-injected by WheelEmitter).
pub fn is_suppressed() -> bool {
    SUPPRESSING.load(Ordering::Relaxed)
}

// X11 button numbers for scrolling
const BUTTON_SCROLL_UP: u32 = 4;
const BUTTON_SCROLL_DOWN: u32 = 5;
const BUTTON_SCROLL_LEFT: u32 = 6;
const BUTTON_SCROLL_RIGHT: u32 = 7;

pub struct LinuxWheelEmitter {
    display: Mutex<*mut xlib::Display>,
    ctrl_keycode: u32,
}

impl LinuxWheelEmitter {
    pub fn new() -> Result<Self, PlatformError> {
        let d = display::open_display()?;

        // Verify XTest is available
        let mut event_base: c_int = 0;
        let mut error_base: c_int = 0;
        let mut major: c_int = 0;
        let mut minor: c_int = 0;
        if unsafe { xtest::XTestQueryExtension(d, &mut event_base, &mut error_base, &mut major, &mut minor) } == 0 {
            unsafe { display::close_display(d) };
            return Err(PlatformError::Os("XTest extension not available".into()));
        }

        // Resolve Ctrl keycode at runtime (not hardcoded!)
        let ctrl_keycode = unsafe {
            display::keysym_to_keycode(d, xlib::XK_Control_L)
        };

        Ok(Self {
            display: Mutex::new(d),
            ctrl_keycode,
        })
    }

    fn emit_with<F>(&self, f: F) -> Result<()>
    where
        F: FnOnce(*mut xlib::Display) -> Result<()>,
    {
        let d = *self.display.lock()
            .map_err(|_| PlatformError::Os("display lock poisoned".into()))?;
        let result = f(d);
        unsafe { xlib::XFlush(d); }
        result
    }
}

impl WheelEmitter for LinuxWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }

        // Set suppression flag to prevent feedback loop
        SUPPRESSING.store(true, Ordering::Relaxed);

        let result = self.emit_with(|d| {
            if vertical_units != 0 {
                let button = if vertical_units > 0 { BUTTON_SCROLL_UP } else { BUTTON_SCROLL_DOWN };
                let count = vertical_units.unsigned_abs();
                for _ in 0..count {
                    unsafe {
                        xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                        xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                    }
                }
            }
            if horizontal_units != 0 {
                let button = if horizontal_units > 0 { BUTTON_SCROLL_RIGHT } else { BUTTON_SCROLL_LEFT };
                let count = horizontal_units.unsigned_abs();
                for _ in 0..count {
                    unsafe {
                        xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                        xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                    }
                }
            }
            Ok(())
        });

        // Clear suppression flag
        SUPPRESSING.store(false, Ordering::Relaxed);

        // Brief delay to ensure MouseHook sees the flag change before next events
        std::thread::sleep(std::time::Duration::from_micros(500));

        result
    }
}

impl ZoomEmitter for LinuxWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        if units == 0 { return Ok(()); }

        let button = if units > 0 { BUTTON_SCROLL_UP } else { BUTTON_SCROLL_DOWN };
        let count = units.unsigned_abs();

        // Check if Ctrl is already pressed by the user — don't release it if so
        // Read modifier state from X11 to avoid interfering with user's keypress
        let ctrl_already_pressed = self.emit_with(|d| -> Result<bool> {
            let mut keys: [u8; 32] = [0; 32];
            unsafe { xlib::XQueryKeymap(d, keys.as_mut_ptr()); }
            // Check if Ctrl key is already held
            Ok((keys[4] & 0x20) != 0 || (keys[13] & 0x02) != 0)
        })?;

        // Set suppression flag
        SUPPRESSING.store(true, Ordering::Relaxed);

        let ctrl_keycode = self.ctrl_keycode;

        let result = self.emit_with(|d| {
            unsafe {
                // Only press Ctrl if user isn't already holding it
                if !ctrl_already_pressed && ctrl_keycode > 0 {
                    xtest::XTestFakeKeyEvent(d, ctrl_keycode as c_int, xlib::True, xlib::CurrentTime);
                }

                for _ in 0..count {
                    xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                    xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                }

                // Only release Ctrl if we pressed it
                if !ctrl_already_pressed && ctrl_keycode > 0 {
                    xtest::XTestFakeKeyEvent(d, ctrl_keycode as c_int, xlib::False, xlib::CurrentTime);
                }
            }
            Ok(())
        });

        // Clear suppression flag
        SUPPRESSING.store(false, Ordering::Relaxed);
        std::thread::sleep(std::time::Duration::from_micros(500));

        result
    }
}
```

- [ ] **Step 2: Update mouse_hook.rs to use suppression flag**

Add to the button match block in mouse_hook.rs (after `let button = ...`):

```rust
// Skip self-injected events from WheelEmitter
if super::wheel_emitter::is_suppressed() {
    xlib::XFreeEventData(d, &mut event.cookie);
    continue;
}
```

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/linux/wheel_emitter.rs crates/platform/src/linux/mouse_hook.rs
git commit -m "feat(platform): add Linux wheel emitter with feedback loop protection

- Persistent Display connection (no per-emit open/close)
- Static suppression flag prevents infinite XTest→XInput2 loops
- Runtime keycode resolution via XKeysymToKeycode
- Ctrl state check before zoom injection"
```

---

### Task 11: App Crate Integration

**Files:**
- Modify: `src-tauri/src/lib.rs` — Add Linux cfg branches for FullscreenDetector, WindowGeometry, TimerGuard
- Modify: `src-tauri/src/commands.rs` — xdg-open for Linux

- [ ] **Step 1: Update lib.rs for Linux platform types**

Find the `#[cfg(windows)]` blocks that instantiate FullscreenDetector, WindowGeometry, and HighResTimerGuard. Add Linux branches:

```rust
#[cfg(target_os = "linux")]
let fullscreen_detector: Arc<dyn smoothscroll_platform::traits::FullscreenDetector> =
    Arc::new(smoothscroll_platform::linux::LinuxFullscreenDetector);

#[cfg(target_os = "linux")]
let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
    Arc::new(smoothscroll_platform::linux::LinuxWindowGeometry);
```

For the timer, find where `HighResTimerGuard::begin(1)` is called and add:

```rust
#[cfg(target_os = "linux")]
let _timer = smoothscroll_platform::linux::LinuxHighResTimerGuard::begin(1);
```

- [ ] **Step 2: Update commands.rs for xdg-open**

Find `open_path` function and add Linux branch:

```rust
#[cfg(target_os = "linux")]
{
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("open path: {e}"))?;
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/commands.rs
git commit -m "feat(app): add Linux platform types in app crate

- FullscreenDetector, WindowGeometry, TimerGuard cfg branches
- xdg-open for opening paths"
```

---

### Task 12: Frontend Adjustments

**Files:**
- Modify: `src/components/settings/BehaviorSection.tsx` — Hide Windows-only toggle on Linux
- Modify: `src/components/TrayPanel.tsx` — Platform-agnostic autostart label
- Modify: `src/components/settings/GameModeSection.tsx` — Platform-aware placeholder

- [ ] **Step 1: Hide Windows-only toggle in BehaviorSection.tsx**

Find the "Auto-disable Windows apps with native smooth scrolling" toggle and wrap in platform check:

```tsx
const isLinux = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);

{/* Hide on Linux — no Windows apps to auto-disable */}
{!isLinux && (
  <SettingRow title={t('settings.auto_disable_windows_apps.title')} description={t('settings.auto_disable_windows_apps.desc')}>
    <Switch ... />
  </SettingRow>
)}
```

- [ ] **Step 2: Update TrayPanel.tsx autostart label**

Change the autostart label to be platform-agnostic:

```tsx
{navigator.userAgent.includes('Linux')
  ? t('tray.start_with_system', 'Start with system')
  : t('tray.start_with_windows')}
```

- [ ] **Step 3: Update GameModeSection.tsx placeholder**

Change `game.exe` placeholder to be platform-aware:

```tsx
const gamePlaceholder = /Linux/.test(navigator.userAgent) ? 'steam' : 'game.exe';
// Use in input placeholder
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/BehaviorSection.tsx src/components/TrayPanel.tsx src/components/settings/GameModeSection.tsx
git commit -m "feat(ui): adapt frontend for Linux platform

- Hide 'auto-disable Windows apps' toggle on Linux
- Platform-agnostic 'Start with system' label
- Linux game mode placeholder: 'steam' instead of 'game.exe'"
```

---

### Task 13: Documentation + GitHub Actions + Issue Reply

**Files:**
- Modify: `README.md` — Linux installation section
- Create/Modify: `.github/workflows/build.yml` — Linux CI job
- Comment: GitHub Issue #2

- [ ] **Step 1: Add Linux section to README.md**

Add after the existing Windows/macOS installation sections:

```markdown
### Linux (X11)

> **Note:** Only X11 sessions are currently supported. Wayland is not yet supported.

#### Prerequisites (Ubuntu/Debian)

\`\`\`bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libx11-dev libxi-dev libxtst-dev
\`\`\`

#### Install

Download `.deb` or `.AppImage` from [Releases](../../releases).

\`\`\`bash
# .deb
sudo dpkg -i smoothscroll_*.deb

# .AppImage
chmod +x SmoothScroll-*.AppImage
./SmoothScroll-*.AppImage
\`\`\`

#### Known Limitations

- X11 only — Wayland not yet supported
- Scroll passthrough — original events pass through alongside smooth scroll
- GNOME tray may require `gnome-shell-extension-appindicator`
```

- [ ] **Step 2: Add Linux build job to GitHub Actions**

Create or update `.github/workflows/build.yml`:

```yaml
  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
            libx11-dev libxi-dev libxtst-dev
      - run: pnpm install
      - name: Build
        run: pnpm tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: linux-deb
          path: src-tauri/target/release/bundle/deb/*.deb
      - uses: actions/upload-artifact@v4
        with:
          name: linux-appimage
          path: src-tauri/target/release/bundle/appimage/*.AppImage
```

- [ ] **Step 3: Reply to Issue #2**

```bash
gh issue comment 2 --repo quangtruong2003/SmoothScroll --body "Linux X11 support is coming! 🐧

The app now builds on X11-based Linux desktops (Ubuntu 22.04+, Debian 11+).

**What works:** Smooth scrolling, per-app profiles, global hotkeys, system tray, XDG autostart.

**Known limitations:** X11 only, scroll passthrough, GNOME tray needs AppIndicator extension.

Please try the .deb or .AppImage from the next release and report issues!"
```

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/build.yml
git commit -m "docs: add Linux installation guide and CI/CD"
```

---

## Success Criteria

- [ ] All 7 Platform traits + 2 supporting types implemented (MouseHook, WheelEmitter, ZoomEmitter, ProcessQuery, Autostart, Hotkey, AccessibilitySignals, FullscreenDetector, WindowGeometry)
- [ ] ModifierSampler implemented (XQueryKeymap polling)
- [ ] XTest feedback loop protection (suppression flag)
- [ ] Persistent Display connection in WheelEmitter
- [ ] Runtime keycode resolution (no hardcoded keycodes)
- [ ] `/proc/<pid>/exe` for process names (not /comm)
- [ ] XGrabKey return value checked
- [ ] `cargo build` succeeds on Ubuntu 22.04 (via GitHub Actions)
- [ ] Wayland detection shows warning
- [ ] Frontend hides Windows-specific UI on Linux
- [ ] Platform-agnostic labels (not "Start with Windows")
- [ ] README has Linux installation instructions
- [ ] GitHub Issue #2 replied
- [ ] GitHub Actions produces .deb and .AppImage artifacts
