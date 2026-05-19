#![cfg(windows)]

use crate::traits::FullscreenDetector;
use std::mem;
use windows_sys::Win32::Foundation::RECT;
use windows_sys::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetWindowRect,
};

pub struct WindowsFullscreenDetector;

const SHELL_CLASSES: &[&str] = &["Progman", "WorkerW", "Shell_TrayWnd"];

impl FullscreenDetector for WindowsFullscreenDetector {
    fn is_foreground_fullscreen(&self) -> bool {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return false;
            }

            let mut buf = [0u16; 64];
            let n = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            let class = String::from_utf16_lossy(&buf[..n as usize]);
            if SHELL_CLASSES.contains(&class.as_str()) {
                return false;
            }

            let mut wr: RECT = mem::zeroed();
            if GetWindowRect(hwnd, &mut wr) == 0 {
                return false;
            }

            let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            let mut mi: MONITORINFO = mem::zeroed();
            mi.cbSize = mem::size_of::<MONITORINFO>() as u32;
            if GetMonitorInfoW(monitor, &mut mi) == 0 {
                return false;
            }

            wr.left == mi.rcMonitor.left
                && wr.top == mi.rcMonitor.top
                && wr.right == mi.rcMonitor.right
                && wr.bottom == mi.rcMonitor.bottom
        }
    }
}
