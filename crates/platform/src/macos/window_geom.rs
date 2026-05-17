#![cfg(target_os = "macos")]

use crate::traits::WindowGeometry;
use crate::types::{Point, WindowRect};

pub struct MacosWindowGeometry;

impl WindowGeometry for MacosWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        None
    }
}
