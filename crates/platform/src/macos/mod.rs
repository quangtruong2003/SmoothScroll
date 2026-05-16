//! macOS platform implementation. All real impls landed in M7.

#![cfg(target_os = "macos")]

mod autostart;
mod hotkey;
mod mouse_hook;
mod permissions;
mod process_query;
mod wheel_emitter;

pub use autostart::MacosAutostart;
pub use hotkey::MacosHotkey;
pub use mouse_hook::MacosMouseHook;
pub use permissions::is_trusted as is_accessibility_trusted;
pub use process_query::MacosProcessQuery;
pub use wheel_emitter::MacosWheelEmitter;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub fn build() -> Result<Platform> {
    Ok(Platform {
        mouse_hook: Arc::new(MacosMouseHook::new()),
        wheel_emitter: Arc::new(MacosWheelEmitter),
        process_query: Arc::new(MacosProcessQuery::new()),
        autostart: Arc::new(MacosAutostart),
        hotkey: Arc::new(MacosHotkey),
    })
}
