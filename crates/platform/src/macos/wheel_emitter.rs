//! macOS wheel emitter via CGEvent.post().
//!
//! Posts synthetic scroll wheel events to the HID event tap, replacing
//! the original unsmoothed wheel deltas with our smooth animation pulses.

#![cfg(target_os = "macos")]

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::sync::OnceLock;

/// Raw CGEventType enum values (core-graphics 0.19 may not expose these directly).
const kCGEventScrollWheel: u32 = 22;

/// Event field: scroll wheel point delta axis 1 (horizontal, discrete).
const kCGScrollWheelEventPointDeltaAxis1: i32 = 0x118;
/// Event field: scroll wheel point delta axis 2 (vertical, discrete).
const kCGScrollWheelEventPointDeltaAxis2: i32 = 0x119;

/// CGEventTapLocation constant for HID system event posting.
const kCGHIDEventTap: u32 = 0;

/// Raw FFI bindings for Quartz Event Services.
extern "C" {
    fn CGEventCreate(source: *mut libc::c_void) -> *mut libc::c_void;
    fn CGEventSetType(event: *mut libc::c_void, event_type: u32);
    fn CGEventSetIntegerValueField(event: *mut libc::c_void, field: i32, value: i64);
    fn CGEventPost(tap: u32, event: *mut libc::c_void);
    fn CGEventSourceCreate(state_id: u32) -> *mut libc::c_void;
    fn CFRelease(cf: *mut libc::c_void);

    /// CGEventSourceStateID constants
    static kCGEventSourceStateCombinedSessionState: u32;
}

pub struct MacosWheelEmitter {
    source: OnceLock<*mut libc::c_void>,
}

impl MacosWheelEmitter {
    pub fn new() -> Self {
        Self {
            source: OnceLock::new(),
        }
    }

    fn get_source(&self) -> Result<*mut libc::c_void> {
        let ptr = self.source.get_or_try_init(|| {
            let source = unsafe { CGEventSourceCreate(kCGEventSourceStateCombinedSessionState) };
            if source.is_null() {
                Err(PlatformError::Os("failed to create CGEventSource".into()))
            } else {
                Ok(source)
            }
        })
        .map_err(|e| PlatformError::Os(e.to_string()))?;
        Ok(*ptr)
    }
}

impl Default for MacosWheelEmitter {
    fn default() -> Self {
        Self::new()
    }
}

impl WheelEmitter for MacosWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        let source = self.get_source()?;

        // Post a vertical wheel event.
        if vertical_units != 0 {
            let event = unsafe { CGEventCreate(source) };
            if !event.is_null() {
                unsafe {
                    CGEventSetType(event, kCGEventScrollWheel);
                    CGEventSetIntegerValueField(
                        event,
                        kCGScrollWheelEventPointDeltaAxis2,
                        vertical_units as i64,
                    );
                    CGEventPost(kCGHIDEventTap, event);
                    CFRelease(event);
                }
            }
        }

        // Post a horizontal wheel event.
        if horizontal_units != 0 {
            let event = unsafe { CGEventCreate(source) };
            if !event.is_null() {
                unsafe {
                    CGEventSetType(event, kCGEventScrollWheel);
                    CGEventSetIntegerValueField(
                        event,
                        kCGScrollWheelEventPointDeltaAxis1,
                        horizontal_units as i64,
                    );
                    CGEventPost(kCGHIDEventTap, event);
                    CFRelease(event);
                }
            }
        }

        Ok(())
    }
}

impl ZoomEmitter for MacosWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        let source = self.get_source()?;
        let event = unsafe { CGEventCreate(source) };
        if event.is_null() {
            return Err(PlatformError::Os("failed to create CGEvent".into()));
        }

        unsafe {
            CGEventSetType(event, kCGEventScrollWheel);
            CGEventSetIntegerValueField(
                event,
                kCGScrollWheelEventPointDeltaAxis2,
                units as i64,
            );
            CGEventPost(kCGHIDEventTap, event);
            CFRelease(event);
        }

        Ok(())
    }
}
