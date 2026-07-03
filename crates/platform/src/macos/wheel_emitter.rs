//! macOS wheel emitter via CGEvent posting.
//!
//! Posts synthetic scroll wheel events to replace the original unsmoothed
//! wheel deltas with our smooth animation pulses.

#![cfg(target_os = "macos")]

use crate::types::{PlatformError, Result};
use core_foundation_sys::base::{CFAllocatorRef, CFRelease, kCFAllocatorDefault};
use std::sync::OnceLock;

use crate::traits::{WheelEmitter, ZoomEmitter};

const kCGEventScrollWheel: u32 = 22;
const kCGHIDSystemTap: u32 = 0;

// Scroll event field keys. Numeric values are stable Apple SDK constants
// for the relevant CGEventField enum cases.
const kCGScrollWheelEventDeltaAxis1: i64 = 11;
const kCGScrollWheelEventDeltaAxis2: i64 = 12;
const kCGScrollWheelEventPointDeltaAxis1: i64 = 126;
const kCGScrollWheelEventPointDeltaAxis2: i64 = 127;
// 96 = kCGScrollWheelEventIsContinuous. Apps use this flag to pick the
// trackpad-style smooth-scroll code path; without it our synthetic
// events look like discrete mouse-wheel ticks and break momentum scroll
// in Safari/Notes/Pages.
const kCGScrollWheelEventIsContinuous: i64 = 96;
const kCGEventFlagMaskControl: u32 = 0x00040000;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventCreate(allocator: CFAllocatorRef) -> *mut std::os::raw::c_void;
    fn CGEventSetType(event: *mut std::os::raw::c_void, event_type: u32);
    fn CGEventSetIntegerValueField(event: *mut std::os::raw::c_void, field: i64, value: i64);
    fn CGEventPost(tap: u32, event: *mut std::os::raw::c_void);
    fn CGEventSetFlags(event: *mut std::os::raw::c_void, flags: u32);
    fn CGEventSourceCreate(allocator: CFAllocatorRef) -> *mut std::os::raw::c_void;
    fn CGEventSetSource(event: *mut std::os::raw::c_void, source: *mut std::os::raw::c_void);
}

/// Thread-safe wrapper around a raw CGEventSourceRef.
/// SAFETY: CGEventSourceRef is safe to share across threads for event creation.
struct SharedEventSource(*mut std::os::raw::c_void);
unsafe impl Sync for SharedEventSource {}
unsafe impl Send for SharedEventSource {}

static EVENT_SOURCE: OnceLock<SharedEventSource> = OnceLock::new();

fn get_source() -> Result<*mut std::os::raw::c_void> {
    let src = EVENT_SOURCE.get_or_init(|| {
        let ptr = unsafe { CGEventSourceCreate(kCFAllocatorDefault) };
        SharedEventSource(ptr)
    });
    if src.0.is_null() {
        Err(PlatformError::Os("failed to create CGEventSource".into()))
    } else {
        Ok(src.0)
    }
}

pub struct MacosWheelEmitter;

impl MacosWheelEmitter {
    pub fn new() -> Self {
        Self
    }

    /// SAFETY: Standard Core Graphics event creation/posting.
    unsafe fn post_scroll(vertical: i64, horizontal: i64, zoom: bool) -> Result<()> {
        let source = get_source()?;
        let event = CGEventCreate(kCFAllocatorDefault);
        if event.is_null() {
            return Err(PlatformError::Os("failed to create CGEvent".into()));
        }
        CGEventSetType(event, kCGEventScrollWheel);
        CGEventSetSource(event, source);

        // Mark the event as a continuous (trackpad-style) scroll so
        // receiving apps route through their smooth-scroll code path.
        // Apps that distinguish trackpad vs mouse via IsContinuous
        // (Safari, Notes, Pages, TextEdit, etc.) otherwise treat our
        // pulses as discrete mouse-wheel ticks.
        CGEventSetIntegerValueField(event, kCGScrollWheelEventIsContinuous, 1);

        if vertical != 0 {
            // Apple asks callers to set BOTH the legacy PointDelta axis
            // (most apps) and the new Delta axis (trackpad-aware code
            // paths). Setting only PointDelta leaves trackpad handlers
            // with no signal, which surfaces as scroll not advancing on
            // a few sites (notably custom WebKit hosts).
            CGEventSetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2, vertical);
            CGEventSetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2, vertical);
        }
        if horizontal != 0 {
            CGEventSetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis1, horizontal);
            CGEventSetIntegerValueField(event, kCGScrollWheelEventDeltaAxis1, horizontal);
        }
        if zoom {
            CGEventSetFlags(event, kCGEventFlagMaskControl);
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
        unsafe { Self::post_scroll(vertical_units as i64, horizontal_units as i64, false) }
    }
}

impl ZoomEmitter for MacosWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        unsafe { Self::post_scroll(units as i64, 0, true) }
    }
}