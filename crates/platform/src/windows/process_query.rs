//! Resolve the process name under the mouse cursor. 100ms TTL +
//! HWND-change detection so the hook hot path pays at most one
//! `OpenProcess`-class call every 100ms.

#![cfg(windows)]

use crate::traits::{ProcessInfo, ProcessQuery};
use parking_lot::Mutex;
use std::os::raw::c_void;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use windows_sys::Win32::Foundation::{CloseHandle, BOOL, FALSE, LPARAM, MAX_PATH, POINT, TRUE};
use windows_sys::Win32::System::ProcessStatus::K32GetProcessImageFileNameW;
use windows_sys::Win32::System::Threading::{
    OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_VM_READ,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetAncestor, GetCursorPos, GetForegroundWindow, GetWindow, GetWindowLongW,
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    WindowFromPoint, GA_ROOT, GWL_EXSTYLE, GW_OWNER, WS_EX_TOOLWINDOW,
};

const TTL: Duration = Duration::from_millis(100);

/// CachedEntry stores HWND as `usize` (from `isize` cast) so the struct is
/// `Send + Sync` regardless of the underlying pointer size.
#[derive(Default)]
struct CacheEntry {
    last_check: Option<Instant>,
    last_hwnd: usize,
    cached_name: Option<String>,
}

pub struct WindowsProcessQuery {
    cache: Mutex<CacheEntry>,
}

impl WindowsProcessQuery {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(CacheEntry::default()),
        }
    }
}

impl Default for WindowsProcessQuery {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessQuery for WindowsProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        let now = Instant::now();
        let mut cache = self.cache.lock();

        if let Some(t) = cache.last_check {
            if now.saturating_duration_since(t) < TTL {
                return cache.cached_name.clone();
            }
        }

        let mut pt = POINT { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut pt) } == 0 {
            return cache.cached_name.clone();
        }

        let hwnd = unsafe { WindowFromPoint(pt) };
        if hwnd.is_null() {
            cache.cached_name = None;
            cache.last_check = Some(now);
            cache.last_hwnd = 0;
            return None;
        }

        let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
        let root_usize = root as usize;
        if root_usize == cache.last_hwnd {
            cache.last_check = Some(now);
            return cache.cached_name.clone();
        }

        cache.last_hwnd = root_usize;
        cache.last_check = Some(now);
        cache.cached_name = process_name_for_hwnd(root_usize as isize);
        cache.cached_name.clone()
    }

    fn foreground_process_id(&self) -> Option<u32> {
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_null() {
            return None;
        }
        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        if pid == 0 {
            None
        } else {
            Some(pid)
        }
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        self.enumerate()
    }
}

fn process_name_for_hwnd(hwnd: isize) -> Option<String> {
    let mut pid: u32 = 0;
    unsafe { GetWindowThreadProcessId(hwnd as _, &mut pid) };
    if pid == 0 {
        return None;
    }
    process_name_for_pid(pid)
}

pub fn process_name_for_pid(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ,
            FALSE,
            pid,
        );
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; MAX_PATH as usize];
        let len = K32GetProcessImageFileNameW(handle, buf.as_mut_ptr(), buf.len() as u32);
        let _ = CloseHandle(handle);
        if len == 0 {
            return None;
        }
        let path: PathBuf = String::from_utf16_lossy(&buf[..len as usize]).into();
        path.file_stem()
            .map(|stem| stem.to_string_lossy().into_owned())
    }
}

impl WindowsProcessQuery {
    fn enumerate(&self) -> Vec<ProcessInfo> {
        struct Acc {
            items: Vec<ProcessInfo>,
        }
        let mut acc = Acc { items: Vec::new() };

        unsafe extern "system" fn cb(hwnd: *mut c_void, lparam: LPARAM) -> BOOL {
            let acc = &mut *(lparam as *mut Acc);
            if IsWindowVisible(hwnd as _) == 0 {
                return TRUE;
            }
            if !GetWindow(hwnd as _, GW_OWNER).is_null() {
                return TRUE;
            }
            let ex_style = unsafe { GetWindowLongW(hwnd as _, GWL_EXSTYLE) as u32 };
            if (ex_style & WS_EX_TOOLWINDOW) != 0 {
                return TRUE;
            }

            let title_len = unsafe { GetWindowTextLengthW(hwnd as _) };
            if title_len == 0 {
                return TRUE;
            }
            let mut title = vec![0u16; title_len as usize + 1];
            let copied =
                unsafe { GetWindowTextW(hwnd as _, title.as_mut_ptr(), title.len() as i32) };
            if copied <= 0 {
                return TRUE;
            }
            let title = String::from_utf16_lossy(&title[..copied as usize]);

            let mut pid: u32 = 0;
            unsafe { GetWindowThreadProcessId(hwnd as _, &mut pid) };
            if pid == 0 {
                return TRUE;
            }

            let name = match process_name_for_hwnd(hwnd as isize) {
                Some(n) => n,
                None => return TRUE,
            };

            acc.items.push(ProcessInfo {
                pid,
                name,
                window_title: title,
            });
            TRUE
        }

        unsafe {
            EnumWindows(Some(cb), &mut acc as *mut _ as LPARAM);
        }

        acc.items.sort_by_key(|a| a.name.to_lowercase());
        acc.items
            .dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name));
        acc.items
    }
}
