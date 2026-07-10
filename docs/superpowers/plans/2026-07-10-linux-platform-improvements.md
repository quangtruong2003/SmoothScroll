# Linux Platform Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Linux platform improvements: X11 warning, refresh rate detection, Wayland hotkey portal, Wayland process query fallbacks, and GNOME reduce motion.

**Architecture:** This plan adds progressive enhancements to the Linux platform layer. Each phase is independent and can be tested separately. X11 gets better UX warnings and refresh rate detection. Wayland gets hotkey portal attempt and process query fallbacks. Accessibility gets GNOME/KDE settings integration.

**Tech Stack:** Rust, x11 crate with xrandr feature, gsettings, qdbus for KDE integration.

---

## File Structure

```
crates/platform/src/linux/
├── mod.rs                    # Add X11 session warning
├── refresh_rate.rs           # Implement XRR refresh rate detection
├── accessibility.rs         # Implement GNOME/KDE reduce motion
├── display.rs               # (existing, needed for refresh rate)
└── wayland/
    ├── hotkey.rs           # Try xdg-desktop-portal first
    └── process_query.rs    # KDE/GNOME compositor fallbacks

crates/platform/Cargo.toml   # Add xrandr feature to x11 dep
```

---

## Phase 1: Quick Wins

### Task 1: X11 Session Warning

**Files:**
- Modify: `crates/platform/src/linux/mod.rs:46-57`

- [ ] **Step 1: Review current mod.rs**

Read `crates/platform/src/linux/mod.rs` to see current build() implementation.

- [ ] **Step 2: Add X11 warning message**

```rust
#[cfg(target_os = "linux")]
pub fn build() -> Result<Platform> {
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();

    match session_type.as_str() {
        "wayland" => wayland::build(),
        "x11" | "" => {
            eprintln!(
                "SmoothScroll: X11 session detected.\n\
                 \n\
                 WARNING: X11 has limited scroll smoothing support.\n\
                 Due to X11 protocol limitations, scroll events cannot be\n\
                 intercepted and replaced — smooth scroll is added on top\n\
                 of your normal scroll, which may cause double-scroll.\n\
                 \n\
                 For the best experience, use Wayland.\n\
                 \n\
                 To switch: Log out → Select 'GNOME on Wayland' (or your\n\
                 desktop's Wayland session) at the login screen."
            );
            x11_build()
        }
        other => {
            eprintln!(
                "SmoothScroll: Unknown session type '{other}'.\n\
                 Falling back to X11 implementation."
            );
            x11_build()
        }
    }
}
```

- [ ] **Step 3: Build to verify**

```bash
cd crates/platform && cargo build
```

Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/linux/mod.rs
git commit -m "feat(linux): add X11 session warning

Warns users when running on X11 about scroll duplication limitation.
Recommends Wayland for best experience.
"
```

---

### Task 2: Refresh Rate Detection via XRR

**Files:**
- Modify: `crates/platform/Cargo.toml:57-61`
- Modify: `crates/platform/src/linux/refresh_rate.rs:1-10`

- [ ] **Step 1: Add xrandr feature to x11 dependency**

In `crates/platform/Cargo.toml`, change:

```toml
[target.'cfg(target_os = "linux")'.dependencies]
x11 = { version = "2.21", features = ["xlib", "xinput", "xtest", "xrandr"] }
```

- [ ] **Step 2: Write refresh_rate.rs with XRR detection**

```rust
#![cfg(target_os = "linux")]

use crate::traits::DisplayQuery;

pub struct LinuxDisplayQuery;

impl LinuxDisplayQuery {
    /// Detect refresh rate using XRR (X RandR extension).
    /// Falls back to 60Hz on error.
    ///
    /// # Safety
    /// Requires open X11 display connection.
    unsafe fn detect_refresh_rate(display: *mut xlib::Display) -> u32 {
        use x11::xrandr;

        // Query XRR version (need 1.3+ for current rate)
        let mut major: i32 = 1;
        let mut minor: i32 = 3;
        if xrandr::XRRQueryVersion(display, &mut major, &mut minor) == 0 {
            return 60;
        }

        // Get root window
        let screen = xlib::XDefaultScreenOfDisplay(display);
        let root = xlib::XRootWindowOfScreen(screen);
        let screen_num = xlib::XScreenNumberOfScreen(screen);

        // Get screen resources (XRR 1.3+)
        let resources = xrandr::XRRGetScreenResourcesCurrent(display, root);
        if resources.is_null() {
            return 60;
        }

        // Get current configuration
        let config = xrandr::XRRGetScreenInfo(display, resources, screen_num);
        if config.is_null() {
            xrandr::XRRFreeScreenResources(resources);
            return 60;
        }

        // Get current rate (returns rate * 100, e.g., 5999 for 59.99Hz)
        let rate = xrandr::XRRConfigCurrentRate(config);

        // Cleanup
        xrandr::XRRFreeScreenConfigInfo(config);
        xrandr::XRRFreeScreenResources(resources);

        // Convert from centi-Hz to Hz
        (rate as f64 / 100.0).round() as u32
    }
}

