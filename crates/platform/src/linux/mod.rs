//! Linux platform implementation (X11 or Wayland).

#[cfg(target_os = "linux")]
mod wayland;

#[cfg(target_os = "linux")]
pub use wayland;

mod accessibility;
mod autostart;
mod fullscreen;
mod hotkey;
mod keyboard;
mod mouse_hook;
mod process_query;
mod timer;
mod window_geom;

#[cfg(target_os = "linux")]
mod wheel_emitter;

#[cfg(target_os = "linux")]
mod display;

pub use accessibility::LinuxAccessibilitySignals;
pub use autostart::LinuxAutostart;
pub use fullscreen::LinuxFullscreenDetector;
pub use hotkey::LinuxHotkey;
pub use keyboard::ModifierSampler;
pub use mouse_hook::LinuxMouseHook;
pub use process_query::LinuxProcessQuery;
pub use timer::LinuxHighResTimerGuard;

#[cfg(target_os = "linux")]
pub use wheel_emitter::LinuxWheelEmitter;

#[cfg(target_os = "linux")]
pub use window_geom::LinuxWindowGeometry;

use crate::types::Result;
use std::sync::Arc;

#[cfg(target_os = "linux")]
pub fn build() -> Result<Platform> {
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
    
    match session_type.as_str() {
        "wayland" => {
            wayland::build()
        }
        _ => {
            // X11 session or unknown - use X11 implementation
            x11_build()
        }
    }
}

#[cfg(target_os = "linux")]
fn x11_build() -> Result<Platform> {
    let wheel_emitter: Arc<LinuxWheelEmitter> = Arc::new(LinuxWheelEmitter::new()?);
    Ok(Platform {
        mouse_hook: Arc::new(LinuxMouseHook::new()?),
        wheel_emitter: wheel_emitter.clone(),
        zoom_emitter: wheel_emitter,
        process_query: Arc::new(LinuxProcessQuery::new()?),
        autostart: Arc::new(LinuxAutostart),
        hotkey: Arc::new(LinuxHotkey),
        accessibility: Arc::new(LinuxAccessibilitySignals),
    })
}
