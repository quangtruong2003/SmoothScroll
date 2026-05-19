//! macOS platform implementation. All real impls landed in M7.

#![cfg(target_os = "macos")]

mod accessibility;
mod autostart;
pub mod fullscreen;
mod hotkey;
pub mod keyboard_scroll_hook;
mod mouse_hook;
mod permissions;
mod process_query;
mod wheel_emitter;
pub mod window_geom;

pub use accessibility::MacosAccessibilitySignals;
pub use autostart::MacosAutostart;
pub use fullscreen::MacosFullscreenDetector;
pub use hotkey::MacosHotkey;
pub use keyboard_scroll_hook::MacosKeyboardScrollHook;
pub use mouse_hook::MacosMouseHook;
pub use permissions::is_trusted as is_accessibility_trusted;
pub use process_query::MacosProcessQuery;
pub use wheel_emitter::MacosWheelEmitter;
pub use window_geom::MacosWindowGeometry;

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
        accessibility: Arc::new(MacosAccessibilitySignals),
    })
}
