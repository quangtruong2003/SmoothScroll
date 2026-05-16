//! macOS stub. Real implementation will land when macOS support ships.

#![cfg(target_os = "macos")]

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{PlatformError, Result};
use std::sync::Arc;

pub struct MacosMouseHook;

impl MacosMouseHook {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MacosMouseHook {
    fn default() -> Self {
        Self::new()
    }
}

impl MouseHook for MacosMouseHook {
    fn install(&self, _sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        Err(PlatformError::Unsupported)
    }
}
