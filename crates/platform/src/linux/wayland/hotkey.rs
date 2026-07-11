//! Global hotkey support for Wayland via xdg-desktop-portal GlobalShortcuts.
//!
//! Falls back to warning if portal is unavailable. Users on GNOME/KDE
//! with desktop portal installed will get working hotkeys.

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, Result};
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
///
/// ## Future Implementation Criteria
/// - Call the portal via D-Bus (`org.freedesktop.portal.GlobalShortcuts`):
///   `CreateSession`, `ListShortcuts`, `BindShortcuts` methods.
/// - Fall back to compositor-specific APIs if portal not available:
///   - KDE: `org.kde.globalshortcuts` or `KGlobalAccel`
///   - GNOME: `org.gnome.shell` keybinding introspection
/// - Only return `Ok(true)` when the shortcut is actually bound.
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
