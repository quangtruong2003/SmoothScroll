#![cfg(target_os = "macos")]

use crate::traits::FullscreenDetector;

pub struct MacosFullscreenDetector;

impl FullscreenDetector for MacosFullscreenDetector {
    fn is_foreground_fullscreen(&self) -> bool {
        // Stub: future implementer must query the frontmost application's main window geometry
        // via Accessibility APIs (AXUIElementCopyAttributeValue for AXFrontmostApplication / AXWindows)
        // and check if its size matches the bounds of the active NSScreen.
        false
    }
}
