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
        use objc2::rc::Retained;
        use objc2_app_kit::{NSRunningApplication, NSWorkspace};
        // SAFETY: `sharedWorkspace` returns the process-wide singleton.
        // `frontmostApplication` is read via msg_send! to avoid
        // feature-gating surprises across objc2-app-kit 0.2.x; it returns
        // an optional NSRunningApplication. `localizedName` is similarly
        // read via msg_send! returning an optional NSString. Both selectors
        // are stable across all supported macOS versions.
        unsafe {
            let workspace = NSWorkspace::sharedWorkspace();
            let app: Option<Retained<NSRunningApplication>> =
                msg_send![&*workspace, frontmostApplication];
            let app = app?;
            let name: Option<Retained<objc2_foundation::NSString>> =
                msg_send![&*app, localizedName];
            name.map(|n| n.to_string())
        }
    }
}
