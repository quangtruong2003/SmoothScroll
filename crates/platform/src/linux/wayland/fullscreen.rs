//! Fullscreen detection stub for Wayland.
//!
//! Wayland does not provide a standard protocol for detecting
//! fullscreen windows. This stub always returns false.

use crate::traits::FullscreenDetector;

pub struct WaylandFullscreenDetector;

impl FullscreenDetector for WaylandFullscreenDetector {
    fn is_foreground_fullscreen(&self) -> bool {
        // ## Future Implementation Criteria
        // - Query compositor for focused window size vs screen bounds:
        //   - KDE: D-Bus org.kde.KWin or check _NET_WM_STATE_FULLSCREEN
        //   - GNOME: org.gnome.Shell introspection
        //   - wlroots compositors: wlr-foreign-toplevel-management protocol
        // Return false as safe default when detection unavailable.
        false
    }
}
