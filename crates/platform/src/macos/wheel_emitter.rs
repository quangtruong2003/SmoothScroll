//! macOS wheel emitter via CGEvent posting.
//!
//! Posts synthetic scroll wheel events to replace the original unsmoothed
//! wheel deltas with our smooth animation pulses.

#![cfg(target_os = "macos")]

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::sync::OnceLock;

const kCGEventScrollWheel: u32 = 22;
const kCGHIDSystemTap: u32 = 0;

const kCGScrollWheelEventPointDeltaAxis1: i64 = 126;
const kCGScrollWheelEventPointDeltaAxis2: i64 = 127;
const kCGEventFlagMaskControl: u32 = 0x00040000;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventCreate(allocator: *const u8) -> *mut std::os::raw::c_void;
    fn CGEventSetType(event: *mut std::os::raw::c_void, event_type: u32);
    fn CGEventSetIntegerValueField(event: *mut std::os::raw::c_void, field: i64, value: i64);
    fn CGEventPost(tap: u32, event: *mut std::os::raw::c_void);
    fn CGEventSetFlags(event: *mut std::os::raw::c_void, flags: u32);
    fn CGEventSourceCreate(allocator: *const u8) -> *mut std::os::raw::c_void;
    fn CFRelease(cf: *const std::os::raw::c_void);
}

static EVENT_SOURCE: OnceLock<*mut std::os::raw::c_void> = OnceLock::new();

fn get_source() -> Result<*mut std::os::raw::c_void> {
    let ptr = EVENT_SOURCE.get_or_init(|| unsafe {
        CGEventSourceCreate(std::ptr::null())
    });
    if ptr.is_null() {
        Err(PlatformError::Os("failed to create CGEventSource".into()))
    } else {
        Ok(*ptr)
    }
}

pub struct MacosWheelEmitter;

impl MacosWheelEmitter {
    pub fn new() -> Self {
        Self
    }

    unsafe fn post_scroll(vertical: i64, horizontal: i64) -> Result<()> {
        let source = get_source()?;
        let event = CGEventCreate(std::ptr::null());
        if event.is_null() {
            return Err(PlatformError::Os("failed to create CGEvent".into()));
        }
        CGEventSetType(event, kCGEventScrollWheel);

        if vertical != 0 {
            CGEventSetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2, vertical);
        }
        if horizontal != 0 {
            CGEventSetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis1, horizontal);
        }

        CGEventPost(kCGHIDSystemTap, event);
        CFRelease(event as *const _);
        Ok(())
    }
}

impl Default for MacosWheelEmitter {
    fn default() -> Self {
        Self::new()
    }
}

impl WheelEmitter for MacosWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        unsafe {
            Self::post_scroll(vertical_units as i64, horizontal_units as i64)
        }
    }
}

impl ZoomEmitter for MacosWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        unsafe {
            let source = get_source()?;
            let event = CGEventCreate(std::ptr::null());
            if event.is_null() {
                return Err(PlatformError::Os("failed to create CGEvent".into()));
            }
            CGEventSetType(event, kCGEventScrollWheel);
            CGEventSetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2, units as i64);
            CGEventSetFlags(event, kCGEventFlagMaskControl);
            CGEventPost(kCGHIDSystemTap, event);
            CFRelease(event as *const _);
            Ok(())
        }
    }
}
