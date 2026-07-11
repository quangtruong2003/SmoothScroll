//! OS-abstraction layer for SmoothScroll.

pub mod icon;
pub mod traits;
pub mod types;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(windows)]
pub mod windows;

pub use traits::*;
pub use types::*;

use std::sync::Arc;

/// Bundle of platform implementations for the current OS.
pub struct Platform {
    pub mouse_hook: Arc<dyn MouseHook>,
    pub wheel_emitter: Arc<dyn WheelEmitter>,
    pub zoom_emitter: Arc<dyn ZoomEmitter>,
    pub process_query: Arc<dyn ProcessQuery>,
    pub autostart: Arc<dyn Autostart>,
    pub hotkey: Arc<dyn Hotkey>,
    pub accessibility: Arc<dyn AccessibilitySignals>,
    pub display: Arc<dyn DisplayQuery>,
}

/// Build the platform bundle for the current OS. Real impls land in M2 (Windows)
/// and M7 (macOS); M1 returns no-op stubs so the app crate compiles.
pub fn current() -> Result<Platform> {
    #[cfg(windows)]
    {
        windows::build()
    }
    #[cfg(target_os = "macos")]
    {
        macos::build()
    }
    #[cfg(target_os = "linux")]
    {
        linux::build()
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        Err(PlatformError::Unsupported)
    }
}
