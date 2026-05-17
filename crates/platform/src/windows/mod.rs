//! Windows platform implementation.

#![cfg(windows)]

mod autostart;
mod hotkey;
mod keyboard;
mod mouse_hook;
mod process_query;
mod timer;
mod wheel_emitter;
pub mod window_geom;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub use autostart::WindowsAutostart;
pub use hotkey::WindowsHotkey;
pub use mouse_hook::WindowsMouseHook;
pub use process_query::WindowsProcessQuery;
pub use timer::HighResTimerGuard;
pub use wheel_emitter::WindowsWheelEmitter;
pub use window_geom::WindowsWindowGeometry;

pub fn build() -> Result<Platform> {
    Ok(Platform {
        mouse_hook: Arc::new(WindowsMouseHook::new()),
        wheel_emitter: Arc::new(WindowsWheelEmitter),
        process_query: Arc::new(WindowsProcessQuery::new()),
        autostart: Arc::new(WindowsAutostart),
        hotkey: Arc::new(WindowsHotkey),
    })
}
