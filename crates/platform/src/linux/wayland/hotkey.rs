//! Global hotkey stub for Wayland.
//!
//! Wayland does not have a standard way to register global hotkeys.
//! X11's XGrabKey is not available. This is a known limitation.
//!
//! For full hotkey support on Wayland, compositor-specific integrations
//! or xdg-desktop-portal GlobalShortcuts API would be needed.

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, Result};

static HOTKEYS_AVAILABLE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub struct WaylandHotkey;

impl Hotkey for WaylandHotkey {
    fn register(
        &self,
        accel: Accelerator,
        _callback: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        if !HOTKEYS_AVAILABLE.load(std::sync::atomic::Ordering::Relaxed) {
            eprintln!(
                "Warning: Global hotkeys are not available on Wayland.\n\
                 Accelerator '{}' will not be registered.\n\
                 To enable hotkeys, use X11 session instead.",
                accel
            );
        }

        // Return a no-op handle
        Ok(HotkeyHandle::new(Box::new(())))
    }
}
