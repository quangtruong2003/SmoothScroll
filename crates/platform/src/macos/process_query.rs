//! macOS stub. Real implementation will land when macOS support ships.

#![cfg(target_os = "macos")]

use crate::traits::{ProcessInfo, ProcessQuery};

pub struct MacosProcessQuery;

impl MacosProcessQuery {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MacosProcessQuery {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessQuery for MacosProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        None
    }

    fn foreground_process_id(&self) -> Option<u32> {
        None
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        Vec::new()
    }

    fn foreground_process_name(&self) -> Option<String> {
        use objc2::msg_send;
        use objc2::msg_send_id;
        use objc2::rc::Retained;
        use objc2_app_kit::{NSRunningApplication, NSWorkspace};
        use objc2_foundation::NSString;
        // SAFETY: `sharedWorkspace` returns the process-wide singleton.
        // Use msg_send_id! (not msg_send!) for ARC-managed returns: in
        // objc2 0.5, msg_send! requires Encode-implementing types and
        // doesn't accept Retained<T>; msg_send_id! handles the retain/
        // release dance and yields Retained<T> or Option<Retained<T>>.
        // We skip the result if it points at our own process so the tray
        // panel can't show itself as the active app.
        unsafe {
            let self_pid = std::process::id() as i32;
            let workspace = NSWorkspace::sharedWorkspace();
            let app: Option<Retained<NSRunningApplication>> =
                msg_send_id![&*workspace, frontmostApplication];
            let app = app?;
            let pid: i32 = msg_send![&*app, processIdentifier];
            if pid == self_pid {
                return None;
            }
            let name: Option<Retained<NSString>> = msg_send_id![&*app, localizedName];
            name.map(|n| n.to_string())
        }
    }
}
