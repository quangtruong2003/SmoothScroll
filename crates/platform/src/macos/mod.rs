//! macOS platform implementation.

#![cfg(target_os = "macos")]

mod accessibility;
mod autostart;
mod display;
pub mod event_tap;
pub mod fullscreen;
mod hotkey;
mod mouse_hook;
mod permissions;
mod process_query;
mod wheel_emitter;
pub mod window_geom;

pub use accessibility::MacosAccessibilitySignals;
pub use autostart::MacosAutostart;
pub use display::MacosDisplayQuery;
pub use event_tap::{run_event_loop, ScrollInputSource, HotkeyRegistry};
pub use fullscreen::MacosFullscreenDetector;
pub use hotkey::MacosHotkey;
pub use mouse_hook::MacosMouseHook;
pub use permissions::is_trusted as is_accessibility_trusted;
pub use process_query::MacosProcessQuery;
pub use wheel_emitter::MacosWheelEmitter;
pub use window_geom::MacosWindowGeometry;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub fn build() -> Result<Platform> {
    let wheel_emitter = Arc::new(MacosWheelEmitter::new());
    Ok(Platform {
        mouse_hook: Arc::new(MacosMouseHook::new()),
        wheel_emitter: wheel_emitter.clone(),
        zoom_emitter: wheel_emitter, // MacosWheelEmitter implements ZoomEmitter too
        process_query: Arc::new(MacosProcessQuery::new()),
        autostart: Arc::new(MacosAutostart),
        hotkey: Arc::new(MacosHotkey),
        accessibility: Arc::new(MacosAccessibilitySignals),
        display: Arc::new(MacosDisplayQuery),
    })
}