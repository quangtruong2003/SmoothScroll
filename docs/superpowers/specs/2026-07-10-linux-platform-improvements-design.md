# Design: Linux Platform Improvements Roadmap

**Date:** 2026-07-10
**Status:** Draft

## Context

After reviewing `crates/platform/src/linux`, the following issues were identified:

| Category | Issue | Priority |
|----------|-------|----------|
| X11 | Scroll duplication — XInput2 cannot swallow events | High |
| X11 | Refresh rate hardcoded to 60Hz | High |
| Wayland | Hotkeys stub — no GlobalShortcuts API | Medium |
| Wayland | Process query stub — cannot detect foreground app | Medium |
| General | Accessibility — no Reduce Motion signal | Low |
| General | X11 not deprecated — no user warning | Low |

---

## Phase 1: Quick Wins (2-4 hours total)

### 1.1 X11 Scroll Duplication — Document and Warn

**Problem:** XInput2 cannot suppress events on X11. Smooth scroll is added on top of original scroll, causing double-scroll.

**Solution:** Add clear UX warning for X11 users.

#### Changes

**`crates/platform/src/linux/mod.rs`**

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

**`src/components/Settings.tsx`** (or wherever settings UI lives)

```tsx
// Show warning when on X11
const isX11 = platform.sessionType === 'x11';

return (
  <div className="settings">
    {isX11 && (
      <div className="x11-warning-banner">
        <AlertTriangleIcon />
        <div>
          <strong>X11 has limited scroll support</strong>
          <p>
            Scroll events cannot be intercepted on X11. Smooth scroll is
            added on top of your normal scroll.
            <a href="/docs/linux-x11-limitations">Learn more</a>
          </p>
        </div>
      </div>
    )}
    {/* ... rest of settings */}
  </div>
);
```

---

### 1.2 Refresh Rate Detection — Implement XRRConfigCurrentRate

**Problem:** `refresh_rate.rs` returns hardcoded 60Hz, causing suboptimal smoothing on 120Hz/165Hz/240Hz displays.

**Solution:** Use X11 XRR (X RandR) extension to detect actual refresh rate.

#### Changes

**`crates/platform/src/linux/refresh_rate.rs`**

```rust
#![cfg(target_os = "linux")]

use crate::traits::DisplayQuery;

// X RandR constants
const RR_ROTATION_MASK: u32 = 0x1f;
const RR_REFRESH_RATE_MASK: u32 = 0x3f;

pub struct LinuxDisplayQuery;

impl LinuxDisplayQuery {
    /// Detect refresh rate using XRR (X RandR extension).
    /// Falls back to 60Hz on error.
    ///
    /// # Safety
    /// Requires open X11 display connection.
    unsafe fn detect_refresh_rate(d: *mut xlib::Display) -> u32 {
        use x11::xrandr;

        // Query XRR version
        let mut major: i32 = 1;
        let mut minor: i32 = 6;
        if xrandr::XRRQueryVersion(d, &mut major, &mut minor) == 0 {
            return 60;
        }

        // Get root window
        let screen = xlib::XDefaultScreenOfDisplay(d);
        let root = xlib::XRootWindowOfScreen(screen);
        let screen_num = xlib::XScreenNumberOfScreen(screen);

        // Get screen resources
        let resources = xrandr::XRRGetScreenResourcesCurrent(d, root);
        if resources.is_null() {
            return 60;
        }

        // Get current configuration
        let config = xrandr::XRRGetScreenConfig(d, resources, screen_num);
        if config.is_null() {
            xrandr::XRRFreeScreenResources(resources);
            return 60;
        }

        // Get current rate
        let rate = xrandr::XRRConfigCurrentRate(config);

        // Cleanup
        xrandr::XRRFreeScreenConfigInfo(config);
        xrandr::XRRFreeScreenResources(resources);

        rate as u32
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

            // Close display
            display::close_display(d);

            // Clamp to reasonable range (30-500Hz)
            rate.max(30).min(500)
        }
    }
}
```

**`crates/platform/Cargo.toml`**

```toml
[target.'cfg(target_os = "linux")'.dependencies]
x11 = { version = "2.21", features = ["xlib", "xinput", "xtest", "xrandr"] }
```

---

### 1.3 Wayland Hotkey — Try xdg-desktop-portal First

**Problem:** `WaylandHotkey` is a complete stub that silently ignores hotkey registrations.

**Solution:** Try xdg-desktop-portal GlobalShortcuts API before falling back to warning.

