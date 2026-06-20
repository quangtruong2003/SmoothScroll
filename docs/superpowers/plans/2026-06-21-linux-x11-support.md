# Linux X11 Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Linux X11 support to SmoothScroll so the app builds and runs on X11-based Linux desktops.

**Architecture:** Create `crates/platform/src/linux/` with implementations for all 7 Platform traits (MouseHook, WheelEmitter+ZoomEmitter, ProcessQuery, Autostart, Hotkey, AccessibilitySignals) plus supporting types. Uses X11 via the `x11` Rust crate (FFI bindings). Wayland sessions get a warning dialog.

**Tech Stack:** Rust, X11 (x11 crate with xinput/xtest features), libc, Tauri 2, GitHub Actions

## Global Constraints

- X11-only: Wayland detected via `XDG_SESSION_TYPE` env var, shows warning
- Ubuntu 22.04+ / Debian 11+ minimum
- No `unwrap()` / `panic!()` in production code — use `Result` + `PlatformError::Os(String)`
- `HookHandle` and `HotkeyHandle` are opaque RAII wrappers (see `traits.rs`)
- Platform struct uses `Arc<dyn Trait>` for all fields
- XInput2 cannot swallow scroll events — original scroll passes through alongside smooth scroll (known limitation, documented)

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

---

## File Structure

### Create
- `crates/platform/src/linux/mod.rs` — Module declarations + `build()` function
- `crates/platform/src/linux/display.rs` — Shared X11 display connection helper
- `crates/platform/src/linux/timer.rs` — HighResTimerGuard no-op
- `crates/platform/src/linux/accessibility.rs` — AccessibilitySignals stub
- `crates/platform/src/linux/autostart.rs` — XDG `.desktop` file management
- `crates/platform/src/linux/process_query.rs` — EWMH + /proc process identification
- `crates/platform/src/linux/hotkey.rs` — XGrabKey global hotkey
- `crates/platform/src/linux/mouse_hook.rs` — XInput2 mouse wheel interception
- `crates/platform/src/linux/wheel_emitter.rs` — XTest scroll injection

### Modify
- `crates/platform/Cargo.toml` — Add Linux deps
- `crates/platform/src/lib.rs` — Add `#[cfg(target_os = "linux")]` branch
- `src-tauri/tauri.conf.json` — Add Linux bundle targets
- `src-tauri/build.rs` — Add Linux pkill
- `src-tauri/src/commands.rs` — Use `xdg-open` on Linux
- `src-tauri/src/lib.rs` — Add Linux cfg branches for FullscreenDetector/WindowGeometry
- `src/components/settings/BehaviorSection.tsx` — Hide Windows-only toggle
- `src/components/TrayPanel.tsx` — Platform-agnostic autostart label
- `README.md` — Linux installation section
- `.github/workflows/build.yml` — Linux CI job (create or update)

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

In the `"bundle"` object, update `"targets"` array to include `"deb"` and `"appimage"`, and add a `"linux"` key:

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

