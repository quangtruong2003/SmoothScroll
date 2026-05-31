//! macOS CGEventTap-based scroll event interception.
//!
//! Creates a system-wide event tap via raw Quartz FFI that intercepts
//! scroll wheel events. Classifies input as trackpad vs mouse based on
//! event flags, then passes events through the sink.

#![cfg(target_os = "macos")]

use crate::traits::HookEventSink;
use crate::types::{ModifierKeys, PlatformError, Result};
use core_foundation::base::{CFAllocatorRef, CFRelease, kCFAllocatorDefault};
use core_foundation::runloop::{
    CFRunLoopAddSource, CFRunLoopGetCurrent, CFRunLoopRemoveSource,
    CFRunLoopRunInMode, CFRunLoopSource, CFRunLoopSourceInvalidate,
};
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::Arc;

// ---------------------------------------------------------------------------
// Raw Quartz FFI — core-graphics 0.19 does not expose CGEventTapCreate
// ---------------------------------------------------------------------------

type CFMachPortRef = *mut std::os::raw::c_void;
type CFRunLoopRef = *mut std::os::raw::c_void;
type CFRunLoopSourceRef = *mut std::os::raw::c_void;
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
        allocator: CFAllocatorRef,
        tap: CFMachPortRef,
        order: isize,
    ) -> CFRunLoopSourceRef;

    // FIX #1: First param is CFRunLoopRef, not CFRunLoopSourceRef
    fn CFRunLoopAddSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);
    fn CFRunLoopRemoveSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);

    fn CGEventGetIntegerValueField(event: CGEventRef, field: i64) -> i64;
    fn CGEventGetFlags(event: CGEventRef) -> u32;

    // Event field keys (raw CFStringRef)
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

    // Run loop mode (raw CFStringRef)
    static kCFRunLoopDefaultMode: CFStringRef;

    // CFMachPort cleanup
    fn CFMachPortInvalidate(port: CFMachPortRef);

    // kCFAllocatorDefault constant for the allocator param
    static kCFAllocatorDefault: CFAllocatorRef;
}

use core_foundation::string::CFStringRef;

/// Classifies a scroll event's input source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScrollInputSource {
    Mouse,
    Trackpad,
}

impl ScrollInputSource {
    // SAFETY: `event` must be a valid, non-null CGEventRef passed by the system
    // to our event tap callback. The system guarantees the pointer is valid
    // for the duration of the callback.
    unsafe fn from_event(event: CGEventRef) -> Self {
        let is_continuous = CGEventGetIntegerValueField(event, kCGScrollWheelEventIsContinuous);
        if is_continuous != 0 {
            Self::Trackpad
        } else {
            Self::Mouse
        }
    }
}

// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
unsafe fn read_modifiers(event: CGEventRef) -> ModifierKeys {
    let flags = CGEventGetFlags(event);
    ModifierKeys {
        shift: flags & kCGEventFlagMaskShift != 0,
        ctrl: flags & kCGEventFlagMaskControl != 0,
        alt: flags & kCGEventFlagMaskAlternate != 0,
        cmd: flags & kCGEventFlagMaskCommand != 0,
    }
}

// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
unsafe fn read_vertical_delta(event: CGEventRef) -> i32 {
    let delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2);
    if delta != 0 {
        return delta as i32;
    }
    CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2) as i32
}

// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
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
    run_loop_source: CFRunLoopSourceRef,
    tap: CFMachPortRef,
    stop: Arc<AtomicBool>,
}

// FIX #12: Use SeqCst for cross-thread pointer sharing — the callback runs
// on the event tap's internal thread, not the creating thread.
static CALLBACK_PTR: AtomicPtr<TapCallback> = AtomicPtr::new(std::ptr::null_mut());

// SAFETY: This callback is invoked by the system on the event tap's dedicated
// thread. CALLBACK_PTR is loaded with SeqCst ordering and is guaranteed to
// be non-null between run_event_loop setup and teardown.
unsafe extern "C" fn event_callback(
    _proxy: CGEventTapProxy,
    _type: u32,
    event: CGEventRef,
    _user_info: *mut std::os::raw::c_void,
) -> CGEventRef {
    let cb_ptr = CALLBACK_PTR.load(Ordering::SeqCst);
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
///
/// FIX #7: This function MUST be called from the main thread (or a thread
/// with a proper CFRunLoop). It pumps the run loop internally so the
/// callback actually fires.
pub fn run_event_loop(
    sink: Arc<dyn HookEventSink>,
    stop: Arc<AtomicBool>,
) -> Result<()> {
    // Build the mask of interest: scroll wheel events only.
    let events_of_interest: u64 = 1 << 22; // kCGEventScrollWheel = 22

    // SAFETY: CGEventTapCreate is a standard Core Graphics function.
    // We pass valid function pointers and constants.
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

    // FIX #5: Remove unused CGEventSource creation — it was never used.

    // SAFETY: CFMachPortCreateRunLoopSource requires a valid CFMachPortRef
    // (tap) which we just created and verified is non-null.
    let run_loop_source = unsafe {
        CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    };
    if run_loop_source.is_null() {
        unsafe {
            CFMachPortInvalidate(tap);
            CFRelease(tap as *const _);
        }
        return Err(PlatformError::Os("failed to create run loop source".into()));
    }

    let cb = Box::new(TapCallback {
        sink,
        run_loop_source,
        tap,
        stop: stop.clone(),
    });
    // FIX #12: SeqCst for the store to match the SeqCst load in the callback.
    let cb_ptr = Box::into_raw(cb);
    CALLBACK_PTR.store(cb_ptr, Ordering::SeqCst);

    // SAFETY: tap is a valid CFMachPortRef, run_loop_source is a valid
    // CFRunLoopSourceRef, kCFRunLoopDefaultMode is a system constant.
    unsafe {
        CGEventTapEnable(tap, true);

        let run_loop = CFRunLoopGetCurrent();
        CFRunLoopAddSource(run_loop, run_loop_source, kCFRunLoopDefaultMode);
    }

    // FIX #6: Actually pump the run loop so callbacks fire.
    // CFRunLoopRunInMode processes pending events and returns after the
    // timeout, allowing us to check the stop flag.
    while !stop.load(Ordering::SeqCst) {
        // SAFETY: kCFRunLoopDefaultMode is a valid system CFStringRef constant.
        // CFRunLoopRunInMode is safe to call repeatedly from the same thread.
        unsafe {
            CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.016, false);
        }
    }

    // Clean up.
    // SAFETY: All pointers were created above and are still valid.
    // CFMachPortInvalidate must be called before CFRelease for mach ports.
    unsafe {
        let run_loop = CFRunLoopGetCurrent();
        CFRunLoopRemoveSource(run_loop, run_loop_source, kCFRunLoopDefaultMode);
        CFRunLoopSourceInvalidate(run_loop_source);

        CGEventTapEnable(tap, false);
        CFMachPortInvalidate(tap);
        CFRelease(tap as *const _);

        let _ = Box::from_raw(cb_ptr);
    }
    CALLBACK_PTR.store(std::ptr::null_mut(), Ordering::SeqCst);

    Ok(())
}