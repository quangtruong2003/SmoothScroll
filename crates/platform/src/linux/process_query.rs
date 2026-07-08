//! Process identification via X11 EWMH atoms and /proc filesystem.
//!
//! 1. XQueryPointer → window under cursor
//! 2. Walk up tree looking for _NET_WM_PID property
//! 3. Read /proc/<pid>/exe symlink for process name

use crate::traits::{ProcessInfo, ProcessQuery};
use parking_lot::Mutex;
use std::ffi::CStr;
use std::fs;
use std::os::raw::{c_int, c_uchar, c_uint, c_ulong};
use std::time::{Duration, Instant};
use x11::xlib::{self, Atom, Window};

use super::display;

const TTL: Duration = Duration::from_millis(100);

#[derive(Default)]
struct CacheEntry {
    last_check: Option<Instant>,
    cached_name: Option<String>,
}

pub struct LinuxProcessQuery {
    cache: Mutex<CacheEntry>,
}

impl LinuxProcessQuery {
    pub fn new() -> Result<Self, crate::types::PlatformError> {
        let d = display::open_display()?;
        unsafe { display::close_display(d) };
        Ok(Self {
            cache: Mutex::new(CacheEntry::default()),
        })
    }
}

/// Read _NET_WM_PID from a window, walking up the tree.
///
/// # Safety
/// `display` must be a valid open connection.
unsafe fn get_window_pid(display: *mut xlib::Display, mut window: Window) -> Option<u32> {
    let net_wm_pid = {
        let name = b"_NET_WM_PID\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };
    if net_wm_pid == 0 {
        return None;
    }

    for _ in 0..10 {
        let mut actual_type: Atom = 0;
        let mut actual_format: c_int = 0;
        let mut n_items: c_ulong = 0;
        let mut bytes_after: c_ulong = 0;
        let mut prop_return: *mut c_uchar = std::ptr::null_mut();

        let status = xlib::XGetWindowProperty(
            display,
            window,
            net_wm_pid,
            0,
            1,
            xlib::False,
            xlib::XA_CARDINAL,
            &mut actual_type,
            &mut actual_format,
            &mut n_items,
            &mut bytes_after,
            &mut prop_return,
        );

        if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
            let pid = *(prop_return as *const u32);
            xlib::XFree(prop_return as *mut _);
            return Some(pid);
        }
        if !prop_return.is_null() {
            xlib::XFree(prop_return as *mut _);
        }

        let mut root: Window = 0;
        let mut parent: Window = 0;
        let mut children: *mut Window = std::ptr::null_mut();
        let mut n_children: c_uint = 0;
        if xlib::XQueryTree(
            display,
            window,
            &mut root,
            &mut parent,
            &mut children,
            &mut n_children,
        ) != 0
        {
            if !children.is_null() {
                xlib::XFree(children as *mut _);
            }
            if parent == 0 || parent == root {
                return None;
            }
            window = parent;
        } else {
            return None;
        }
    }
    None
}

