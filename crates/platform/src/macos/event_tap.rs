//! macOS CGEventTap-based scroll event interception.
//!
//! Creates a system-wide event tap via raw Quartz FFI that intercepts
//! scroll wheel events. Classifies input as trackpad vs mouse based on
//! event flags, then passes events through the sink.

#![cfg(target_os = "macos")]

use crate::traits::HookEventSink;
use crate::types::{ModifierKeys, PlatformError, Result};
use core_foundation::base::{CFRelease, kCFAllocatorDefault};
use core_foundation::runloop::{CFRunLoopGetCurrent, CFRunLoopRun, CFRunLoopSource, CFRunLoopSourceInvalidate, CFRunLoopStop};
use core_foundation::string::CFStringRef;
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::Arc;

// ---------------------------------------------------------------------------
// Raw Quartz FFI — core-graphics 0.19 does not expose CGEventTapCreate
// ---------------------------------------------------------------------------

type CFMachPortRef = *mut std::os::raw::c_void;
type CGEventTapProxy = *mut std::os::raw::c_void;
type CGEventRef = *mut std::os::raw::c_void;
type CGEventTapCallBack = unsafe extern "C" fn(
    proxy: CGEventTapProxy,
    _type: u32,
    event: CGEventRef,
    user_info: *mut std::os::raw::c_void,
) -> CGEventRef;

const kCGHIDEventTap: u32 = 0;
const kCGHeadInsertEventTap: u32 = 0;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        eventsOfInterest: u64,
        callback: CGEventTapCallBack,
        userInfo: *mut std::os::raw::c_void,
    ) -> CFMachPortRef;

    fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);

    fn CFMachPortCreateRunLoopSource(
        allocator: *mut std::os::raw::c_void,
        tap: CFMachPortRef,
        order: isize,
    ) -> CFRunLoopSourceRef;

    fn CFRunLoopAddSource(rl: CFRunLoopSourceRef, source: CFRunLoopSourceRef, mode: CFStringRef);
    fn CFRunLoopRemoveSource(rl: CFRunLoopSourceRef, source: CFRunLoopSourceRef, mode: CFStringRef);

    fn CGEventGetIntegerValueField(event: CGEventRef, field: i64) -> i64;
    fn CGEventGetFlags(event: CGEventRef) -> u32;

    fn CGEventSourceCreate(allocator: *mut std::os::raw::c_void) -> *mut std::os::raw::c_void;

    // Event type constants
    static kCGEventScrollWheel: u32;
    static kCGEventFlags: u32;

    // Event field keys
    static kCGScrollWheelEventDeltaAxis1: i64;
    static kCGScrollWheelEventDeltaAxis2: i64;
    static kCGScrollWheelEventPointDeltaAxis1: i64;
    static kCGScrollWheelEventPointDeltaAxis2: i64;
    static kCGScrollWheelEventIsContinuous: i64;

    // Flag bits
    static kCGEventFlagMaskShift: u32;
    static kCGEventFlagMaskControl: u32;
    static kCGEventFlagMaskAlternate: u32;
    static kCGEventFlagMaskCommand: u32;

    // Run loop mode
    static kCFRunLoopDefaultMode: CFStringRef;

    // CF type IDs for safety checks
    fn CFGetTypeID(cf: *const std::os::raw::c_void) -> usize;
    fn CFRunLoopSourceGetTypeID() -> usize;
}

type CFRunLoopSourceRef = *mut std::os::raw::c_void;

/// The threshold above which we treat an event as a high-resolution
/// trackpad scroll (continuous) vs a mouse wheel (discrete notches).
const TRACKPAD_CONTINUOUS_THRESHOLD: i64 = 10;

/// Classifies a scroll event's input source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScrollInputSource {
    Mouse,
    Trackpad,
}

impl ScrollInputSource {
    unsafe fn from_event(event: CGEventRef) -> Self {
        let is_continuous = CGEventGetIntegerValueField(event, kCGScrollWheelEventIsContinuous);
        if is_continuous != 0 {
            Self::Trackpad
        } else {
            Self::Mouse
        }
    }
}

/// Reads modifier keys from a CGEvent.
unsafe fn read_modifiers(event: CGEventRef) -> ModifierKeys {
    let flags = CGEventGetFlags(event);
    ModifierKeys {
        shift: flags & kCGEventFlagMaskShift != 0,
        ctrl: flags & kCGEventFlagMaskControl != 0,
        alt: flags & kCGEventFlagMaskAlternate != 0,
        cmd: flags & kCGEventFlagMaskCommand != 0,
    }
}

