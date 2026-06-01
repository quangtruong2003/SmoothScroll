//! macOS CGEventTap-based scroll event interception.
//!
//! Creates a system-wide event tap via raw Quartz FFI that intercepts
//! scroll wheel events. Classifies input as trackpad vs mouse based on
//! event flags, then passes events through the sink.

#![cfg(target_os = "macos")]

use crate::traits::HookEventSink;
use crate::types::{ModifierKeys, PlatformError, Result};
use core_foundation::base::CFRelease;
use core_foundation::string::CFStringRef;
use core_foundation_sys::base::CFAllocatorRef;
use core_foundation_sys::base::kCFAllocatorDefault;
use core_foundation_sys::runloop::CFRunLoopGetCurrent;
use core_foundation_sys::runloop::CFRunLoopRunInMode;
use core_foundation_sys::runloop::CFRunLoopSourceInvalidate;
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

// Use the concrete CF types from core-foundation-sys
use core_foundation_sys::runloop::CFRunLoopRef;
use core_foundation_sys::runloop::CFRunLoopSourceRef;
use core_foundation_sys::base::CFTypeRef;

// Run loop mode from core-foundation (no name conflict — this is a Rust const, not extern)
use core_foundation::runloop::kCFRunLoopDefaultMode;

const kCGHIDEventTap: u32 = 0;
const kCGHeadInsertEventTap: u32 = 0;

// CFMachPortRef is CFTypeRef (which is *mut libc::c_void) on macOS
// We need to cast between these types.
type MyCFTypeRef = CFTypeRef;

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

    fn CFRunLoopAddSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);
    fn CFRunLoopRemoveSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);

    fn CGEventGetIntegerValueField(event: CGEventRef, field: i64) -> i64;
    fn CGEventGetFlags(event: CGEventRef) -> u32;

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

    // CFMachPort cleanup
    fn CFMachPortInvalidate(port: CFMachPortRef);
}

/// Classifies a scroll event's input source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScrollInputSource {
    Mouse,
    Trackpad,
}

impl ScrollInputSource {
    /// SAFETY: `event` must be a valid, non-null CGEventRef passed by the system.
    unsafe fn from_event(event: CGEventRef) -> Self {
        let is_continuous = CGEventGetIntegerValueField(event, kCGScrollWheelEventIsContinuous);
        if is_continuous != 0 {
            Self::Trackpad
        } else {
            Self::Mouse
        }
    }
}

/// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
unsafe fn read_modifiers(event: CGEventRef) -> ModifierKeys {
    let flags = CGEventGetFlags(event);
    ModifierKeys {
        shift: flags & kCGEventFlagMaskShift != 0,
        ctrl: flags & kCGEventFlagMaskControl != 0,
        alt: flags & kCGEventFlagMaskAlternate != 0,
        cmd: flags & kCGEventFlagMaskCommand != 0,
    }
}

/// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
unsafe fn read_vertical_delta(event: CGEventRef) -> i32 {
    let delta = CGEventGetIntegerValueField(event, kCGScrollWheelEventDeltaAxis2);
    if delta != 0 {
        return delta as i32;
    }
    CGEventGetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis2) as i32
}

/// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
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
}

static CALLBACK_PTR: AtomicPtr<TapCallback> = AtomicPtr::new(std::ptr::null_mut());

/// SAFETY: Callback is invoked by the system on the event tap's dedicated thread.
/// CALLBACK_PTR is loaded with SeqCst and guaranteed non-null between setup and teardown.
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

    event
}

/// Creates and runs the event tap. Blocks until `stop` is set to true.
/// MUST be called from the main thread (or a thread with a proper CFRunLoop).
pub fn run_event_loop(
    sink: Arc<dyn HookEventSink>,
    stop: Arc<AtomicBool>,
) -> Result<()> {
    // kCGEventScrollWheel = 22
    let events_of_interest: u64 = 1 << 22;

    let tap = unsafe {
        CGEventTapCreate(
            kCGHIDEventTap,
            kCGHeadInsertEventTap,
            0,
            events_of_interest,
            event_callback,
            std::ptr::null_mut(),
        )
    };

    if tap.is_null() {
        return Err(PlatformError::PermissionDenied);
    }

    let run_loop_source: CFRunLoopSourceRef = unsafe {
        CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap as MyCFTypeRef, 0)
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
    });
    let cb_ptr = Box::into_raw(cb);
    CALLBACK_PTR.store(cb_ptr, Ordering::SeqCst);

    unsafe {
        CGEventTapEnable(tap, true);
        let run_loop = CFRunLoopGetCurrent();
        CFRunLoopAddSource(run_loop, run_loop_source, kCFRunLoopDefaultMode);
    }

    while !stop.load(Ordering::SeqCst) {
        // CFRunLoopRunInMode takes Boolean (u8): false = 0
        unsafe {
            CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.016, 0);
        }
    }

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