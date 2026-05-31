//! macOS platform implementation. All real impls landed in M7.

#![cfg(target_os = "macos")]

mod accessibility;
mod autostart;
mod event_tap;
pub mod fullscreen;
mod hotkey;
mod mouse_hook;
mod permissions;
mod process_query;
mod wheel_emitter;
pub mod window_geom;

pub use accessibility::MacosAccessibilitySignals;
pub use autostart::MacosAutostart;
pub use event_tap::{run_event_loop, ScrollInputSource};
pub use fullscreen::MacosFullscreenDetector;
pub use hotkey::MacosHotkey;
pub use mouse_hook::MacosMouseHook;
pub use permissions::is_trusted as is_accessibility_trusted;
pub use process_query::MacosProcessQuery;
pub use wheel_emitter::MacosWheelEmitter;
pub use window_geom::MacosWindowGeometry;

use crate::traits::{MouseHook, ProcessQuery, WheelEmitter, ZoomEmitter};
use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub fn build() -> Result<Platform> {
    Ok(Platform {
        mouse_hook: Arc::new(MacosMouseHook::new()),
        wheel_emitter: Arc::new(MacosWheelEmitter::new()),
        zoom_emitter: Arc::new(MacosWheelEmitter::new()),
        process_query: Arc::new(MacosProcessQuery::new()),
        autostart: Arc::new(MacosAutostart),
        hotkey: Arc::new(MacosHotkey),
        accessibility: Arc::new(MacosAccessibilitySignals),
    })
}