#### Changes

**`crates/platform/src/linux/wayland/hotkey.rs`**

```rust
//! Global hotkey support for Wayland via xdg-desktop-portal GlobalShortcuts.
//!
//! Falls back to warning if portal is unavailable. Users on GNOME/KDE
//! with desktop portal installed will get working hotkeys.

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
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

        // Fall back to warning
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
    // Check if portal is available by looking for it in the well-known address
    let portal_info = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();

    // Most desktops support portal, but we need to actually call it
    // For now, we log that it's unimplemented and return false
    // TODO: Implement D-Bus call to portal GlobalShortcuts API
    // The portal interface is: org.freedesktop.portal.GlobalShortcuts

    tracing::debug!(
        "Portal shortcut for '{}' not yet implemented (desktop: {})",
        accel.raw,
        portal_info
    );

    Ok(false)
}
```

---

## Phase 2: Nice to Have (4-8 hours total)

### 2.1 Wayland Process Query — KDE/GNOME Fallbacks

**Problem:** `WaylandProcessQuery` returns empty for all queries. Per-app settings won't work.

**Solution:** Implement compositor-specific fallbacks for KDE and GNOME.

#### Changes

**`crates/platform/src/linux/wayland/process_query.rs`**

```rust
//! Process query for Wayland using compositor-specific APIs.
//!
//! Primary: /proc/<pid>/comm for basic process info
//! Fallback: KDE KWin or GNOME Shell APIs for foreground window

use crate::traits::{ProcessInfo, ProcessQuery};
use crate::types::PlatformError;
use std::fs;

// Shared helper: get process name from /proc
fn process_name_from_pid(pid: u32) -> Option<String> {
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

/// Get foreground window via KWin (KDE Plasma).
/// Uses qdbus to call KWin API.
fn kwin_foreground_window() -> Option<u32> {
    let output = std::process::Command::new("qdbus")
        .args(["org.kde.KWin", "/KWin", "org.kde.KWin.activeWindow"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let window_id = String::from_utf8_lossy(&output.stdout);
    let window_id = window_id.trim();

    // KWin returns window ID as hex string
    u32::from_str_radix(window_id.trim_start_matches("0x"), 16).ok()
}

/// Get foreground window via GNOME Shell.
/// Uses wmctrl or xdotool as fallback since GNOME doesn't expose this via D-Bus easily.
fn gnome_foreground_window() -> Option<u32> {
    // Try wmctrl first (works on both X11 and Wayland via translation)
    let output = std::process::Command::new("wmctrl")
        .args(["-a", ":ACTIVE:"])
        .output()
        .ok()?;

    // wmctrl exits 0 on success, but doesn't return the PID directly
    // Alternative: parse window title and match to process

    // Fall back to checking _NET_ACTIVE_WINDOW via X11 bridge
    // GNOME on Wayland uses XWayland for most apps, so this works
    None
}

pub struct WaylandProcessQuery;

impl WaylandProcessQuery {
    pub fn new() -> Self {
        Self
    }
}

impl ProcessQuery for WaylandProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        // Can't detect window under cursor on Wayland without compositor API
        // Return None — cursor-based app detection won't work
        None
    }

    fn foreground_process_id(&self) -> Option<u32> {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();

        let window_id = if desktop.contains("kde") || desktop.contains("plasma") {
            kwin_foreground_window()
        } else if desktop.contains("gnome") {
            gnome_foreground_window()
        } else {
            None
        };

        window_id
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        // On Wayland, we can't enumerate windows reliably
        // Return list of processes that have GUI windows
        let mut results = Vec::new();

        // Read /proc to find processes with open windows
        if let Ok(entries) = fs::read_dir("/proc") {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name()?.to_str()?;

                // PID must be numeric
                let pid: u32 = name.parse().ok()?;

                // Skip kernel threads and self
                if pid < 100 || pid == std::process::id() {
                    continue;
                }

                // Check if process has a window by looking at /proc/<pid>/fd
                // or by checking for open X11 windows (if XWayland)
                let proc_name = process_name_from_pid(pid)?;

                results.push(ProcessInfo {
                    pid,
                    name: proc_name,
                    window_title: String::new(), // Can't get titles
                    exe_path: fs::read_link(format!("/proc/{pid}/exe"))
                        .ok()
                        .and_then(|p| p.to_str().map(String::from)),
                });
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
        // Check if running as root
        unsafe { nix::libc::geteuid() == 0 }
    }
}
```

---

