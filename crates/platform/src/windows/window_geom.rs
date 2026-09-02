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
    GetAncestor, GetClassNameW, GetCursorPos, GetParent, GetWindow, GetWindowRect,
    SendMessageTimeoutW, WindowFromPoint, GA_ROOT, GW_HWNDNEXT, GW_HWNDPREV, SMTO_ABORTIFHUNG,
};

pub struct WindowsWindowGeometry;

/// Window classes whose controls consume wheel input in whole-notch steps:
/// one physical notch must produce exactly one native wheel message, or the
/// control skips values (per-message steppers) or ignores the input entirely
/// (`delta / WHEEL_DELTA` integer division). The engine's sub-notch pulse
/// train breaks both, so these targets get the raw event passed through.
const DISCRETE_CONTROL_CLASSES: &[&str] = &[
    "msctls_updown32",   // spin control
    "msctls_trackbar32", // slider
    "combobox",
    "combolbox", // combo dropdown list
    "listbox",
    "syslistview32",
    "systreeview32",
];

/// Tk exposes widget hosts as generic Win32 windows rather than preserving the
/// script-level widget type in the HWND class. Because we cannot distinguish a
/// Tk Spinbox/Listbox/Scale from a continuous canvas at this layer, the safe
/// compatibility fallback is to preserve the original native wheel event for
/// the Tk host instead of synthesizing sub-notch pulses.
const OPAQUE_RAW_WHEEL_CLASSES: &[&str] = &["TkTopLevel", "TkChild"];

const UDM_GETBUDDY: u32 = 0x0400 + 106;
const UPDOWN_BUDDY_TIMEOUT_MS: u32 = 2;

fn is_discrete_class(class: &str) -> bool {
    DISCRETE_CONTROL_CLASSES
        .iter()
        .any(|c| c.eq_ignore_ascii_case(class))
}

fn requires_raw_wheel_class(class: &str) -> bool {
    is_discrete_class(class)
        || OPAQUE_RAW_WHEEL_CLASSES
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(class))
}

unsafe fn window_class_name(hwnd: HWND) -> Option<String> {
    let mut buf = [0u16; 64];
    let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
    (len > 0)
        .then(|| String::from_utf16(&buf[..len as usize]).ok())
        .flatten()
}

/// A classic Win32 spinbox is a composite: the `msctls_updown32` arrows and
/// its buddy `Edit` are siblings. `WindowFromPoint` therefore often returns the
/// Edit, so parent traversal alone misses the actual discrete control. Probe at
/// most the two adjacent siblings; `UDS_AUTOBUDDY` uses the previous z-order
/// window and manually assigned buddies are verified with `UDM_GETBUDDY`.
unsafe fn edit_has_updown_buddy(edit: HWND) -> bool {
    if !window_class_name(edit).is_some_and(|class| class.eq_ignore_ascii_case("Edit")) {
        return false;
    }

    for direction in [GW_HWNDPREV, GW_HWNDNEXT] {
        let updown = GetWindow(edit, direction);
        if updown.is_null()
            || !window_class_name(updown)
                .is_some_and(|class| class.eq_ignore_ascii_case("msctls_updown32"))
        {
            continue;
        }

        let mut buddy = 0usize;
        let delivered = SendMessageTimeoutW(
            updown,
            UDM_GETBUDDY,
            0,
            0,
            SMTO_ABORTIFHUNG,
            UPDOWN_BUDDY_TIMEOUT_MS,
            &mut buddy,
        );
        if delivered == 0 {
            // The adjacent native up-down control is already a strong signal;
            // if its owner is temporarily hung, raw passthrough is safer than
            // swallowing and emitting a smoothed command into an uncertain UI.
            return true;
        }
        if buddy as HWND == edit {
            return true;
        }
    }
    false
}

fn cursor_root_window() -> Option<(POINT, HWND)> {
    unsafe {
        let mut pt: POINT = mem::zeroed();
        if GetCursorPos(&mut pt) == 0 {
            return None;
        }
        let hwnd = WindowFromPoint(pt);
        if hwnd.is_null() {
            return None;
        }
        let root = GetAncestor(hwnd, GA_ROOT);
        if root.is_null() {
            return None;
        }
        Some((pt, root))
    }
}

impl WindowGeometry for WindowsWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        unsafe {
            let (pt, root) = cursor_root_window()?;
            let mut rc: RECT = mem::zeroed();
            if GetWindowRect(root, &mut rc) == 0 {
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

    fn root_window_under_cursor(&self) -> Option<isize> {
        cursor_root_window().map(|(_, root)| root as isize)
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

    fn cursor_over_discrete_control(&self) -> bool {
        unsafe {
            let mut pt: POINT = mem::zeroed();
            if GetCursorPos(&mut pt) == 0 {
                return false;
            }
            // Walk from the hit-tested child toward the root: the deepest
            // window may be a non-discrete child (e.g. the Edit portion of a
            // ComboBox) whose parent is the discrete control itself.
            let mut hwnd = WindowFromPoint(pt);
            for _ in 0..4 {
                if hwnd.is_null() {
                    break;
                }
                if edit_has_updown_buddy(hwnd) {
                    return true;
                }
                if window_class_name(hwnd).is_some_and(|class| requires_raw_wheel_class(&class)) {
                    return true;
                }
                hwnd = GetParent(hwnd);
            }
            false
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discrete_classes_are_recognized() {
        for class in [
            "msctls_updown32",
            "msctls_trackbar32",
            "ComboBox",
            "ComboLBox",
            "ListBox",
            "SysListView32",
            "SysTreeView32",
        ] {
            assert!(is_discrete_class(class), "{class}");
        }
    }

    #[test]
    fn discrete_match_is_case_insensitive() {
        assert!(is_discrete_class("COMBOBOX"));
        assert!(is_discrete_class("MSCTLS_UPDOWN32"));
    }

    #[test]
    fn continuous_scroll_targets_are_not_discrete() {
        for class in [
            "Edit",
            "RichEdit20W",
            "RICHEDIT50W",
            "Chrome_WidgetWin_1",
            "MozillaWindowClass",
            "DirectUIHWND",
            "Windows.UI.Core.CoreWindow",
            "",
        ] {
            assert!(!is_discrete_class(class), "{class}");
        }
    }

    #[test]
    fn tk_opaque_widget_hosts_require_raw_wheel_fallback() {
        assert!(requires_raw_wheel_class("TkTopLevel"));
        assert!(requires_raw_wheel_class("TkChild"));
        assert!(requires_raw_wheel_class("tKcHiLd"));
    }

    #[test]
    fn browsers_and_generic_custom_windows_do_not_get_raw_fallback() {
        for class in [
            "Chrome_WidgetWin_1",
            "MozillaWindowClass",
            "DirectUIHWND",
            "Windows.UI.Core.CoreWindow",
            "CustomRendererHost",
        ] {
            assert!(!requires_raw_wheel_class(class), "{class}");
        }
    }
}
