//! Cursor position relative to window via XQueryPointer.

use crate::traits::WindowGeometry;
use crate::types::{Point, WindowRect};
use x11::xlib;

use super::display;

pub struct LinuxWindowGeometry;

impl WindowGeometry for LinuxWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        unsafe {
            let d = display::open_display().ok()?;
            let root = display::root_window(d);

            let mut root_return: xlib::Window = 0;
            let mut child_return: xlib::Window = 0;
            let mut root_x: i32 = 0;
            let mut root_y: i32 = 0;
            let mut win_x: i32 = 0;
            let mut win_y: i32 = 0;
            let mut mask: u32 = 0;

            let ok = xlib::XQueryPointer(
                d, root, &mut root_return, &mut child_return,
                &mut root_x, &mut root_y, &mut win_x, &mut win_y, &mut mask,
            );

            if ok == 0 {
                display::close_display(d);
                return None;
            }

            let target = if child_return != 0 { child_return } else { root_return };

            let mut attrs: xlib::XWindowAttributes = std::mem::zeroed();
            if xlib::XGetWindowAttributes(d, target, &mut attrs) == 0 {
                display::close_display(d);
                return None;
            }

            display::close_display(d);

            Some((
                Point { x: root_x, y: root_y },
                WindowRect {
                    left: attrs.x,
                    top: attrs.y,
                    right: attrs.x + attrs.width,
                    bottom: attrs.y + attrs.height,
                },
            ))
        }
    }
}