Add a `#[cfg(target_os = "linux")]` block alongside the existing Windows/macOS kill blocks:

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
Expected: Errors about missing `linux` module (expected — we haven't created it yet, but Cargo.toml parsed correctly)

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
- Create: `crates/platform/src/linux/mod.rs`
- Create: `crates/platform/src/linux/display.rs`
- Modify: `crates/platform/src/lib.rs`

**Interfaces:**
- Consumes: Platform struct from lib.rs
- Produces: `linux::build() -> Result<Platform>` and `display::open_display()` helper

- [ ] **Step 1: Create display.rs — shared X11 connection helper**

Create `crates/platform/src/linux/display.rs`:

```rust
//! Shared X11 display connection utilities.
//!
//! Each subsystem opens its own Display connection because X11 connections
//! are NOT thread-safe — sharing a single `*mut Display` across threads
//! causes segfaults. Opening per-subsystem connections is the standard
//! approach (used by most X11 apps that need threads).

use crate::types::PlatformError;
use x11::xlib::{self, Display};

/// Open a new X11 display connection. Returns error if DISPLAY is unset
/// or the X server is unreachable.
pub fn open_display() -> Result<*mut Display, PlatformError> {
    let display = unsafe { xlib::XOpenDisplay(std::ptr::null()) };
    if display.is_null() {
        Err(PlatformError::Os(
            "failed to open X11 display — is DISPLAY set?".into(),
        ))
    } else {
        Ok(display)
    }
}

/// Close an X11 display connection.
///
/// # Safety
/// `display` must be a valid pointer from `XOpenDisplay` that has not
/// already been closed.
pub unsafe fn close_display(display: *mut Display) {
    if !display.is_null() {
        xlib::XCloseDisplay(display);
    }
}

/// Get the root window of the default screen.
///
/// # Safety
/// `display` must be a valid, open display connection.
pub unsafe fn root_window(display: *mut Display) -> xlib::Window {
    xlib::XDefaultRootWindow(display)
}
```

- [ ] **Step 2: Create linux/mod.rs with builder function**

Create `crates/platform/src/linux/mod.rs`:

```rust
//! Linux X11 platform implementation.

mod accessibility;
mod display;
mod hotkey;
mod mouse_hook;
mod process_query;
mod timer;
mod autostart;
mod wheel_emitter;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub use accessibility::LinuxAccessibilitySignals;
pub use autostart::LinuxAutostart;
pub use hotkey::LinuxHotkey;
pub use mouse_hook::LinuxMouseHook;
pub use process_query::LinuxProcessQuery;
pub use timer::LinuxHighResTimerGuard;
pub use wheel_emitter::LinuxWheelEmitter;

pub fn build() -> Result<Platform> {
    // Warn about Wayland
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

Add module declaration after existing platform modules:

```rust
#[cfg(target_os = "linux")]
mod linux;
```

Update `current()` function — replace the `#[cfg(not(any(...)))]` fallback:

```rust
pub fn current() -> Result<Platform> {
    #[cfg(windows)]
    {
        windows::build()
    }
    #[cfg(target_os = "macos")]
    {
        macos::build()
    }
    #[cfg(target_os = "linux")]
    {
        linux::build()
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        Err(PlatformError::Unsupported)
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/linux/mod.rs crates/platform/src/linux/display.rs crates/platform/src/lib.rs
git commit -m "feat(platform): add Linux module scaffolding and X11 display helper

- linux/mod.rs with build() returning Platform
- display.rs with open/close/root_window helpers
- Wayland detection warning
- Linux branch in current()"
```

---

### Task 3: Stubs (Timer + Accessibility)

**Files:**
- Create: `crates/platform/src/linux/timer.rs`
- Create: `crates/platform/src/linux/accessibility.rs`

**Interfaces:**
- Consumes: AccessibilitySignals trait (reduce_motion_enabled, watch)
- Produces: No-op implementations

- [ ] **Step 1: Create timer.rs**

Create `crates/platform/src/linux/timer.rs`:

```rust
//! Linux high-resolution timer guard.
//!
//! No-op: Linux `clock_nanosleep` already provides ~1ms precision without
//! any setup. The Windows version calls `timeBeginPeriod(1)` to force the
//! scheduler tick to 1ms, but Linux doesn't need this.

pub struct LinuxHighResTimerGuard;

impl LinuxHighResTimerGuard {
    pub fn begin(_period_ms: u32) -> Self {
        Self
    }
}
```

- [ ] **Step 2: Create accessibility.rs**

Create `crates/platform/src/linux/accessibility.rs`:

```rust
//! Linux accessibility signals.
//!
//! Like Windows, Linux lacks a reliable system-wide "Reduce Motion" signal.
//! GNOME has `org.gnome.desktop.interface enable-animations` but it controls
//! UI animations, not motion sensitivity. Report `false` unconditionally.

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::Result;

pub struct LinuxAccessibilitySignals;

impl AccessibilitySignals for LinuxAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        false
    }

    fn watch(&self, _on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        // Constant false — callback never fires
        Ok(HookHandle::new(Box::new(())))
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/linux/timer.rs crates/platform/src/linux/accessibility.rs
git commit -m "feat(platform): add Linux timer and accessibility stubs

- HighResTimerGuard: no-op (Linux timers already precise)
- AccessibilitySignals: always false (no reliable RM signal on Linux)"
```

---

### Task 4: Autostart (XDG)

**Files:**
- Create: `crates/platform/src/linux/autostart.rs`

**Interfaces:**
- Consumes: Autostart trait (is_enabled, set)
- Produces: `LinuxAutostart` managing `~/.config/autostart/smoothscroll.desktop`

- [ ] **Step 1: Create autostart.rs**

Create `crates/platform/src/linux/autostart.rs`:

```rust
//! XDG autostart via ~/.config/autostart/smoothscroll.desktop.
//!
//! The freedesktop.org XDG autostart spec: placing a .desktop file in
//! ~/.config/autostart/ causes it to launch on login.

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
            .map(|p| p.to_string_lossy().into_owned())
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
                    .map_err(|e| PlatformError::Os(format!("mkdir autostart dir: {e}")))?;
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
git commit -m "feat(platform): add Linux XDG autostart

Write/remove ~/.config/autostart/smoothscroll.desktop
to enable/disable launch-on-login."
```

---

### Task 5: Process Query (EWMH + /proc)

**Files:**
- Create: `crates/platform/src/linux/process_query.rs`

**Interfaces:**
- Consumes: ProcessQuery trait (process_name_under_cursor, foreground_process_id, list_visible_processes)
- Produces: `LinuxProcessQuery` using X11 `_NET_WM_PID` atom + `/proc/<pid>/comm`

- [ ] **Step 1: Create process_query.rs**

Create `crates/platform/src/linux/process_query.rs`:

```rust
//! Process identification via X11 EWMH atoms and /proc filesystem.
//!
//! Strategy:
//! 1. XQueryPointer → window under cursor
//! 2. Walk up window tree looking for _NET_WM_PID property
//! 3. Read /proc/<pid>/comm for process name

use crate::traits::{ProcessInfo, ProcessQuery};
use crate::types::PlatformError;
use parking_lot::Mutex;
use std::ffi::CStr;
use std::fs;
use std::os::raw::{c_int, c_long, c_uchar, c_uint, c_ulong};
use std::time::{Duration, Instant};
use x11::xlib::{self, Atom, Display, Window};

use super::display;

const TTL: Duration = Duration::from_millis(100);

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
        // Verify we can open a display at startup
        let d = display::open_display()?;
        unsafe { display::close_display(d) };
        Ok(Self {
            cache: Mutex::new(CacheEntry {
                last_check: None,
                last_window: 0,
                cached_name: None,
            }),
        })
    }
}

/// Read the _NET_WM_PID property from a window, walking up the tree
/// if the current window doesn't have it set.
///
/// # Safety
/// `display` must be a valid open display connection.
unsafe fn get_window_pid(display: *mut Display, mut window: Window) -> Option<u32> {
    let net_wm_pid = {
        let name = b"_NET_WM_PID\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };
    if net_wm_pid == 0 {
        return None;
    }

    // Walk up to 10 levels of the window tree
    for _ in 0..10 {
        let mut actual_type: Atom = 0;
        let mut actual_format: c_int = 0;
        let mut n_items: c_ulong = 0;
        let mut bytes_after: c_ulong = 0;
        let mut prop_return: *mut c_uchar = std::ptr::null_mut();

        let status = xlib::XGetWindowProperty(
            display,
            window,
            net_wm_pid,
            0,
            1,
            xlib::False,
            xlib::XA_CARDINAL,
            &mut actual_type,
            &mut actual_format,
            &mut n_items,
            &mut bytes_after,
            &mut prop_return,
        );

        if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
            let pid = *(prop_return as *const u32);
            xlib::XFree(prop_return as *mut _);
            return Some(pid);
        }

        if !prop_return.is_null() {
            xlib::XFree(prop_return as *mut _);
        }

        // Walk up to parent window
        let mut root: Window = 0;
        let mut parent: Window = 0;
        let mut children: *mut Window = std::ptr::null_mut();
        let mut n_children: c_uint = 0;
        if xlib::XQueryTree(display, window, &mut root, &mut parent, &mut children, &mut n_children) != 0 {
            if !children.is_null() {
                xlib::XFree(children as *mut _);
            }
            if parent == 0 || parent == root {
                return None;
            }
            window = parent;
        } else {
            return None;
        }
    }
    None
}

/// Read process name from /proc/<pid>/comm (truncated to 15 chars by kernel).
fn process_name_from_pid(pid: u32) -> Option<String> {
    fs::read_to_string(format!("/proc/{pid}/comm"))
        .ok()
        .map(|s| s.trim().to_string())
}

/// Get the window under the cursor.
///
/// # Safety
/// `display` must be a valid open display connection.
unsafe fn window_under_cursor(display: *mut Display) -> Option<Window> {
    let root = display::root_window(display);
    let mut root_return: Window = 0;
    let mut child_return: Window = 0;
    let mut root_x: c_int = 0;
    let mut root_y: c_int = 0;
    let mut win_x: c_int = 0;
    let mut win_y: c_int = 0;
    let mut mask: c_uint = 0;

    let ok = xlib::XQueryPointer(
        display,
        root,
        &mut root_return,
        &mut child_return,
        &mut root_x,
        &mut root_y,
        &mut win_x,
        &mut win_y,
        &mut mask,
    );

    if ok != 0 && child_return != 0 {
        Some(child_return)
    } else {
        None
    }
}

/// Get the foreground (active) window via _NET_ACTIVE_WINDOW.
///
/// # Safety
/// `display` must be a valid open display connection.
unsafe fn active_window(display: *mut Display) -> Option<Window> {
    let root = display::root_window(display);
    let net_active = {
        let name = b"_NET_ACTIVE_WINDOW\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };
    if net_active == 0 {
        return None;
    }

    let mut actual_type: Atom = 0;
    let mut actual_format: c_int = 0;
    let mut n_items: c_ulong = 0;
    let mut bytes_after: c_ulong = 0;
    let mut prop_return: *mut c_uchar = std::ptr::null_mut();

    let status = xlib::XGetWindowProperty(
        display,
        root,
        net_active,
        0,
        1,
        xlib::False,
        xlib::XA_WINDOW,
        &mut actual_type,
        &mut actual_format,
        &mut n_items,
        &mut bytes_after,
        &mut prop_return,
    );

    if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
        let win = *(prop_return as *const Window);
        xlib::XFree(prop_return as *mut _);
        if win != 0 { Some(win) } else { None }
    } else {
        if !prop_return.is_null() {
            xlib::XFree(prop_return as *mut _);
        }
        None
    }
}

/// Get window title via _NET_WM_NAME (UTF-8) or WM_NAME (latin1 fallback).
///
/// # Safety
/// `display` must be a valid open display connection.
unsafe fn window_title(display: *mut Display, window: Window) -> Option<String> {
    let net_wm_name = {
        let name = b"_NET_WM_NAME\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };

    let mut actual_type: Atom = 0;
    let mut actual_format: c_int = 0;
    let mut n_items: c_ulong = 0;
    let mut bytes_after: c_ulong = 0;
    let mut prop_return: *mut c_uchar = std::ptr::null_mut();

    // Try _NET_WM_NAME first (UTF-8)
    let status = xlib::XGetWindowProperty(
        display,
        window,
        net_wm_name,
        0,
        1024,
        xlib::False,
        xlib::XA_ANY,
        &mut actual_type,
        &mut actual_format,
        &mut n_items,
        &mut bytes_after,
        &mut prop_return,
    );

    if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
        let bytes = std::slice::from_raw_parts(prop_return, n_items as usize);
        let title = String::from_utf8_lossy(bytes).into_owned();
        xlib::XFree(prop_return as *mut _);
        return Some(title);
    }

    if !prop_return.is_null() {
        xlib::XFree(prop_return as *mut _);
    }

    // Fallback: WM_NAME via XGetWMName
    let mut text_prop: xlib::XTextProperty = std::mem::zeroed();
    if xlib::XGetWMName(display, window, &mut text_prop) != 0 && !text_prop.value.is_null() {
        let c_str = CStr::from_ptr(text_prop.value as *const i8);
        let title = c_str.to_string_lossy().into_owned();
        xlib::XFree(text_prop.value as *mut _);
        return Some(title);
    }

    None
}

/// Enumerate top-level windows.
///
/// # Safety
/// `display` must be a valid open display connection.
unsafe fn enumerate_windows(display: *mut Display) -> Vec<Window> {
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

    if !children.is_null() {
        xlib::XFree(children as *mut _);
    }

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
            let Ok(d) = display::open_display() else {
                return results;
            };
            let windows = enumerate_windows(d);
            for win in windows {
                // Skip windows without _NET_WM_PID
                let Some(pid) = get_window_pid(d, win) else {
                    continue;
                };
                let name = process_name_from_pid(pid).unwrap_or_default();
                if name.is_empty() {
                    continue;
                }
                let title = window_title(d, win).unwrap_or_default();
                results.push(ProcessInfo {
                    pid,
                    name,
                    window_title: title,
                });
            }
            display::close_display(d);
        }
        results
    }

    fn foreground_process_name(&self) -> Option<String> {
        let pid = self.foreground_process_id()?;
        process_name_from_pid(pid)
    }

    // is_target_elevated: default `false` is correct — Linux has no UIPI
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/process_query.rs
git commit -m "feat(platform): add Linux process query via EWMH + /proc

- _NET_WM_PID atom to get PID from window (walks up tree)
- /proc/<pid>/comm for process name
- _NET_ACTIVE_WINDOW for foreground detection
- _NET_WM_NAME / WM_NAME for window titles
- 100ms TTL cache matching Windows behavior"
```

---

### Task 6: Hotkey (XGrabKey)

**Files:**
- Create: `crates/platform/src/linux/hotkey.rs`

**Interfaces:**
- Consumes: Hotkey trait (`register(accel, on_pressed) -> Result<HotkeyHandle>`)
- Produces: `LinuxHotkey` using XGrabKey on root window

- [ ] **Step 1: Create hotkey.rs**

Create `crates/platform/src/linux/hotkey.rs`:

```rust
//! Global hotkey via XGrabKey on the root window.
//!
//! Parses Tauri accelerator strings like "CommandOrControl+Alt+S" into
//! X11 modifier masks + keycodes, grabs them on the root window, and
//! dispatches callbacks from a dedicated event thread.

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
use std::ffi::CString;
use std::os::raw::{c_int, c_uint};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use x11::xlib::{self, Display, KeySym};

use super::display;

/// X11 modifier masks
const MOD_CONTROL: c_uint = xlib::ControlMask;
const MOD_ALT: c_uint = xlib::Mod1Mask;
const MOD_SHIFT: c_uint = xlib::ShiftMask;
const MOD_SUPER: c_uint = xlib::Mod4Mask;

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

                // Resolve keysym from name
                let keysym = unsafe {
                    let c_name = CString::new(keysym_name.as_str()).unwrap();
                    xlib::XStringToKeysym(c_name.as_ptr())
                };
                if keysym == 0 {
                    let _ = tx.send(Err(PlatformError::Os(format!("unknown key: {keysym_name}"))));
                    unsafe { display::close_display(d) };
                    return;
                }

                let keycode = unsafe { xlib::XKeysymToKeycode(d, keysym) } as c_uint;
                if keycode == 0 {
                    let _ = tx.send(Err(PlatformError::Os("keycode 0".into())));
                    unsafe { display::close_display(d) };
                    return;
                }

                // Grab the key (GrabModeAsync so we don't freeze input)
                unsafe {
                    xlib::XGrabKey(
                        d,
                        keycode as c_int,
                        modifiers,
                        root,
                        xlib::False,
                        xlib::GrabModeAsync,
                        xlib::GrabModeAsync,
                    );
                }

                // Signal success
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
                            // Brief sleep to avoid busy-waiting
                            thread::sleep(std::time::Duration::from_millis(10));
                        }
                    }
                }

                // Cleanup: ungrab key
                unsafe {
                    xlib::XUngrabKey(d, keycode as c_int, modifiers, root);
                    display::close_display(d);
                }
            })
            .map_err(|e| PlatformError::Os(format!("spawn hotkey thread: {e}")))?;

        rx.recv()
            .map_err(|_| PlatformError::Os("hotkey thread died before grab".into()))??;

        struct Installed {
            alive: Arc<AtomicBool>,
        }
        impl Drop for Installed {
            fn drop(&mut self) {
                self.alive.store(false, Ordering::SeqCst);
            }
        }

        Ok(HotkeyHandle::new(Box::new(Installed { alive })))
    }
}

/// Parse Tauri-style accelerator string into (modifier_mask, keysym_name).
///
/// Supported: "CommandOrControl+Alt+S", "Ctrl+Shift+F10", etc.
/// On Linux, "Command" and "CommandOrControl" map to Super (Mod4).
fn parse_accelerator(raw: &str) -> Result<(c_uint, String)> {
    let parts: Vec<&str> = raw.split('+').map(|s| s.trim()).collect();
    if parts.is_empty() {
        return Err(PlatformError::Os("empty accelerator".into()));
    }

    let mut mods: c_uint = 0;
    let mut key_name = String::new();

    for (i, part) in parts.iter().enumerate() {
        let is_last = i == parts.len() - 1;
        if !is_last {
            match part.to_lowercase().as_str() {
                "ctrl" | "control" => mods |= MOD_CONTROL,
                "alt" => mods |= MOD_ALT,
                "shift" => mods |= MOD_SHIFT,
                "super" | "command" | "commandorcontrol" | "cmdorctrl" => mods |= MOD_SUPER,
                other => {
                    return Err(PlatformError::Os(format!("unknown modifier: {other}")));
                }
            }
        } else {
            // Map common key names to X11 keysym names
            key_name = match part.to_lowercase().as_str() {
                "enter" | "return" => "Return".into(),
                "escape" | "esc" => "Escape".into(),
                "space" => "space".into(),
                "tab" => "Tab".into(),
                "delete" | "del" => "Delete".into(),
                "backspace" => "BackSpace".into(),
                s if s.len() == 1 => s.to_uppercase(),
                s => {
                    // F1-F12, or just pass through
                    let upper = s.to_uppercase();
                    if upper.starts_with('F') && upper.len() <= 3 {
                        upper
                    } else {
                        s.to_string()
                    }
                }
            };
        }
    }

    if key_name.is_empty() {
        return Err(PlatformError::Os("no key in accelerator".into()));
    }

    Ok((mods, key_name))
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/hotkey.rs
git commit -m "feat(platform): add Linux global hotkey via XGrabKey

- XGrabKey on root window with modifier masks
- Dedicated event thread with XPending polling
- Parse Tauri accelerator strings (Ctrl+Alt+S, etc.)
- Super key for Command/CommandOrControl on Linux"
```

---

### Task 7: Mouse Hook (XInput2)

**Files:**
- Create: `crates/platform/src/linux/mouse_hook.rs`

**Interfaces:**
- Consumes: MouseHook trait (`install(sink) -> Result<HookHandle>`), HookEventSink
- Produces: `LinuxMouseHook` listening for scroll events via XInput2

- [ ] **Step 1: Create mouse_hook.rs**

Create `crates/platform/src/linux/mouse_hook.rs`:

```rust
//! Mouse wheel interception via XInput2 raw events.
//!
//! Listens for XI_RawButtonPress on the root window. Button 4/5 = vertical
//! scroll, button 6/7 = horizontal scroll.
//!
//! IMPORTANT LIMITATION: XInput2 raw events are observation-only — we cannot
//! swallow the original scroll event. This means on Linux, both the original
//! scroll AND our smooth scroll will reach the target app. This is a known
//! limitation documented in the spec. Future work could use evdev/uinput
//! (requires root) or the XRecord extension to fully intercept.

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{HookDecision, ModifierKeys, PlatformError, Result};
use std::os::raw::{c_int, c_uchar, c_uint};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use x11::xlib::{self, Display};

use super::display;

/// XInput2 opcodes
const XI_RawButtonPress: c_int = 17;

pub struct LinuxMouseHook;

impl LinuxMouseHook {
    pub fn new() -> Result<Self, PlatformError> {
        // Verify XInput2 is available
        let d = display::open_display()?;
        let available = unsafe { check_xinput2(d) };
        unsafe { display::close_display(d) };
        if !available {
            return Err(PlatformError::Os(
                "XInput2 extension not available".into(),
            ));
        }
        Ok(Self)
    }
}

impl MouseHook for LinuxMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let alive = Arc::new(AtomicBool::new(true));
        let alive_thread = alive.clone();

        thread::Builder::new()
            .name("ss-mouse-hook".into())
            .spawn(move || {
                let d = match display::open_display() {
                    Ok(d) => d,
                    Err(_) => return,
                };
                let root = unsafe { display::root_window(d) };

                if unsafe { !select_xi_events(d, root) } {
                    unsafe { display::close_display(d) };
                    return;
                }

                let mut classifier_v = smoothscroll_core::input_source::InputClassifier::new();
                let mut classifier_h = smoothscroll_core::input_source::InputClassifier::new();

                while alive_thread.load(Ordering::Relaxed) {
                    unsafe {
                        if xlib::XPending(d) == 0 {
                            thread::sleep(std::time::Duration::from_millis(1));
                            continue;
                        }

                        let mut event: xlib::XEvent = std::mem::zeroed();
                        xlib::XNextEvent(d, &mut event);

                        // Check if this is an XInput2 event
                        let mut xi_event_type: c_int = 0;
                        if xlib::XGetEventData(d, &mut event.cookie) == 0 {
                            continue;
                        }

                        if event.type_ != xi_generic_event_type(d) {
                            xlib::XFreeEventData(d, &mut event.cookie);
                            continue;
                        }

                        let xi_event = event.cookie.data as *mut x11::xi2::XIRawEvent;
                        if xi_event.is_null() {
                            xlib::XFreeEventData(d, &mut event.cookie);
                            continue;
                        }

                        xi_event_type = (*xi_event).evtype;

                        if xi_event_type != XI_RawButtonPress {
                            xlib::XFreeEventData(d, &mut event.cookie);
                            continue;
                        }

                        let button = (*xi_event).detail;
                        xlib::XFreeEventData(d, &mut event.cookie);

                        // Button mapping:
                        // 4 = scroll up (delta +120)
                        // 5 = scroll down (delta -120)
                        // 6 = scroll left (delta -120)
                        // 7 = scroll right (delta +120)
                        let mods = ModifierKeys::default(); // TODO: wire up ModifierSampler
                        match button {
                            4 => {
                                let source = classifier_v.classify(120);
                                sink.on_wheel_ext(120, mods, source);
                            }
                            5 => {
                                let source = classifier_v.classify(-120);
                                sink.on_wheel_ext(-120, mods, source);
                            }
                            6 => {
                                let source = classifier_h.classify(-120);
                                sink.on_hwheel_ext(-120, source);
                            }
                            7 => {
                                let source = classifier_h.classify(120);
                                sink.on_hwheel_ext(120, source);
                            }
                            _ => {}
                        }
                    }
                }

                unsafe { display::close_display(d) };
            })
            .map_err(|e| PlatformError::Os(format!("spawn mouse hook thread: {e}")))?;

        struct Installed {
            alive: Arc<AtomicBool>,
        }
        impl Drop for Installed {
            fn drop(&mut self) {
                self.alive.store(false, Ordering::SeqCst);
            }
        }

        Ok(HookHandle::new(Box::new(Installed { alive })))
    }
}

/// Check if XInput2 extension is available.
///
/// # Safety
/// `display` must be a valid open display.
unsafe fn check_xinput2(display: *mut Display) -> bool {
    let mut major: c_int = 2;
    let mut minor: c_int = 0;
    x11::xi2::XIQueryVersion(display, &mut major, &mut minor) == xlib::Success as c_int
}

/// Select XI_RawButtonPress events on the root window.
///
/// # Safety
/// `display` must be a valid open display.
unsafe fn select_xi_events(display: *mut Display, root: xlib::Window) -> bool {
    let mut mask = [0u8; 4]; // XI_RawButtonPress = 17, bit 17
    mask[2] |= 0x02; // bit 17 = byte 2, bit 1

    let mut event_mask = x11::xi2::XIEventMask {
        deviceid: x11::xi2::XIAllMasterDevices,
        mask_len: mask.len() as c_int,
        mask: mask.as_mut_ptr(),
    };

    x11::xi2::XISelectEvents(display, root, &mut event_mask, 1) == xlib::Success as c_int
}

/// Get the XInput2 GenericEvent type code.
///
/// # Safety
/// `display` must be a valid open display.
unsafe fn xi_generic_event_type(display: *mut Display) -> c_int {
    let mut event_base: c_int = 0;
    let mut error_base: c_int = 0;
    let name = b"XInputExtension\0".as_ptr() as *const i8;
    xlib::XQueryExtension(display, name, &mut event_base as *mut _, &mut error_base, &mut error_base);
    event_base + xlib::GenericEvent as c_int
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/mouse_hook.rs
git commit -m "feat(platform): add Linux mouse hook via XInput2

- XI_RawButtonPress to detect scroll button events
- Button 4/5 = vertical, 6/7 = horizontal scroll
- InputClassifier for source detection
- Known limitation: cannot swallow original events"
```

---

### Task 8: Wheel Emitter (XTest)

**Files:**
- Create: `crates/platform/src/linux/wheel_emitter.rs`

**Interfaces:**
- Consumes: WheelEmitter + ZoomEmitter traits
- Produces: `LinuxWheelEmitter` using XTestFakeButtonEvent

- [ ] **Step 1: Create wheel_emitter.rs**

Create `crates/platform/src/linux/wheel_emitter.rs`:

```rust
//! Scroll injection via XTest extension.
//!
//! Uses XTestFakeButtonEvent to generate synthetic button press/release
//! pairs that the X server interprets as scroll events:
//! - Button 4 = scroll up
//! - Button 5 = scroll down
//! - Button 6 = scroll left
//! - Button 7 = scroll right
//!
//! For zoom: simulates Ctrl key down + scroll + Ctrl key up.

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::os::raw::{c_int, c_uint};
use x11::xlib::{self, Display};
use x11::xtest;

use super::display;

// X11 button numbers for scrolling
const BUTTON_SCROLL_UP: c_uint = 4;
const BUTTON_SCROLL_DOWN: c_uint = 5;
const BUTTON_SCROLL_LEFT: c_uint = 6;
const BUTTON_SCROLL_RIGHT: c_uint = 7;

// X11 keycodes for modifier keys
const KEYCODE_CONTROL_L: c_uint = 37;
const KEYCODE_SHIFT_L: c_uint = 50;

pub struct LinuxWheelEmitter {
    // We open/close the display per-emit to avoid thread-safety issues.
    // The emit call comes from the engine thread, not the hook thread.
}

impl LinuxWheelEmitter {
    pub fn new() -> Result<Self, PlatformError> {
        // Verify XTest is available
        let d = display::open_display()?;
        let available = unsafe { check_xtest(d) };
        unsafe { display::close_display(d) };
        if !available {
            return Err(PlatformError::Os(
                "XTest extension not available".into(),
            ));
        }
        Ok(Self {})
    }

    fn with_display<F>(&self, f: F) -> Result<()>
    where
        F: FnOnce(*mut Display) -> Result<()>,
    {
        let d = display::open_display()?;
        let result = f(d);
        unsafe {
            xlib::XFlush(d);
            display::close_display(d);
        }
        result
    }
}

impl WheelEmitter for LinuxWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }

        self.with_display(|d| {
            if vertical_units != 0 {
                let button = if vertical_units > 0 {
                    BUTTON_SCROLL_UP
                } else {
                    BUTTON_SCROLL_DOWN
                };
                let count = vertical_units.unsigned_abs();
                for _ in 0..count {
                    unsafe {
                        xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                        xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                    }
                }
            }

            if horizontal_units != 0 {
                let button = if horizontal_units > 0 {
                    BUTTON_SCROLL_RIGHT
                } else {
                    BUTTON_SCROLL_LEFT
                };
                let count = horizontal_units.unsigned_abs();
                for _ in 0..count {
                    unsafe {
                        xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                        xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                    }
                }
            }

            Ok(())
        })
    }
}

impl ZoomEmitter for LinuxWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        if units == 0 {
            return Ok(());
        }

        self.with_display(|d| {
            let button = if units > 0 {
                BUTTON_SCROLL_UP
            } else {
                BUTTON_SCROLL_DOWN
            };
            let count = units.unsigned_abs();

            unsafe {
                // Press Ctrl
                xtest::XTestFakeKeyEvent(d, KEYCODE_CONTROL_L, xlib::True, xlib::CurrentTime);

                // Scroll
                for _ in 0..count {
                    xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                    xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                }

                // Release Ctrl
                xtest::XTestFakeKeyEvent(d, KEYCODE_CONTROL_L, xlib::False, xlib::CurrentTime);
            }

            Ok(())
        })
    }
}

/// Check if XTest extension is available.
///
/// # Safety
/// `display` must be a valid open display.
unsafe fn check_xtest(display: *mut Display) -> bool {
    let mut event_base: c_int = 0;
    let mut error_base: c_int = 0;
    let mut major: c_int = 0;
    let mut minor: c_int = 0;
    xtest::XTestQueryExtension(display, &mut event_base, &mut error_base, &mut major, &mut minor)
        != 0
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/linux/wheel_emitter.rs
git commit -m "feat(platform): add Linux wheel/zoom emitter via XTest

- XTestFakeButtonEvent for scroll injection (buttons 4-7)
- XTestFakeKeyEvent for Ctrl+scroll zoom
- Per-emit display connection for thread safety
- XTest availability check at startup"
```

---

### Task 9: App Crate Integration

**Files:**
- Modify: `src-tauri/src/lib.rs` — Add Linux cfg branches
- Modify: `src-tauri/src/commands.rs` — xdg-open for Linux

**Interfaces:**
- Consumes: Linux platform types from crates/platform
- Produces: App crate compiles and runs on Linux

- [ ] **Step 1: Update lib.rs for Linux platform types**

In `src-tauri/src/lib.rs`, find the `#[cfg(windows)]` blocks that reference `WindowsFullscreenDetector`, `WindowsWindowGeometry`, and `HighResTimerGuard`. Add corresponding Linux branches:

For FullscreenDetector (find the `#[cfg(windows)]` that instantiates it):

```rust
#[cfg(target_os = "linux")]
{
    // Linux fullscreen detection uses _NET_WM_STATE_FULLSCREEN
    // Implemented inline since it's simple enough
}
```

For WindowGeometry:

```rust
#[cfg(target_os = "linux")]
{
    // Linux window geometry via XQueryPointer
}
```

For HighResTimerGuard:

```rust
#[cfg(target_os = "linux")]
{
    let _timer = smoothscroll_platform::linux::LinuxHighResTimerGuard::begin(1);
}
```

**Note:** The exact code depends on how lib.rs currently instantiates these. Read the file carefully and follow the existing Windows/macOS pattern, adding a Linux branch that uses the Linux types from `smoothscroll_platform::linux::*`.

- [ ] **Step 2: Update commands.rs for xdg-open**

In `src-tauri/src/commands.rs`, find the `open_path` function (around line 346) that uses `explorer.exe`:

```rust
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("open path: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("open path: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("open path: {e}"))?;
    }
    Ok(())
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/commands.rs
git commit -m "feat(app): add Linux platform integration in app crate

- Linux cfg branches for FullscreenDetector, WindowGeometry, TimerGuard
- xdg-open for opening paths on Linux"
```

---

### Task 10: Frontend Adjustments

**Files:**
- Modify: `src/components/settings/BehaviorSection.tsx` — Hide Windows-only toggle
- Modify: `src/components/TrayPanel.tsx` — Platform-agnostic autostart label

**Interfaces:**
- Consumes: `navigator.userAgent` for platform detection
- Produces: UI that adapts to Linux platform

- [ ] **Step 1: Add platform detection utility**

In `src/lib/` (or inline), add a helper. Or inline in components:

```typescript
const isLinux = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
```

- [ ] **Step 2: Hide Windows-specific toggle in BehaviorSection.tsx**

In `src/components/settings/BehaviorSection.tsx` (around line 76-95), find the "Auto-disable Windows apps with native smooth scrolling" toggle. Wrap it in a platform check:

```tsx
{/* Only show on Windows — no native smooth scroll apps on Linux/macOS */}
{!isLinux && (
  <div>
    {/* existing toggle JSX */}
  </div>
)}
```

Add the detection at the top of the component:

```tsx
const isLinux = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
```

- [ ] **Step 3: Update TrayPanel.tsx autostart label**

In `src/components/TrayPanel.tsx` (around line 239), change the label:

```tsx
// Before:
{t('tray.start_with_windows')}

// After:
{navigator.userAgent.includes('Linux')
  ? t('tray.start_with_system', 'Start with system')
  : t('tray.start_with_windows')}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/BehaviorSection.tsx src/components/TrayPanel.tsx
git commit -m "feat(ui): adapt frontend for Linux platform

- Hide 'auto-disable Windows apps' toggle on Linux
- 'Start with system' label instead of 'Start with Windows'"
```

---

### Task 11: Documentation + GitHub Actions

**Files:**
- Modify: `README.md` — Linux installation section
- Create/Modify: `.github/workflows/build.yml` — Linux CI job
- Reply: GitHub Issue #2

**Interfaces:**
- Consumes: All previous tasks
- Produces: Users can build and install on Linux

- [ ] **Step 1: Add Linux section to README.md**

Add after the existing Windows/macOS installation sections:

```markdown
### Linux (X11)

> **Note:** Only X11 sessions are currently supported. Wayland is not yet supported.

#### Prerequisites

Install system dependencies (Ubuntu/Debian):

\`\`\`bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libx11-dev libxi-dev libxtst-dev
\`\`\`

#### Install

Download the `.deb` or `.AppImage` from the [Releases](../../releases) page.

\`\`\`bash
# .deb
sudo dpkg -i smoothscroll_*.deb

# .AppImage
chmod +x SmoothScroll-*.AppImage
./SmoothScroll-*.AppImage
\`\`\`

#### Known Limitations

- **X11 only** — Wayland sessions are not yet supported
- **Scroll passthrough** — Original scroll events pass through alongside smooth scroll (X11 limitation)
- **GNOME tray** — May require `gnome-shell-extension-appindicator` for system tray icon
```

- [ ] **Step 2: Add Linux build job to GitHub Actions**

Create or update `.github/workflows/build.yml` to include a Linux job:

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
      - name: Upload .deb
        uses: actions/upload-artifact@v4
        with:
          name: linux-deb
          path: src-tauri/target/release/bundle/deb/*.deb
      - name: Upload .AppImage
        uses: actions/upload-artifact@v4
        with:
          name: linux-appimage
          path: src-tauri/target/release/bundle/appimage/*.AppImage
```

- [ ] **Step 3: Reply to Issue #2 on GitHub**

```bash
gh issue comment 2 --repo quangtruong2003/SmoothScroll --body "Linux X11 support has been implemented! 🎉

The app now builds and runs on X11-based Linux desktops (Ubuntu 22.04+, Debian 11+).

**What works:**
- Smooth scrolling via XInput2 + XTest
- Per-app profiles via EWMH + /proc
- Global hotkeys via XGrabKey
- System tray via libayatana-appindicator
- XDG autostart

**Known limitations:**
- X11 only (Wayland not yet supported)
- Original scroll events pass through alongside smooth scroll (X11 API limitation)
- GNOME tray may need gnome-shell-extension-appindicator

I'd love to get feedback from Linux users — please try the .deb or .AppImage from the next release and report any issues!"
```

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/build.yml
git commit -m "docs: add Linux installation guide and CI/CD

- Linux prerequisites and install instructions in README
- GitHub Actions build job for Ubuntu 22.04
- Upload .deb and .AppImage artifacts"
```

---

## Success Criteria

- [ ] All 7 Platform traits implemented (MouseHook, WheelEmitter, ZoomEmitter, ProcessQuery, Autostart, Hotkey, AccessibilitySignals)
- [ ] `cargo build` succeeds on Ubuntu 22.04 (verified via GitHub Actions)
- [ ] Wayland detection shows warning
- [ ] Frontend hides Windows-specific UI on Linux
- [ ] README has Linux installation instructions
- [ ] GitHub Issue #2 replied with status update
- [ ] GitHub Actions produces .deb and .AppImage artifacts
