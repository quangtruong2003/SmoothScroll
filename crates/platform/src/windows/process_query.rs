//! Resolve the process name under the mouse cursor. 100ms TTL +
//! HWND-change detection so the hook hot path pays at most one
//! `OpenProcess`-class call every 100ms.

#![cfg(windows)]

use crate::traits::{ProcessInfo, ProcessQuery};
use crate::types::IntegrityLevel;
use parking_lot::Mutex;
use std::os::raw::c_void;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use windows_sys::Win32::Foundation::{CloseHandle, BOOL, FALSE, HANDLE, LPARAM, MAX_PATH, POINT, TRUE};
use windows_sys::Win32::Security::{
    GetSidSubAuthority, GetTokenInformation, TokenIntegrityLevel, TOKEN_MANDATORY_LABEL,
    TOKEN_QUERY,
};
use windows_sys::Win32::System::{
    SystemServices::{SECURITY_MANDATORY_HIGH_RID, SE_GROUP_INTEGRITY},
    Threading::{
        GetCurrentProcessId, OpenProcess, OpenProcessToken, QueryFullProcessImageNameW,
        PROCESS_QUERY_LIMITED_INFORMATION,
    },
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetAncestor, GetCursorPos, GetForegroundWindow, GetTopWindow, GetWindow,
    GetWindowLongW, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic,
    IsWindowVisible, WindowFromPoint, GA_ROOT, GWL_EXSTYLE, GW_HWNDNEXT, GW_OWNER,
    WS_EX_TOOLWINDOW,
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

/// Cached integrity level for the current HWND. Uses the same 100ms TTL
/// as CacheEntry so both invalidate together on window change.
#[derive(Default)]
struct IntegrityCache {
    last_check: Option<Instant>,
    last_hwnd: usize,
    cached_level: Option<IntegrityLevel>,
}

pub struct WindowsProcessQuery {
    cache: Mutex<CacheEntry>,
    integrity_cache: Mutex<IntegrityCache>,
}

impl WindowsProcessQuery {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(CacheEntry::default()),
            integrity_cache: Mutex::new(IntegrityCache::default()),
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

    fn is_target_elevated(&self) -> bool {
        let now = Instant::now();
        let mut cache = self.integrity_cache.lock();

        // Check cache (same TTL as CacheEntry)
        if let Some(t) = cache.last_check {
            if now.saturating_duration_since(t) < TTL {
                return cache.cached_level == Some(IntegrityLevel::High);
            }
        }

        // Get HWND under cursor
        let mut pt = POINT { x: 0, y: 0 };
        if unsafe { GetCursorPos(&mut pt) } == 0 {
            return false;
        }
        let hwnd = unsafe { WindowFromPoint(pt) };
        if hwnd.is_null() {
            return false;
        }
        let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
        let root_usize = root as usize;

        // Invalidate cache if HWND changed
        if root_usize != cache.last_hwnd {
            cache.last_hwnd = root_usize;
            cache.cached_level = None;
        }

        // If we already cached a result for this HWND, reuse it
        if let Some(level) = cache.cached_level {
            cache.last_check = Some(now);
            return level == IntegrityLevel::High;
        }

        // Query integrity level
        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(root, &mut pid) };
        let level = if pid != 0 {
            get_process_integrity_level(pid)
        } else {
            IntegrityLevel::Unknown
        };

        cache.cached_level = Some(level);
        cache.last_check = Some(now);
        level == IntegrityLevel::High
    }

    /// Returns the topmost user-visible app window's process name, excluding
    /// our own process. Walks the Z-order from `GetTopWindow(NULL)` because
    /// `GetForegroundWindow()` returns the keyboard-focused window — which
    /// becomes our tray panel the moment we show it, so polling-based
    /// refresh would misidentify the app the user is actually working in.
    ///
    /// Skips: invisible, minimized, owned, tool windows, untitled windows,
    /// and any window owned by our own PID.
    fn foreground_process_name(&self) -> Option<String> {
        let self_pid = unsafe { GetCurrentProcessId() };
        let mut hwnd = unsafe { GetTopWindow(std::ptr::null_mut()) };
        while !hwnd.is_null() {
            if is_eligible_app_window(hwnd) {
                let mut pid: u32 = 0;
                unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
                if pid != 0 && pid != self_pid {
                    if let Some(name) = process_name_for_pid(pid) {
                        return Some(name);
                    }
                }
            }
            hwnd = unsafe { GetWindow(hwnd, GW_HWNDNEXT) };
        }
        None
    }
}

