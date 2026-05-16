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
}
