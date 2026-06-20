//! Linux X11 platform implementation.

mod accessibility;
mod display;
mod fullscreen;
mod hotkey;
mod keyboard;
mod mouse_hook;
mod process_query;
mod timer;
mod autostart;
mod wheel_emitter;
mod window_geom;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

pub use accessibility::LinuxAccessibilitySignals;
pub use autostart::LinuxAutostart;
pub use fullscreen::LinuxFullscreenDetector;
pub use hotkey::LinuxHotkey;
pub use keyboard::ModifierSampler;
pub use mouse_hook::LinuxMouseHook;
pub use process_query::LinuxProcessQuery;
pub use timer::LinuxHighResTimerGuard;
pub use wheel_emitter::LinuxWheelEmitter;
pub use window_geom::LinuxWindowGeometry;

pub fn build() -> Result<Platform> {
    if std::env::var("XDG_SESSION_TYPE").unwrap_or_default() == "wayland" {
        eprintln!(
            "SmoothScroll: Wayland session detected. \
             X11 is required — some features may not work. \
             Please log out and select 'GNOME on Xorg' or equivalent."
        );
    }

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
