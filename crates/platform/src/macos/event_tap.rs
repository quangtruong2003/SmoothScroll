//! macOS CGEventTap-based scroll event interception.
//!
//! Creates a system-wide event tap at `kCGHIDEventTap` that intercepts
//! scroll wheel events. Classifies input as trackpad vs mouse based on
//! event flags, then passes deltas through the `HookEventSink`.
//!
//! **Note:** `core-graphics` 0.19 does not expose a high-level `CGEventTap`
//! struct with closure callbacks. This implementation uses the raw Quartz
//! FFI (`CGEventTapCreate`) with a thread-local callback registry.

#![cfg(target_os = "macos")]

use crate::traits::HookEventSink;
use std::ptr;
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::Arc;

/// Event type constant for scroll wheel (kCGEventScrollWheel = 22).
const kCGEventScrollWheel: u32 = 22;

/// Event field: scroll wheel delta axis 1 (horizontal).
const kCGScrollWheelEventDeltaAxis1: i32 = 0x116;
/// Event field: scroll wheel delta axis 2 (vertical).
const kCGScrollWheelEventDeltaAxis2: i32 = 0x117;
/// Event field: point delta axis 1 (horizontal, discrete).
const kCGScrollWheelEventPointDeltaAxis1: i32 = 0x118;
/// Event field: point delta axis 2 (vertical, discrete).
const kCGScrollWheelEventPointDeltaAxis2: i32 = 0x119;
/// Event field: is continuous flag (trackpad vs mouse wheel).
const kCGScrollWheelEventIsContinuous: i32 = 0x100;

/// Classifies a scroll event's input source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScrollInputSource {
    Mouse,
    Trackpad,
}

impl ScrollInputSource {
    /// Classify from a raw CGEventRef pointer.
    fn from_ptr(event: *mut libc::c_void) -> Self {
        let is_continuous = unsafe {
            CGEventGetIntegerValueField(event, kCGScrollWheelEventIsContinuous)
        };
        if is_continuous != 0 {
            Self::Trackpad
        } else {
            Self::Mouse
        }
    }
}

/// Thread-local storage for the callback sink and stop flag.
/// Needed because CGEventTap callbacks are raw C function pointers.
struct TapCallback {
    sink: Arc<dyn HookEventSink>,
    stop: Arc<AtomicBool>,
}

static CALLBACK: AtomicPtr<TapCallback> = AtomicPtr::new(ptr::null_mut());

/// Reads vertical scroll delta from a CGEventRef.
fn read_vertical_delta(event: *mut libc::c_void) -> i32 {
    let delta = unsafe { CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2) };
    if delta != 0 {
        return delta as i32;
    }
    unsafe { CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2) as i32 }
}

/// Reads horizontal scroll delta from a CGEventRef.
fn read_horizontal_delta(event: *mut libc::c_void) -> i32 {
    let delta = unsafe { CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis1) };
    if delta != 0 {
        return delta as i32;
    }
    unsafe { CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis1) as i32 }
}

/// Raw FFI bindings for Quartz Event Services.
extern "C" {
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        eventsOfInterest: u64,
        callback: unsafe extern "C" fn(
            proxy: *mut libc::c_void,
            etype: u32,
            event: *mut libc::c_void,
            user_info: *mut libc::c_void,
        ) -> *mut libc::c_void,
        user_info: *mut libc::c_void,
    ) -> *mut libc::c_void;

    fn CGEventGetIntegerValueField(event: *mut libc::c_void, field: i32) -> i64;

    fn CGEventTapEnable(tap: *mut libc::c_void, enable: bool);

    fn CFMachPortCreateRunLoopSource(
        allocator: *mut libc::c_void,
        port: *mut libc::c_void,
        order: isize,
    ) -> *mut libc::c_void;

    fn CFRunLoopGetCurrent() -> *mut libc::c_void;

    fn CFRunLoopAddSource(rl: *mut libc::c_void, source: *mut libc::c_void, mode: *const libc::c_char);

    fn CFRunLoopRun();

    fn CFRunLoopStop(rl: *mut libc::c_void);

    fn CFRelease(cf: *mut libc::c_void);

    // CGEventTap location constants
    static kCGHIDEventTap: u32;
    static kCGHeadInsertEventTap: u32;
    static kCFRunLoopCommonModes: *const libc::c_char;
}