/// Reads vertical scroll delta from a CGEvent.
unsafe fn read_vertical_delta(event: CGEventRef) -> i32 {
    let delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2);
    if delta != 0 {
        return delta as i32;
    }
    CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2) as i32
}

/// Reads horizontal scroll delta from a CGEvent.
unsafe fn read_horizontal_delta(event: CGEventRef) -> i32 {
    let delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis1);
    if delta != 0 {
        return delta as i32;
    }
    CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis1) as i32
}

// ---------------------------------------------------------------------------
// Global callback bridge — C FFI callback cannot capture Rust closures
// ---------------------------------------------------------------------------

struct TapCallback {
    sink: Arc<dyn HookEventSink>,
    source: *mut std::os::raw::c_void,
    run_loop_source: CFRunLoopSourceRef,
    tap: CFMachPortRef,
    stop: Arc<AtomicBool>,
}

static CALLBACK_PTR: AtomicPtr<TapCallback> = AtomicPtr::new(std::ptr::null_mut());

unsafe extern "C" fn event_callback(
    _proxy: CGEventTapProxy,
    _type: u32,
    event: CGEventRef,
    _user_info: *mut std::os::raw::c_void,
) -> CGEventRef {
    let cb_ptr = CALLBACK_PTR.load(Ordering::Relaxed);
    if cb_ptr.is_null() {
        return event;
    }
    let cb = &*cb_ptr;

    let source = ScrollInputSource::from_event(event);
    let v_delta = read_vertical_delta(event);
    let h_delta = read_horizontal_delta(event);
    let mods = read_modifiers(event);

    let input_source = match source {
        ScrollInputSource::Trackpad => smoothscroll_core::input_source::InputSource::Touchpad,
        ScrollInputSource::Mouse => smoothscroll_core::input_source::InputSource::Wheel,
    };

    let _v_decision = cb.sink.on_wheel_ext(v_delta, mods, input_source);
    let _h_decision = cb.sink.on_hwheel_ext(h_delta, input_source);

    // Pass the event through unmodified — the sink observes and may
    // modify engine state; actual event modification for smoothing
    // happens via the wheel_emitter posting synthetic events.
    event
}

/// Creates and runs the event tap. Blocks until `stop` is set to true.
pub fn run_event_loop(
    sink: Arc<dyn HookEventSink>,
    stop: Arc<AtomicBool>,
) -> Result<()> {
    // Build the mask of interest: scroll wheel events only.
    let events_of_interest: u64 = 1 << kCGEventScrollWheel;

    let tap = unsafe {
        CGEventTapCreate(
            kCGHIDEventTap,
            kCGHeadInsertEventTap,
            0, // CGEventTapOptions::Default
            events_of_interest,
            event_callback,
            std::ptr::null_mut(),
        )
    };

    if tap.is_null() {
        return Err(PlatformError::PermissionDenied);
    }

    let source = unsafe { CGEventSourceCreate(kCFAllocatorDefault) };
    if source.is_null() {
        unsafe { CFRelease(tap as *const _); }
        return Err(PlatformError::Os("failed to create CGEventSource".into()));
    }

    let run_loop_source = unsafe {
        CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    };
    if run_loop_source.is_null() {
        unsafe {
            CFRelease(tap as *const _);
            CFRelease(source as *const _);
        }
        return Err(PlatformError::Os("failed to create run loop source".into()));
    }

    let cb = Box::new(TapCallback {
        sink,
        source,
        run_loop_source,
        tap,
        stop: stop.clone(),
    });
    let cb_ptr = Box::into_raw(cb);
    CALLBACK_PTR.store(cb_ptr, Ordering::Relaxed);

    unsafe {
        CGEventTapEnable(tap, true);

        let run_loop = CFRunLoopGetCurrent();
        CFRunLoopAddSource(run_loop, run_loop_source, kCFRunLoopDefaultMode);
    }

    // Run the loop — poll the stop flag periodically.
    while !stop.load(Ordering::Relaxed) {
        std::thread::sleep(std::time::Duration::from_millis(16));
    }

    // Clean up.
    unsafe {
        let run_loop = CFRunLoopGetCurrent();
        CFRunLoopRemoveSource(run_loop, run_loop_source, kCFRunLoopDefaultMode);
        CFRunLoopSourceInvalidate(run_loop_source);

        CGEventTapEnable(tap, false);
        CFRelease(tap as *const _);
        CFRelease(source as *const _);

        let _ = Box::from_raw(cb_ptr);
    }
    CALLBACK_PTR.store(std::ptr::null_mut(), Ordering::Relaxed);

    Ok(())
}
