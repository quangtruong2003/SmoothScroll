#![cfg(target_os = "macos")]

use crate::traits::{HookHandle, KeyboardScrollHook, KeyboardScrollSink};
use crate::types::{PlatformError, Result};
use std::sync::Arc;

pub struct MacosKeyboardScrollHook;

impl KeyboardScrollHook for MacosKeyboardScrollHook {
    fn install(&self, _sink: Arc<dyn KeyboardScrollSink>) -> Result<HookHandle> {
        Err(PlatformError::Unsupported)
    }
}