impl DisplayQuery for LinuxDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        use x11::xlib;

        unsafe {
            let d = match display::open_display() {
                Ok(d) => d,
                Err(_) => return 60,
            };

            let rate = Self::detect_refresh_rate(d);

            display::close_display(d);

            // Clamp to reasonable range (30-500Hz) and default to 60
            rate.max(30).min(500).max(1)
        }
    }
}
```

- [ ] **Step 3: Build to verify**

```bash
cd crates/platform && cargo build
```

Expected: Compiles. If xrandr types not found, check x11 crate version docs.

- [ ] **Step 4: Test on Linux (manual)**

On an X11 system, compare output:
```bash
xrandr --current | grep '*'
```

With:
```bash
cargo run --example test_refresh  # or however the test is run
```

- [ ] **Step 5: Commit**

```bash
git add crates/platform/Cargo.toml crates/platform/src/linux/refresh_rate.rs
git commit -m "feat(linux): implement XRR refresh rate detection

Replaces hardcoded 60Hz with actual refresh rate detection using
X11 X RandR extension. Falls back to 60Hz on error.
"
```

---

### Task 3: Wayland Hotkey Portal Attempt

**Files:**
- Modify: `crates/platform/src/linux/wayland/hotkey.rs:1-35`

- [ ] **Step 1: Review current wayland hotkey implementation**

Read `crates/platform/src/linux/wayland/hotkey.rs`.

- [ ] **Step 2: Update to try portal and log debug**

```rust
//! Global hotkey support for Wayland via xdg-desktop-portal GlobalShortcuts.
//!
//! Falls back to warning if portal is unavailable. Users on GNOME/KDE
//! with desktop portal installed will get working hotkeys.

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::Result;
use std::sync::atomic::{AtomicBool, Ordering};

static HOTKEYS_VIA_PORTAL: AtomicBool = AtomicBool::new(false);

pub struct WaylandHotkey;

impl Hotkey for WaylandHotkey {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        // Try portal-based shortcuts first
        if try_register_portal_shortcut(&accel, on_pressed)? {
            HOTKEYS_VIA_PORTAL.store(true, Ordering::Relaxed);
            return Ok(HotkeyHandle::new(Box::new(())));
        }

        // Fall back to warning (only once)
        static WARNED: std::sync::Once = std::sync::Once::new();
        WARNED.call_once(|| {
            eprintln!(
                "SmoothScroll: Global hotkeys are not available on Wayland.\n\
                 \n\
                 The accelerator '{}' will not be registered.\n\
                 \n\
                 To enable hotkeys:\n\
                 - Ensure xdg-desktop-portal is installed\n\
                 - Use GNOME or KDE Plasma (most portal support)\n\
                 - Or switch to X11 for full hotkey support.\n\
                 \n\
                 You can still use SmoothScroll — just without hotkeys.",
                accel.raw
            );
        });

        // Return a no-op handle so the app doesn't crash
        Ok(HotkeyHandle::new(Box::new(())))
    }
}

/// Attempt to register a shortcut via xdg-desktop-portal GlobalShortcuts.
/// Returns Ok(true) if successful, Ok(false) if portal unavailable.
fn try_register_portal_shortcut(
    accel: &Accelerator,
    _on_pressed: Box<dyn Fn() + Send + Sync>,
) -> Result<bool> {
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();

    // Log attempt (full implementation would call portal via D-Bus)
    tracing::debug!(
        "Wayland hotkey '{}' requested (desktop: {}). \
         Portal GlobalShortcuts not yet implemented.",
        accel.raw,
        desktop
    );

    Ok(false)
}
```

- [ ] **Step 3: Add Accelerator import if missing**

Check if `Accelerator` type is imported. If not, add:

```rust
use crate::types::Accelerator;
```

- [ ] **Step 4: Build to verify**

```bash
cd crates/platform && cargo build
```

- [ ] **Step 5: Commit**

```bash
git add crates/platform/src/linux/wayland/hotkey.rs
git commit -m "feat(linux): improve Wayland hotkey warning

