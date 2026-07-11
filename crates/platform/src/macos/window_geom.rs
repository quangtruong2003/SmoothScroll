#![cfg(target_os = "macos")]

use crate::traits::{MonitorEnumeration, MonitorInfo, WindowGeometry};
use crate::types::{Point, WindowRect};

pub struct MacosWindowGeometry;

impl WindowGeometry for MacosWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        // Stub: future implementer must use Accessibility/Window Server APIs to check if
        // the current cursor position is within the active app's main window bounds.
        None
    }
}

impl MonitorEnumeration for MacosWindowGeometry {
    fn list_monitors(&self) -> Vec<MonitorInfo> {
        // Stub: future implementer must iterate over NSScreen.screens and return
        // MonitorInfo containing screen name, device name, and display geometry.
        Vec::new()
    }
}
