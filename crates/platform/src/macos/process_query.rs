//! Process under cursor + visible-window enumeration.
//!
//! Uses `CGWindowListCopyWindowInfo` with `kCGWindowListOptionOnScreenOnly`
//! to walk visible windows, intersects bounds with `NSEvent.mouseLocation`
//! to find the front-most one under the cursor, and resolves the bundle
//! name via `NSRunningApplication`.

#![cfg(target_os = "macos")]

use crate::traits::{ProcessInfo, ProcessQuery};
use core_foundation::array::CFArray;
use core_foundation::base::{CFType, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::geometry::{CGPoint, CGRect};
use parking_lot::Mutex;
use std::time::{Duration, Instant};

const TTL: Duration = Duration::from_millis(100);

#[derive(Default)]
struct CacheEntry {
    last_check: Option<Instant>,
    cached_name: Option<String>,
}

pub struct MacosProcessQuery {
    cache: Mutex<CacheEntry>,
}

impl MacosProcessQuery {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(CacheEntry::default()),
        }
    }
}

impl ProcessQuery for MacosProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        let now = Instant::now();
        let mut cache = self.cache.lock();
        if let Some(t) = cache.last_check {
            if now.saturating_duration_since(t) < TTL {
                return cache.cached_name.clone();
            }
        }

        let pt = mouse_location();
        let name = front_window_name_at(pt);
        cache.cached_name = name.clone();
        cache.last_check = Some(now);
        name
    }

    fn foreground_process_id(&self) -> Option<u32> {
        front_window_pid()
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        list_visible_windows()
    }
}

fn mouse_location() -> CGPoint {
    use objc2::msg_send_id;
    use objc2::runtime::AnyObject;
    use objc2_foundation::NSPoint;

    unsafe {
        let cls: &AnyObject = objc2::class!(NSEvent).into();
        let pt: NSPoint = msg_send_id![cls, mouseLocation];
        // NSEvent uses bottom-left origin; CGWindowList uses top-left.
        // Get main screen height to convert.
        let screen_cls: &AnyObject = objc2::class!(NSScreen).into();
        let main_screen: *mut AnyObject = msg_send_id![screen_cls, mainScreen].cast();
        let frame: objc2_foundation::NSRect = msg_send_id![main_screen, frame];
        let h = frame.size.height;
        CGPoint {
            x: pt.x,
            y: h - pt.y,
        }
    }
}

fn front_window_pid() -> Option<u32> {
    let workspace = unsafe {
        let cls: &objc2::runtime::AnyObject = objc2::class!(NSWorkspace).into();
        let ws: objc2::rc::Retained<objc2::runtime::AnyObject> = msg_send_id![cls, sharedWorkspace];
        ws
    };
    unsafe {
        let app: *mut objc2::runtime::AnyObject = msg_send_id![&*workspace, frontmostApplication];
        if app.is_null() {
            return None;
        }
        let pid: i32 = msg_send_id![app, processIdentifier];
        Some(pid as u32)
    }
}

fn front_window_name_at(pt: CGPoint) -> Option<String> {
    let infos = list_visible_windows_with_bounds();
    for info in infos {
        if info.bounds.contains(pt) {
            return Some(info.process_info.name);
        }
    }
    None
}

struct WindowWithBounds {
    process_info: ProcessInfo,
    bounds: CGRect,
}

fn list_visible_windows() -> Vec<ProcessInfo> {
    list_visible_windows_with_bounds()
        .into_iter()
        .map(|w| w.process_info)
        .collect()
}

fn list_visible_windows_with_bounds() -> Vec<WindowWithBounds> {
    use core_graphics::window::{
        kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
        CGWindowListCopyWindowInfo,
    };

    let opts = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
    let array: CFArray<CFDictionary<CFString, CFType>> = unsafe {
        CFArray::wrap_under_create_rule(
            CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as *const _
        )
    };

    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for dict in array.iter() {
        let owner = dict_string(dict, "kCGWindowOwnerName");
        let title = dict_string(dict, "kCGWindowName").unwrap_or_default();
        let pid = dict_i64(dict, "kCGWindowOwnerPID").unwrap_or(0) as u32;
        let bounds = dict_rect(dict, "kCGWindowBounds").unwrap_or(CGRect {
            origin: CGPoint { x: 0.0, y: 0.0 },
            size: core_graphics::geometry::CGSize {
                width: 0.0,
                height: 0.0,
            },
        });
        let layer = dict_i64(dict, "kCGWindowLayer").unwrap_or(0);

        let name = match owner {
            Some(n) => n,
            None => continue,
        };
        if pid == 0 {
            continue;
        }
        if layer != 0 {
            continue;
        } // skip menu bar / dock layers
        if title.is_empty() {
            continue;
        }
        if !seen.insert(name.to_lowercase()) {
            continue;
        }

        out.push(WindowWithBounds {
            process_info: ProcessInfo {
                pid,
                name,
                window_title: title,
            },
            bounds,
        });
    }
    out
}

fn dict_string(dict: &CFDictionary<CFString, CFType>, key: &str) -> Option<String> {
    let key = CFString::new(key);
    dict.find(&key)
        .and_then(|v| v.downcast::<CFString>().map(|s| s.to_string()))
}

fn dict_i64(dict: &CFDictionary<CFString, CFType>, key: &str) -> Option<i64> {
    let key = CFString::new(key);
    dict.find(&key)
        .and_then(|v| v.downcast::<CFNumber>().and_then(|n| n.to_i64()))
}

fn dict_rect(dict: &CFDictionary<CFString, CFType>, key: &str) -> Option<CGRect> {
    let key = CFString::new(key);
    let bounds_dict = dict.find(&key)?.downcast::<CFDictionary>()?;
    let x = dict_i64(&bounds_dict.cast(), "X")? as f64;
    let y = dict_i64(&bounds_dict.cast(), "Y")? as f64;
    let w = dict_i64(&bounds_dict.cast(), "Width")? as f64;
    let h = dict_i64(&bounds_dict.cast(), "Height")? as f64;
    Some(CGRect {
        origin: CGPoint { x, y },
        size: core_graphics::geometry::CGSize {
            width: w,
            height: h,
        },
    })
}
