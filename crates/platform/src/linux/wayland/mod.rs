//! Wayland implementation using evdev + uinput.
//!
//! This module is only compiled and used when `XDG_SESSION_TYPE=wayland` is detected.
//! Uses exclusive device grab for scroll interception and uinput for injection.

pub mod evdev_scanner;
pub mod keyboard;
pub mod mouse_hook;
pub mod permission;
pub mod process_query;
pub mod hotkey;
pub mod fullscreen;
pub mod wheel_emitter;

use crate::types::Result;
use std::sync::Arc;

/// Build Wayland platform implementation.
pub fn build() -> Result<crate::Platform> {
    // Permissions check
    permission::check_uinput_access()?;
    
    // Create components
    let wheel_emitter = Arc::new(wheel_emitter::WaylandWheelEmitter::new()?);
    
    Ok(crate::Platform {
        mouse_hook: Arc::new(mouse_hook::WaylandMouseHook::new()?),
        wheel_emitter: wheel_emitter.clone(),
        zoom_emitter: wheel_emitter,
        process_query: Arc::new(process_query::WaylandProcessQuery::new()),
        autostart: Arc::new(crate::linux::LinuxAutostart),
        hotkey: Arc::new(hotkey::WaylandHotkey),
        accessibility: Arc::new(crate::linux::LinuxAccessibilitySignals),
    })
}
