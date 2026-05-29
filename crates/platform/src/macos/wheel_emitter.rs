//! macOS stub. Real implementation will land when macOS support ships.

#![cfg(target_os = "macos")]

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};

pub struct MacosWheelEmitter;

impl WheelEmitter for MacosWheelEmitter {
    fn emit(&self, _vertical_units: i32, _horizontal_units: i32) -> Result<()> {
        Err(PlatformError::Unsupported)
    }
}

impl ZoomEmitter for MacosWheelEmitter {
    fn emit_zoom(&self, _units: i32) -> Result<()> {
        Err(PlatformError::Unsupported)
    }
}
