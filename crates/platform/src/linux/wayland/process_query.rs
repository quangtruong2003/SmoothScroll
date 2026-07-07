//! Process query stub for Wayland.
//!
//! On Wayland, we cannot reliably get foreground window information
//! without compositor-specific APIs. This stub provides limited
//! functionality via /proc filesystem.

use crate::traits::{ProcessInfo, ProcessQuery};
pub struct WaylandProcessQuery;

impl WaylandProcessQuery {
    pub fn new() -> Self {
        Self
    }
}

impl ProcessQuery for WaylandProcessQuery {
    fn process_name_under_cursor(&self) -> Option<String> {
        // Wayland doesn't expose this to clients
        None
    }

    fn foreground_process_id(&self) -> Option<u32> {
        // Could read from /proc/self or use compositor-specific methods
        None
    }

    fn list_visible_processes(&self) -> Vec<ProcessInfo> {
        // Not implemented - would require compositor-specific APIs
        Vec::new()
    }

    fn is_target_elevated(&self) -> bool {
        // Linux doesn't have UAC-like elevation
        // Check if running as root
        unsafe { nix::libc::geteuid() == 0 }
    }
}