/// Read process name from /proc/<pid>/exe symlink.
/// Falls back to /proc/<pid>/comm if exe not readable.
fn process_name_from_pid(pid: u32) -> Option<String> {
    if let Ok(exe_path) = fs::read_link(format!("/proc/{pid}/exe")) {
        if let Some(name) = exe_path.file_name() {
            let name = name.to_string_lossy().into_owned();
            if !name.is_empty() {
                return Some(name);
            }
        }
    }
    fs::read_to_string(format!("/proc/{pid}/comm"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Returns the absolute path of the executable backing `pid`, read from
/// the `/proc/<pid>/exe` symlink. Returns None when the symlink is
/// unreadable (process gone, kernel-protected, or non-/proc filesystem).
pub fn exe_path_for_pid(pid: u32) -> Option<String> {
    fs::read_link(format!("/proc/{pid}/exe"))
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_owned()))
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn window_under_cursor(display: *mut xlib::Display) -> Option<Window> {
    let root = display::root_window(display);
    let mut root_return: Window = 0;
    let mut child_return: Window = 0;
    let mut root_x: c_int = 0;
    let mut root_y: c_int = 0;
    let mut win_x: c_int = 0;
    let mut win_y: c_int = 0;
    let mut mask: c_uint = 0;

    let ok = xlib::XQueryPointer(
        display,
        root,
        &mut root_return,
        &mut child_return,
        &mut root_x,
        &mut root_y,
        &mut win_x,
        &mut win_y,
        &mut mask,
    );

    if ok != 0 && child_return != 0 {
        Some(child_return)
    } else {
        None
    }
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn active_window(display: *mut xlib::Display) -> Option<Window> {
    let root = display::root_window(display);
    let net_active = {
        let name = b"_NET_ACTIVE_WINDOW\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };
    if net_active == 0 {
        return None;
    }

    let mut actual_type: Atom = 0;
    let mut actual_format: c_int = 0;
    let mut n_items: c_ulong = 0;
    let mut bytes_after: c_ulong = 0;
    let mut prop_return: *mut c_uchar = std::ptr::null_mut();

    let status = xlib::XGetWindowProperty(
        display,
        root,
        net_active,
        0,
        1,
        xlib::False,
        xlib::XA_WINDOW,
        &mut actual_type,
        &mut actual_format,
        &mut n_items,
        &mut bytes_after,
        &mut prop_return,
    );

    if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
        let win = *(prop_return as *const Window);
        xlib::XFree(prop_return as *mut _);
        if win != 0 {
            Some(win)
        } else {
            None
        }
    } else {
        if !prop_return.is_null() {
            xlib::XFree(prop_return as *mut _);
        }
        None
    }
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn window_title(display: *mut xlib::Display, window: Window) -> Option<String> {
    let net_wm_name = {
        let name = b"_NET_WM_NAME\0".as_ptr() as *const i8;
        xlib::XInternAtom(display, name, xlib::False)
    };

    let mut actual_type: Atom = 0;
    let mut actual_format: c_int = 0;
    let mut n_items: c_ulong = 0;
    let mut bytes_after: c_ulong = 0;
    let mut prop_return: *mut c_uchar = std::ptr::null_mut();

    let status = xlib::XGetWindowProperty(
        display,
        window,
        net_wm_name,
        0,
        1024,
        xlib::False,
        0, // AnyPropertyType — accept any atom type
        &mut actual_type,
        &mut actual_format,
        &mut n_items,
        &mut bytes_after,
        &mut prop_return,
    );

    if status == xlib::Success as c_int && !prop_return.is_null() && n_items > 0 {
        let bytes = std::slice::from_raw_parts(prop_return, n_items as usize);
        let title = String::from_utf8_lossy(bytes).into_owned();
        xlib::XFree(prop_return as *mut _);
        return Some(title);
    }
    if !prop_return.is_null() {
        xlib::XFree(prop_return as *mut _);
    }

    let mut text_prop: xlib::XTextProperty = std::mem::zeroed();
    if xlib::XGetWMName(display, window, &mut text_prop) != 0 && !text_prop.value.is_null() {
        let c_str = CStr::from_ptr(text_prop.value as *const i8);
        let title = c_str.to_string_lossy().into_owned();
        xlib::XFree(text_prop.value as *mut _);
        return Some(title);
    }

    None
}

/// # Safety
/// `display` must be a valid open connection.
unsafe fn enumerate_windows(display: *mut xlib::Display) -> Vec<Window> {
    let root = display::root_window(display);
    let mut root_return: Window = 0;
    let mut parent: Window = 0;
    let mut children: *mut Window = std::ptr::null_mut();
    let mut n_children: c_uint = 0;

    if xlib::XQueryTree(
        display,
        root,
        &mut root_return,
        &mut parent,
        &mut children,
        &mut n_children,
    ) == 0
    {
        return Vec::new();
    }
    let windows = if !children.is_null() && n_children > 0 {
        std::slice::from_raw_parts(children, n_children as usize).to_vec()
    } else {
        Vec::new()
    };
    if !children.is_null() {
        xlib::XFree(children as *mut _);
    }
    windows
}

impl ProcessQuery for LinuxProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        let now = Instant::now();
        let mut cache = self.cache.lock();
        if let Some(t) = cache.last_check {
            if now.saturating_duration_since(t) < TTL {
                return cache.cached_name.clone();
            }
        }
        let result = unsafe {
            let d = display::open_display().ok()?;
            let result = (|| {
                let window = window_under_cursor(d)?;
                let pid = get_window_pid(d, window)?;
                Some(process_name_from_pid(pid))
            })();
            display::close_display(d);
            result?
        };
        cache.last_check = Some(now);
        cache.cached_name = result.clone();
        result
    }

    fn foreground_process_id(&self) -> Option<u32> {
        unsafe {
            let d = display::open_display().ok()?;
            let result = active_window(d).and_then(|win| get_window_pid(d, win));
            display::close_display(d);
            result
        }
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        let mut results = Vec::new();
        unsafe {
            let Ok(d) = display::open_display() else {
                return results;
            };
            let windows = enumerate_windows(d);
            for win in windows {
                let Some(pid) = get_window_pid(d, win) else {
                    continue;
                };
                let name = process_name_from_pid(pid).unwrap_or_default();
                if name.is_empty() {
                    continue;
                }
                let title = window_title(d, win).unwrap_or_default();
                results.push(ProcessInfo {
                    pid,
                    name,
                    window_title: title,
                    exe_path: exe_path_for_pid(pid),
                });
            }
            display::close_display(d);
        }
        results
    }

    fn foreground_process_name(&self) -> Option<String> {
        let pid = self.foreground_process_id()?;
        process_name_from_pid(pid)
    }

    fn foreground_process_info(&self) -> Option<ProcessInfo> {
        let pid = self.foreground_process_id()?;
        let name = process_name_from_pid(pid)?;
        let exe_path = exe_path_for_pid(pid);
        Some(ProcessInfo {
            pid,
            name,
            window_title: String::new(),
            exe_path,
        })
    }
}
