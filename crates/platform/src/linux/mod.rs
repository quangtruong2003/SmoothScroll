//! Linux platform implementation (X11 or Wayland).

#[cfg(target_os = "linux")]
pub mod wayland;

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

#[cfg(target_os = "linux")]
mod refresh_rate;

pub use accessibility::LinuxAccessibilitySignals;
pub use autostart::LinuxAutostart;
pub use fullscreen::LinuxFullscreenDetector;
pub use hotkey::LinuxHotkey;
pub use keyboard::ModifierSampler;
pub use mouse_hook::LinuxMouseHook;
pub use process_query::LinuxProcessQuery;
#[cfg(target_os = "linux")]
pub use refresh_rate::LinuxDisplayQuery;
pub use timer::LinuxHighResTimerGuard;

#[cfg(target_os = "linux")]
pub use wheel_emitter::LinuxWheelEmitter;

#[cfg(target_os = "linux")]
pub use window_geom::LinuxWindowGeometry;

use crate::types::Result;
use crate::Platform;
use std::sync::Arc;

#[cfg(target_os = "linux")]
pub fn build() -> Result<Platform> {
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();

    match session_type.as_str() {
        "wayland" => wayland::build(),
        "x11" | "" => {
            eprintln!(
                "SmoothScroll: X11 session detected.\n\
                 \n\
                 WARNING: X11 has limited scroll smoothing support.\n\
                 Due to X11 protocol limitations, scroll events cannot be\n\
                 intercepted and replaced — smooth scroll is added on top\n\
                 of your normal scroll, which may cause double-scroll.\n\
                 \n\
                 For the best experience, use Wayland.\n\
                 \n\
                 To switch: Log out → Select 'GNOME on Wayland' (or your\n\
                 desktop's Wayland session) at the login screen."
            );
            x11_build()
        }
        other => {
            eprintln!(
                "SmoothScroll: Unknown session type '{other}'.\n\
                 Falling back to X11 implementation."
            );
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
        display: Arc::new(LinuxDisplayQuery),
    })
}
