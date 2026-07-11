//! macOS stub. Real implementation will land when macOS support ships.

#![cfg(target_os = "macos")]

use crate::traits::{ProcessInfo, ProcessQuery};

/// Returns the .app bundle URL of the frontmost non-self application, or None
/// when no frontmost app, the frontmost app is us, or AppKit cannot resolve
/// the bundle (e.g. background-only command-line tool).
fn frontmost_app_bundle_url() -> Option<std::path::PathBuf> {
    use objc2::msg_send;
    use objc2::msg_send_id;
    use objc2::rc::Retained;
    use objc2_app_kit::{NSRunningApplication, NSWorkspace};
    use objc2_foundation::{NSString, NSURL};
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
        // bundleURL is NSURL *; .path returns NSString *. Read path then
        // drop the NSURL.
        let url: Option<Retained<NSURL>> = msg_send_id![&*app, bundleURL];
        let url = url?;
        let path_ns: Option<Retained<NSString>> = msg_send_id![&*url, path];
        path_ns.map(|p| std::path::PathBuf::from(p.to_string()))
    }
}

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
        // Stub: future implementer must query the window under the cursor position.
        // On macOS, this typically requires the Accessibility API (AXUIElementCopyElementAtPosition)
        // to find the UI element under the mouse coordinates, traverse up to the AXWindow,
        // and fetch the AXPID (process identifier).
        None
    }

    fn foreground_process_id(&self) -> Option<u32> {
        use objc2::msg_send;
        use objc2::msg_send_id;
        use objc2::rc::Retained;
        use objc2_app_kit::{NSRunningApplication, NSWorkspace};
        unsafe {
            let self_pid = std::process::id() as i32;
            let workspace = NSWorkspace::sharedWorkspace();
            let app: Option<Retained<NSRunningApplication>> =
                msg_send_id![&*workspace, frontmostApplication];
            let app = app?;
            let pid: i32 = msg_send![&*app, processIdentifier];
            if pid == self_pid {
                None
            } else {
                Some(pid as u32)
            }
        }
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        // Stub: future implementer must iterate over running applications via
        // NSWorkspace.sharedWorkspace.runningApplications, filtering for apps
        // that are visible (activationPolicy == NSApplicationActivationPolicyRegular).
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

    fn foreground_process_info(&self) -> Option<ProcessInfo> {
        use objc2::msg_send;
        use objc2::msg_send_id;
        use objc2::rc::Retained;
        use objc2_app_kit::{NSRunningApplication, NSWorkspace};
        use objc2_foundation::NSString;
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
            let name = name?.to_string();
            let exe_path = frontmost_app_bundle_url();
            Some(ProcessInfo {
                pid: pid as u32,
                name,
                window_title: String::new(),
                exe_path: exe_path.and_then(|p| p.to_str().map(|s| s.to_owned())),
            })
        }
    }
}