/// Returns true when the HWND is a normal top-level user-facing app window:
/// visible, not minimized, has a title, top-level (no owner), not a tool
/// window. Used by Z-order walks to skip system / chrome / overlay windows.
fn is_eligible_app_window(hwnd: *mut c_void) -> bool {
    unsafe {
        if IsWindowVisible(hwnd as _) == 0 {
            return false;
        }
        if IsIconic(hwnd as _) != 0 {
            return false;
        }
        if GetWindowTextLengthW(hwnd as _) == 0 {
            return false;
        }
        let ex = GetWindowLongW(hwnd as _, GWL_EXSTYLE) as u32;
        if (ex & WS_EX_TOOLWINDOW) != 0 {
            return false;
        }
        if !GetWindow(hwnd as _, GW_OWNER).is_null() {
            return false;
        }
    }
    true
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
        // PROCESS_QUERY_LIMITED_INFORMATION (no PROCESS_VM_READ) lets us read
        // the image name even for higher-integrity processes like Task Manager
        // when running unelevated. QueryFullProcessImageNameW pairs with this
        // limited token; the older K32GetProcessImageFileNameW required
        // PROCESS_VM_READ which fails cross-integrity.
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; MAX_PATH as usize];
        let mut len: u32 = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut len);
        let _ = CloseHandle(handle);
        if ok == 0 || len == 0 {
            return None;
        }
        let path: PathBuf = String::from_utf16_lossy(&buf[..len as usize]).into();
        path.file_stem()
            .map(|stem| stem.to_string_lossy().into_owned())
    }
}

/// Returns the integrity level of the process with the given PID.
/// Returns `IntegrityLevel::Unknown` on any error (OpenProcess, OpenProcessToken,
/// or GetTokenInformation failure).
fn get_process_integrity_level(pid: u32) -> IntegrityLevel {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return IntegrityLevel::Unknown;
        }

        let mut token_handle: HANDLE = std::ptr::null_mut();
        let ok = OpenProcessToken(handle, TOKEN_QUERY, &mut token_handle);
        CloseHandle(handle);
        if ok == 0 {
            return IntegrityLevel::Unknown;
        }

        let mut size: u32 = 0;
        GetTokenInformation(
            token_handle,
            TokenIntegrityLevel,
            std::ptr::null_mut(),
            0,
            &mut size,
        );
        if size == 0 {
            CloseHandle(token_handle);
            return IntegrityLevel::Unknown;
        }

        let mut buffer = vec![0u8; size as usize];
        let ok = GetTokenInformation(
            token_handle,
            TokenIntegrityLevel,
            buffer.as_mut_ptr() as _,
            size,
            &mut size,
        );
        CloseHandle(token_handle);
        if ok == 0 {
            return IntegrityLevel::Unknown;
        }

        // TOKEN_MANDATORY_LABEL is SID_AND_ATTRIBUTES{ SID_AND_ATTRIBUTES{ PSID sid, u32 attrs } }.
        // A valid label needs at least the struct plus one sub-authority DWORD in the SID.
        const MIN_LABEL_SIZE: usize = core::mem::size_of::<TOKEN_MANDATORY_LABEL>() + 4;
        if (size as usize) < MIN_LABEL_SIZE {
            return IntegrityLevel::Unknown;
        }

        let label = &*(buffer.as_ptr() as *const TOKEN_MANDATORY_LABEL);
        if label.Label.Sid.is_null() {
            return IntegrityLevel::Unknown;
        }
        let attr = label.Label.Attributes;
        if (attr & (SE_GROUP_INTEGRITY as u32)) == 0 {
            return IntegrityLevel::Medium;
        }

        // Get the mandatory level RID via GetSidSubAuthority — the SID's
        // last sub-authority holds the integrity level.
        let sub_auth = GetSidSubAuthority(label.Label.Sid, 0);
        if sub_auth.is_null() {
            return IntegrityLevel::Unknown;
        }
        let level_rid = *sub_auth;
        if level_rid >= (SECURITY_MANDATORY_HIGH_RID as u32) {
            IntegrityLevel::High
        } else {
            IntegrityLevel::Medium
        }
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