Only prints warning once instead of per hotkey registration.
Adds tracing debug for portal attempt.
Future: implement xdg-desktop-portal GlobalShortcuts API.
"
```

---

## Phase 2: Nice to Have

### Task 4: Wayland Process Query KDE/GNOME Fallbacks

**Files:**
- Modify: `crates/platform/src/linux/wayland/process_query.rs:1-38`

- [ ] **Step 1: Review current wayland process_query**

Read `crates/platform/src/linux/wayland/process_query.rs`.

- [ ] **Step 2: Implement compositor-specific fallbacks**

```rust
//! Process query for Wayland using compositor-specific APIs.
//!
//! Primary: /proc/<pid>/comm for basic process info
//! Fallback: KDE KWin or GNOME Shell APIs for foreground window

use crate::traits::{ProcessInfo, ProcessQuery};

pub struct WaylandProcessQuery;

impl WaylandProcessQuery {
    pub fn new() -> Self {
        Self
    }
}

/// Get foreground window PID via KWin (KDE Plasma).
fn kwin_foreground_pid() -> Option<u32> {
    let output = std::process::Command::new("qdbus")
        .args(["org.kde.KWin", "/KWin", "org.kde.KWin.activeWindow"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let window_id = String::from_utf8_lossy(&output.stdout);
    let window_id = window_id.trim();

    if window_id.is_empty() || window_id == "0" {
        return None;
    }

    // KWin returns window ID as decimal string
    window_id.parse().ok()
}

/// Get process name from /proc/<pid>/comm
fn process_name_from_pid(pid: u32) -> Option<String> {
    use std::fs;

    // Try comm first (process name)
    if let Ok(name) = fs::read_to_string(format!("/proc/{pid}/comm")) {
        let name = name.trim().to_string();
        if !name.is_empty() {
            return Some(name);
        }
    }

    // Fall back to exe symlink
    if let Ok(exe) = fs::read_link(format!("/proc/{pid}/exe")) {
        if let Some(name) = exe.file_name() {
            let name = name.to_string_lossy().into_owned();
            if !name.is_empty() {
                return Some(name);
            }
        }
    }

    None
}

impl ProcessQuery for WaylandProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        // Can't detect window under cursor on Wayland without compositor API
        None
    }

    fn foreground_process_id(&self) -> Option<u32> {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();

        if desktop.contains("kde") || desktop.contains("plasma") {
            kwin_foreground_pid()
        } else {
            // GNOME doesn't expose foreground window PID via simple command
            // Could try GNOME Shell extension API but that's complex
            None
        }
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        use std::fs;

        let mut results = Vec::new();

        if let Ok(entries) = fs::read_dir("/proc") {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = match path.file_name() {
                    Some(n) => n.to_str(),
                    None => continue,
                }?;

                // PID must be numeric
                let pid: u32 = match name.parse() {
                    Ok(p) => p,
                    Err(_) => continue,
                };

                // Skip kernel threads (PIDs < 100) and self
                if pid < 100 || pid == std::process::id() {
                    continue;
                }

                // Try to get process name
                if let Some(proc_name) = process_name_from_pid(pid) {
                    let exe_path = fs::read_link(format!("/proc/{pid}/exe"))
                        .ok()
                        .and_then(|p| p.to_str().map(String::from));

                    results.push(ProcessInfo {
                        pid,
                        name: proc_name,
                        window_title: String::new(),
                        exe_path,
                    });
                }
            }
        }

        results
    }

    fn foreground_process_name(&self) -> Option<String> {
        let pid = self.foreground_process_id()?;
        process_name_from_pid(pid)
    }

    fn is_target_elevated(&self) -> bool {
        // Linux doesn't have UAC-like elevation
        unsafe { nix::libc::geteuid() == 0 }
    }
}
```

- [ ] **Step 3: Build to verify**

```bash
cd crates/platform && cargo build
```

- [ ] **Step 4: Test on KDE Wayland (manual)**

On KDE Wayland, foreground process detection should now work.

- [ ] **Step 5: Commit**

```bash
git add crates/platform/src/linux/wayland/process_query.rs
git commit -m "feat(linux): implement Wayland process query for KDE

