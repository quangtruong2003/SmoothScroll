//! Fullscreen detection stub for Wayland.
//!
//! Wayland does not provide a standard protocol for detecting
//! fullscreen windows. This stub always returns false.

use crate::traits::FullscreenDetector;

pub struct WaylandFullscreenDetector;

impl FullscreenDetector for WaylandFullscreenDetector {
    fn is_foreground_fullscreen(&self) -> bool {
        // Wayland doesn't expose this information to clients
        // Return false as safe default
        false
    }
}