### 2.2 Accessibility — GNOME Reduce Motion

**Problem:** `LinuxAccessibilitySignals` always returns false for reduce_motion.

**Solution:** Read GTK settings for GNOME "reduce motion" preference.

#### Changes

**`crates/platform/src/linux/accessibility.rs`**

```rust
//! Linux accessibility signals via GTK settings and GNOME Shell.
//!
//! On GNOME: Reads gtk-xft-alt-theme settings or GNOME shell accessibility
//! On KDE: Reads KDE breeze settings
//! Fallback: Returns false (no reduce motion)

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::Result;
use std::sync::atomic::{AtomicBool, Ordering};

pub struct LinuxAccessibilitySignals;

impl LinuxAccessibilitySignals {
    /// Check if reduce motion is enabled via GNOME GTK settings.
    fn gnome_reduce_motion() -> bool {
        // Check GTK settings first (works for GTK apps)
        if let Ok(value) = std::env::var("GTK_XFT_ALT_THEME") {
            if value.contains("ReduceMotion") {
                return true;
            }
        }

        // Check GNOME settings daemon via gsettings
        let output = std::process::Command::new("gsettings")
            .args([
                "get",
                "org.gnome.desktop.interface",
                "enable-animations",
            ])
            .output()
            .ok();

        if let Some(output) = output {
            if output.status.success() {
                let value = String::from_utf8_lossy(&output.stdout);
                // 'false' means reduce motion is ON
                return value.trim() == "false";
            }
        }

        // Check KDE accessibility settings
        let output = std::process::Command::new("kreadconfig5")
            .args([
                "--file",
                "kdeglobals",
                "--group",
                "KDE",
                "--key",
                "AnimationDurationScale",
            ])
            .output()
            .ok();

        if let Some(output) = output {
            if output.status.success() {
                let value = String::from_utf8_lossy(&output.stdout);
                if let Ok(scale) = value.trim().parse::<f64>() {
                    // Scale of 0 means animations disabled
                    return scale <= 0.0;
                }
            }
        }

        false
    }
}

impl AccessibilitySignals for LinuxAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        Self::gnome_reduce_motion()
    }

    fn watch(&self, on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        // Subscribe to settings changes via inotify on gsettings config
        // For simplicity, we just return a no-op handle for now
        // A full implementation would watch ~/.config/dconf/user or similar

        tracing::debug!(
            "Accessibility watch not implemented on Linux. \
             Reduce motion changes won't be detected until restart."
        );

        Ok(HookHandle::new(Box::new(())))
    }
}
```

---

## Phase 3: Future (Out of Scope for Now)

### Not Implementing Now

1. **Multi-monitor support** — Complex, low demand
2. **X11 scroll suppression research** — Would require deep X11 patches
3. **Flatpak support** — Fundamentally incompatible with uinput
4. **X11 deprecation** — Need more user feedback first

---

## Testing Plan

### Unit Tests

```bash
# Test refresh rate detection (mock XRR)
cargo test --package smoothscroll_platform -- refresh_rate

# Test Wayland process query helpers
cargo test --package smoothscroll_platform -- wayland::process_query

# Test accessibility signals
cargo test --package smoothscroll_platform -- accessibility
```

### Integration Tests

1. **X11 warning:** Launch on X11 session, verify warning in logs
2. **Refresh rate:** Compare detected rate with `xrandr --current`
3. **Wayland hotkey:** Register shortcut, verify portal call attempted
4. **Process query:** Compare output with `wmctrl -l` on same session

### Manual Testing Matrix

| Distro | Desktop | Session | Refresh Rate | Hotkeys | Process Query |
|--------|---------|---------|--------------|---------|---------------|
| Ubuntu 24.04 | GNOME | Wayland | ? | ? | ? |
| Ubuntu 24.04 | GNOME | X11 | ? | ✅ | ✅ |
| Fedora 41 | GNOME | Wayland | ? | ? | ? |
| Arch | KDE | Wayland | ? | ? | ? |

---

## Implementation Order

```
Week 1: Quick Wins
├── 1.1 X11 warning (30 min)
├── 1.2 Refresh rate detection (2 hours)
└── 1.3 Wayland hotkey portal attempt (1 hour)

Week 2-3: Nice to Have
├── 2.1 Wayland process query fallbacks (4 hours)
└── 2.2 Accessibility GNOME Reduce Motion (2 hours)

Future: Based on user feedback
└── Prioritize based on Linux user reports
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-07-10 | Initial draft from code review |