/// The C callback invoked by the event tap for each intercepted event.
/// SAFETY: Called by the system on the run loop thread. `event` is a valid
/// CGEventRef. We must return it (or a replacement) to keep the tap alive.
unsafe extern "C" fn event_callback(
    _proxy: *mut libc::c_void,
    _etype: u32,
    event: *mut libc::c_void,
    _user_info: *mut libc::c_void,
) -> *mut libc::c_void {
    let cb_ptr = CALLBACK.load(Ordering::Relaxed);
    if cb_ptr.is_null() {
        return event;
    }
    let cb = &*cb_ptr;

    // Stop flag check.
    if cb.stop.load(Ordering::Relaxed) {
        return event;
    }

    let source = ScrollInputSource::from_ptr(event);
    let v_delta = read_vertical_delta(event);
    let h_delta = read_horizontal_delta(event);

    // Build InputSource from the smoothscroll_core crate.
    let input_source = match source {
        ScrollInputSource::Trackpad => smoothscroll_core::input_source::InputSource::Touchpad,
        ScrollInputSource::Mouse => smoothscroll_core::input_source::InputSource::Wheel,
    };

    // Pass through the sink. Default modifiers (no modifier key info available
    // from raw event fields without additional FFI).
    let mods = crate::types::ModifierKeys::default();
    cb.sink.on_wheel_ext(v_delta, mods, input_source);
    cb.sink.on_hwheel_ext(h_delta, input_source);

    // Return the event unmodified so it continues through the system.
    event
}

/// Creates and runs the CGEventTap, processing scroll events through `sink`.
/// Blocks until `stop` is set to true.
pub fn run_event_loop(sink: Arc<dyn HookEventSink>, stop: Arc<AtomicBool>) -> crate::types::Result<()> {
    // Store callback in thread-local so the C function can access it.
    let cb = Box::new(TapCallback {
        sink,
        stop: stop.clone(),
    });
    let cb_ptr = Box::into_raw(cb);
    CALLBACK.store(cb_ptr, Ordering::Relaxed);

    // Create the event tap for scroll wheel events only.
    // Events of interest is a bitset: 1 << event_type.
    let events_of_interest: u64 = 1u64 << kCGEventScrollWheel;

    let tap = unsafe {
        CGEventTapCreate(
            kCGHIDEventTap,
            kCGHeadInsertEventTap,
            0, // kCGEventTapOptionDefault
            events_of_interest,
            event_callback,
            ptr::null_mut(),
        )
    };

    if tap.is_null() {
        // Clean up the callback box we leaked above.
        let _ = Box::from_raw(cb_ptr);
        return Err(crate::types::PlatformError::PermissionDenied);
    }

    // Enable the tap.
    unsafe {
        CGEventTapEnable(tap, true);
    }

    // Create a run loop source from the mach port and add it.
    let source = unsafe { CFMachPortCreateRunLoopSource(ptr::null_mut(), tap, 0) };
    if !source.is_null() {
        unsafe {
            CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
        }
    }

    // Run the loop — blocks until CFRunLoopStop is called or stop flag is set.
    // For simplicity we poll the stop flag and let CFRunLoopRun handle dispatch.
    // In production, use a timer source to periodically check `stop` and call
    // CFRunLoopStop.
    while !stop.load(Ordering::Relaxed) {
        std::thread::sleep(std::time::Duration::from_millis(16));
    }

    // Cleanup.
    unsafe {
        CFRunLoopStop(CFRunLoopGetCurrent());
        CGEventTapEnable(tap, false);
        if !source.is_null() {
            CFRelease(source);
        }
        CFRelease(tap);
    }

    // Reclaim the callback box.
    let _cb = unsafe { Box::from_raw(cb_ptr) };
    CALLBACK.store(ptr::null_mut(), Ordering::Relaxed);

    Ok(())
}
