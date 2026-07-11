#![cfg(windows)]

use crate::traits::{MonitorEnumeration, MonitorInfo, WindowGeometry};
use crate::types::{Point, WindowRect};
use std::mem;
use windows_sys::Win32::Foundation::{HWND, POINT, RECT};
use windows_sys::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, GetMonitorInfoW, MonitorFromWindow, HDC, HMONITOR, MONITORINFOEXW,
    MONITOR_DEFAULTTONEAREST,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetAncestor, GetCursorPos, GetWindowRect, WindowFromPoint, GA_ROOT,
};

pub struct WindowsWindowGeometry;

impl WindowGeometry for WindowsWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        unsafe {
            let mut pt: POINT = mem::zeroed();
            if GetCursorPos(&mut pt) == 0 {
                return None;
            }
            let hwnd: HWND = WindowFromPoint(pt);
            if hwnd.is_null() {
                return None;
            }
            let top = GetAncestor(hwnd, GA_ROOT);
            let mut rc: RECT = mem::zeroed();
            if GetWindowRect(top, &mut rc) == 0 {
                return None;
            }
            Some((
                Point { x: pt.x, y: pt.y },
                WindowRect {
                    left: rc.left,
                    top: rc.top,
                    right: rc.right,
                    bottom: rc.bottom,
                },
            ))
        }
    }

    fn monitor_for_hwnd(&self, hwnd: isize) -> Option<String> {
        unsafe {
            let hmon = MonitorFromWindow(hwnd as HWND, MONITOR_DEFAULTTONEAREST);
            if hmon.is_null() {
                return None;
            }
            let mut info: MONITORINFOEXW = mem::zeroed();
            info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
            let info_ptr = &mut info as *mut MONITORINFOEXW
                as *mut windows_sys::Win32::Graphics::Gdi::MONITORINFO;
            if GetMonitorInfoW(hmon, info_ptr) == 0 {
                return None;
            }
            // szDevice is a null-terminated UTF-16 array
            let name = String::from_utf16_lossy(
                &info.szDevice[..info
                    .szDevice
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(info.szDevice.len())],
            );
            Some(name)
        }
    }
}

impl MonitorEnumeration for WindowsWindowGeometry {
    fn list_monitors(&self) -> Vec<MonitorInfo> {
        unsafe extern "system" fn enum_cb(
            hmon: HMONITOR,
            _hdc: HDC,
            _rect: *mut RECT,
            lparam: isize,
        ) -> i32 {
            let out = &mut *(lparam as *mut Vec<MonitorInfo>);

            let mut info: MONITORINFOEXW = mem::zeroed();
            info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
            let info_ptr = &mut info as *mut MONITORINFOEXW
                as *mut windows_sys::Win32::Graphics::Gdi::MONITORINFO;
            if GetMonitorInfoW(hmon, info_ptr) == 0 {
                return 1; // continue
            }

            let device_name = String::from_utf16_lossy(
                &info.szDevice[..info
                    .szDevice
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(info.szDevice.len())],
            );
            let rc = &info.monitorInfo.rcMonitor;

            out.push(MonitorInfo {
                device_name,
                friendly_name: String::new(),
                rect: WindowRect {
                    left: rc.left,
                    top: rc.top,
                    right: rc.right,
                    bottom: rc.bottom,
                },
            });
            1
        }

        let mut monitors = Vec::new();
        unsafe {
            EnumDisplayMonitors(
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                Some(enum_cb),
                &mut monitors as *mut Vec<MonitorInfo> as isize,
            );
        }

        monitors
    }
}