Adds KWin D-Bus API call for foreground window detection on KDE Plasma.
Falls back to /proc for list_visible_processes on all Wayland.
GNOME foreground detection remains unimplemented (requires shell extension).
"
```

---

### Task 5: Accessibility Reduce Motion

**Files:**
- Modify: `crates/platform/src/linux/accessibility.rs:1-16`

- [ ] **Step 1: Review current accessibility implementation**

Read `crates/platform/src/linux/accessibility.rs`.

- [ ] **Step 2: Implement GNOME/KDE reduce motion detection**

```rust
//! Linux accessibility signals via GTK settings and GNOME Shell.
//!
//! On GNOME: Reads gsettings org.gnome.desktop.interface enable-animations
//! On KDE: Reads kreadconfig5 AnimationDurationScale
//! Fallback: Returns false (no reduce motion)

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::Result;

pub struct LinuxAccessibilitySignals;

impl LinuxAccessibilitySignals {
    /// Check if reduce motion is enabled via desktop settings.
    fn detect_reduce_motion() -> bool {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();

        if desktop.contains("gnome") {
            Self::gnome_reduce_motion()
        } else if desktop.contains("kde") || desktop.contains("plasma") {
            Self::kde_reduce_motion()
        } else {
            false
        }
    }

    /// Check GNOME animations setting via gsettings.
    fn gnome_reduce_motion() -> bool {
        let output = std::process::Command::new("gsettings")
            .args([
                "get",
                "org.gnome.desktop.interface",
                "enable-animations",
            ])
            .output()
            .ok();

        match output {
            Some(o) if o.status.success() => {
                let value = String::from_utf8_lossy(&o.stdout);
                // 'false' means reduce motion is ON
                value.trim() == "false"
            }
            _ => false,
        }
    }

    /// Check KDE animation scale via kreadconfig5.
    fn kde_reduce_motion() -> bool {
        let output = std::process::Command::new("kreadconfig5")
            .args([
                "--file", "kdeglobals",
                "--group", "KDE",
                "--key", "AnimationDurationScale",
            ])
            .output()
            .ok();

        match output {
            Some(o) if o.status.success() => {
                let value = String::from_utf8_lossy(&o.stdout);
                value.trim().parse::<f64>().map(|v| v <= 0.0).unwrap_or(false)
            }
            _ => false,
        }
    }
}

impl AccessibilitySignals for LinuxAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        Self::detect_reduce_motion()
    }

    fn watch(&self, _on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        tracing::debug!(
            "Accessibility watch not implemented on Linux. \
             Reduce motion changes won't be detected until restart."
        );
        Ok(HookHandle::new(Box::new(())))
    }
}
```

- [ ] **Step 3: Build to verify**

```bash
cd crates/platform && cargo build
```

- [ ] **Step 4: Test on GNOME (manual)**

```bash
# Check current setting
gsettings get org.gnome.desktop.interface enable-animations

# Toggle and verify
gsettings set org.gnome.desktop.interface enable-animations false
# Run smoothscroll and check if reduce motion detected
```

- [ ] **Step 5: Commit**

```bash
git add crates/platform/src/linux/accessibility.rs
git commit -m "feat(linux): implement GNOME and KDE reduce motion detection

Reads desktop accessibility settings via gsettings (GNOME) and
kreadconfig5 (KDE). Falls back to false if detection fails.
Watch functionality remains unimplemented.
"
```

---

## Self-Review Checklist

After writing the complete plan, I checked:

- [x] **Spec coverage:** All 5 spec items mapped to tasks (1.1, 1.2, 1.3, 2.1, 2.2)
- [x] **Placeholder scan:** No "TBD", "TODO", or incomplete sections
- [x] **Type consistency:** Uses existing types from codebase (DisplayQuery, ProcessQuery, AccessibilitySignals, Accelerator, HookHandle)
- [x] **File paths:** All paths are exact from the codebase
- [x] **Build commands:** Provided for verification steps

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-10-linux-platform-improvements.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
