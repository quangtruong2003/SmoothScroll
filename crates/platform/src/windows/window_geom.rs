#![cfg(windows)]

use crate::traits::WindowGeometry;
use crate::types::{Point, WindowRect};
use std::mem;
use windows_sys::Win32::Foundation::{HWND, POINT, RECT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetAncestor, GetCursorPos, GetWindowRect, WindowFromPoint, GA_ROOT,
};

pub struct WindowsWindowGeometry;

impl WindowGeometry for WindowsWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        unsafe {
            let mut pt: POINT = mem::zeroed();
            if GetCursorPos(&mut pt) == 0 { return None; }
            let hwnd: HWND = WindowFromPoint(pt);
            if hwnd.is_null() { return None; }
            let top = GetAncestor(hwnd, GA_ROOT);
            let mut rc: RECT = mem::zeroed();
            if GetWindowRect(top, &mut rc) == 0 { return None; }
            Some((
                Point { x: pt.x, y: pt.y },
                WindowRect { left: rc.left, top: rc.top, right: rc.right, bottom: rc.bottom },
            ))
        }
    }
}
