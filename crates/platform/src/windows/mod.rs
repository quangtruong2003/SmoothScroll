//! Windows platform implementation.

#![cfg(windows)]

mod accessibility;
mod autostart;
mod display;
pub mod fullscreen;
mod horizontal_scroll;
mod hotkey;
mod keyboard;
mod mouse_hook;
mod process_query;
pub mod text_input_detector;
mod timer;
mod wheel_emitter;
pub mod window_geom;

/// Marks mouse input emitted by SmoothScroll so the low-level hook can ignore
/// only our own feedback events while still accepting driver-injected wheels.
const SMOOTHSCROLL_INPUT_MARKER: usize = 0x5353_4352;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub use accessibility::WindowsAccessibilitySignals;
pub use autostart::WindowsAutostart;
pub use display::WindowsDisplayQuery;
pub use fullscreen::WindowsFullscreenDetector;
pub use hotkey::WindowsHotkey;
pub use mouse_hook::WindowsMouseHook;
pub use process_query::WindowsProcessQuery;
pub use text_input_detector::is_focus_in_text_input;
pub use timer::HighResTimerGuard;
pub use wheel_emitter::{
    diagnose_native_plan, NativePlanDiagnostics, PlanError, WindowsWheelEmitter,
};
pub use window_geom::WindowsWindowGeometry;

pub fn build() -> Result<Platform> {
    horizontal_scroll::HorizontalScrollDispatcher::initialize()?;
    let wheel_emitter: Arc<WindowsWheelEmitter> = Arc::new(WindowsWheelEmitter);
    Ok(Platform {
        mouse_hook: Arc::new(WindowsMouseHook::new()),
        semantic_emitter: wheel_emitter,
        process_query: Arc::new(WindowsProcessQuery::new()),
        autostart: Arc::new(WindowsAutostart),
        hotkey: Arc::new(WindowsHotkey),
        accessibility: Arc::new(WindowsAccessibilitySignals),
        display: Arc::new(WindowsDisplayQuery),
    })
}
