//! macOS CGEventTap-based scroll event interception.
//!
//! Creates a system-wide event tap via raw Quartz FFI that intercepts
//! scroll wheel events. Classifies input as trackpad vs mouse based on
//! event flags, then passes events through the sink.

#![cfg(target_os = "macos")]

use crate::traits::HookEventSink;
use crate::types::{HookDecision, ModifierKeys, PlatformError, Result};
use core_foundation::runloop::kCFRunLoopDefaultMode;
use core_foundation::string::CFStringRef;
use core_foundation_sys::base::{kCFAllocatorDefault, CFAllocatorRef, CFRelease};
use core_foundation_sys::runloop::{
    CFRunLoopAddSource, CFRunLoopGetMain, CFRunLoopRef, CFRunLoopRemoveSource,
    CFRunLoopSourceInvalidate, CFRunLoopSourceRef, CFRunLoopWakeUp,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::sync::Mutex;

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
type CFTypeRef = *mut std::os::raw::c_void;

const kCGHIDEventTap: u32 = 0;
const kCGHeadInsertEventTap: u32 = 0;
const kCGEventKeyDown: u32 = 10; // for hotkey interception

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

    fn CGEventGetIntegerValueField(event: CGEventRef, field: i64) -> i64;
    fn CGEventGetFlags(event: CGEventRef) -> u32;

    // CFMachPort cleanup
    fn CFMachPortInvalidate(port: CFMachPortRef);
}

// Quartz modifier flag masks
const kCGEventFlagMaskShift: u32 = 0x00020000;
const kCGEventFlagMaskControl: u32 = 0x00040000;
const kCGEventFlagMaskAlternate: u32 = 0x00080000;
const kCGEventFlagMaskCommand: u32 = 0x00100000;

// Event field keys defined as constants to avoid link errors (Quartz enums)
const kCGScrollWheelEventDeltaAxis1: i64 = 96;
const kCGScrollWheelEventDeltaAxis2: i64 = 97;
const kCGScrollWheelEventPointDeltaAxis1: i64 = 126;
const kCGScrollWheelEventPointDeltaAxis2: i64 = 127;
const kCGScrollWheelEventIsContinuous: i64 = 124;
const kCGKeyboardEventKeycode: i64 = 9;

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

/// SAFETY: `event` must be a valid CGEventRef from the system event tap callback.
unsafe fn read_keycode(event: CGEventRef) -> u16 {
    CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) as u16
}

// ---------------------------------------------------------------------------
// HotkeyRegistry — shared between event tap callback and MacosHotkey::register
// ---------------------------------------------------------------------------

/// Thread-safe hotkey registry. Stores (modifiers, keycode) → callback mappings.
/// Shared between the event tap callback and MacosHotkey::register().
pub struct HotkeyRegistry {
    pub(crate) callbacks: HashMap<(u32, u16), Box<dyn Fn() + Send + Sync>>,
}

impl HotkeyRegistry {
    pub fn new() -> Self {
        Self {
            callbacks: HashMap::new(),
        }
    }

    pub fn register(
        &mut self,
        modifiers: u32,
        keycode: u16,
        callback: Box<dyn Fn() + Send + Sync>,
    ) -> Option<Box<dyn Fn() + Send + Sync>> {
        self.callbacks.insert((modifiers, keycode), callback)
    }

    pub fn unregister(
        &mut self,
        modifiers: u32,
        keycode: u16,
    ) -> Option<Box<dyn Fn() + Send + Sync>> {
        self.callbacks.remove(&(modifiers, keycode))
    }

    pub fn dispatch(&self, keycode: u16, flags: u32) {
        // Exact modifier+keycode match only (same as X11/Linux behavior)
        if let Some(cb) = self.callbacks.get(&(flags, keycode)) {
            cb();
        }
    }
}

impl Default for HotkeyRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Global registry — initialized during install_on_main_thread, read by MacosHotkey::register().
/// Uses OnceLock pattern: set once during install, read many times during hotkey registration.
pub(crate) static HOTKEY_REGISTRY: std::sync::OnceLock<Mutex<HotkeyRegistry>> =
    std::sync::OnceLock::new();

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
    event_type: u32,
    event: CGEventRef,
    _user_info: *mut std::os::raw::c_void,
) -> CGEventRef {
    let cb_ptr = CALLBACK_PTR.load(Ordering::SeqCst);
    if cb_ptr.is_null() {
        return event;
    }
    let cb = &*cb_ptr;

    match event_type {
        22 => {
            // kCGEventScrollWheel — existing scroll handling
            let source = ScrollInputSource::from_event(event);
            let v_delta = read_vertical_delta(event);
            let h_delta = read_horizontal_delta(event);
            let mods = read_modifiers(event);
            let input_source = match source {
                ScrollInputSource::Trackpad => {
                    smoothscroll_core::input_source::InputSource::Touchpad
                }
                ScrollInputSource::Mouse => smoothscroll_core::input_source::InputSource::Wheel,
            };
            let v_decision = cb.sink.on_wheel_ext(v_delta, mods, input_source);
            let h_decision = cb.sink.on_hwheel_ext(h_delta, input_source);
            if v_decision == HookDecision::Swallow || h_decision == HookDecision::Swallow {
                return std::ptr::null_mut();
            }
        }
        10 => {
            // kCGEventKeyDown — dispatch to hotkey registry
            let keycode = read_keycode(event);
            let flags = CGEventGetFlags(event);
            if let Some(reg) = HOTKEY_REGISTRY.get() {
                reg.lock().unwrap().dispatch(keycode, flags);
            }
        }
        _ => {}
    }

    event
}

/// Creates and runs the event tap. Blocks until `stop` is set to true.
///
/// IMPORTANT: macOS's `kCGHIDEventTap` only reliably delivers events when
/// the tap is created on the **main thread** AND its source is registered
/// against the **main thread's** `CFRunLoop`. Tauri's macOS embed runs
/// `NSApp` on the main thread, and the Tauri setup hook fires on that
/// same thread BEFORE the NSApp event loop starts pumping.
///
/// Two-stage design to keep the tap on the main thread safely:
///
/// 1. The caller (Tauri's setup callback) invokes
///    [`install_on_main_thread`] synchronously on the main thread. That
///    creates the tap, attaches its source to `CFRunLoopGetMain()`, and
///    returns the run-loop source plus an `Arc<AtomicBool>` "running"
///    flag to the caller.
/// 2. The caller then spawns `run_event_loop` on a background thread,
///    passing the source and flag. The background thread only blocks on
///    `stop` and on the running flag. Teardown is scheduled back onto
///    the main thread via `dispatch_async`.
///
/// Tauri's `NSApp` loop pumps the main run loop while we sit on the
/// background thread, so the CFMachPort source fires callbacks on the
/// main thread.
pub fn run_event_loop(
    source_addr: usize,
    running: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
) -> Result<()> {
    // SAFETY: the source was allocated on the main thread by
    // `install_on_main_thread` and remains alive for the duration of this
    // function (Tauri's NSApp is still running; teardown on the main thread
    // happens at the bottom). We pass the address across the thread
    // boundary as `usize` because `CFRunLoopSourceRef` (a raw pointer) is
    // not `Send`.
    let source: CFRunLoopSourceRef =
        source_addr as *mut core_foundation_sys::runloop::__CFRunLoopSource;

    // Block on `stop`. Tauri's NSApp pumps the main run loop (and the
    // event tap source attached to it) on the main thread, while we
    // wait here.
    while !stop.load(Ordering::SeqCst) && running.load(Ordering::SeqCst) {
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    // Schedule teardown on the main thread; safe because main loop is
    // still pumping.
    let (done_tx, done_rx) = mpsc::channel::<()>();
    unsafe {
        teardown_on_main_thread(source, done_tx);
    }
    let _ = done_rx.recv();

    Ok(())
}

/// Install the event tap on the main thread. **Must** be invoked from
/// the main thread (e.g. inside Tauri's `setup` callback). Returns the
/// run-loop source so the caller can hand it to the background pumping
/// thread, plus a "running" flag the background thread polls.
///
/// The caller must drop the returned `Tap` (or call [`teardown_on_main_thread`])
/// after the background thread finishes.
pub unsafe fn install_on_main_thread(sink: Arc<dyn HookEventSink>) -> Result<InstalledTap> {
    // kCGEventScrollWheel = 22, kCGEventKeyDown = 10
    let events_of_interest: u64 = (1 << 22) | (1 << 10);

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

    let run_loop_source: CFRunLoopSourceRef =
        unsafe { CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap as CFTypeRef, 0) };
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

    // Initialize global registry so MacosHotkey can register callbacks before
    // the tap is actually installed (during build()).
    if HOTKEY_REGISTRY.get().is_none() {
        let _ = HOTKEY_REGISTRY.set(Mutex::new(HotkeyRegistry::new()));
    }

    unsafe {
        CGEventTapEnable(tap, true);
        let main_run_loop = CFRunLoopGetMain();
        CFRunLoopAddSource(main_run_loop, run_loop_source, kCFRunLoopDefaultMode);
    }

    Ok(InstalledTap {
        source: run_loop_source,
        tap,
        running: Arc::new(AtomicBool::new(true)),
    })
}

/// Bundles the resources returned by [`install_on_main_thread`].
pub struct InstalledTap {
    pub source: CFRunLoopSourceRef,
    pub tap: CFMachPortRef,
    pub running: Arc<AtomicBool>,
}

unsafe impl Send for InstalledTap {}
unsafe impl Sync for InstalledTap {}

/// Dispatched onto the main thread via libdispatch. Removes the source
/// from the main run loop, invalidates it, releases the tap, and frees
/// the callback box.
unsafe fn teardown_on_main_thread(source: CFRunLoopSourceRef, done_tx: mpsc::Sender<()>) {
    #[link(name = "System")]
    extern "C" {
        fn dispatch_get_main_queue() -> *mut std::os::raw::c_void;
        fn dispatch_async_f(
            queue: *mut std::os::raw::c_void,
            context: *mut std::os::raw::c_void,
            work: unsafe extern "C" fn(*mut std::os::raw::c_void),
        );
    }

    struct Ctx {
        source: CFRunLoopSourceRef,
        done_tx: mpsc::Sender<()>,
    }

    unsafe extern "C" fn worker(ctx_ptr: *mut std::os::raw::c_void) {
        let ctx = unsafe { Box::from_raw(ctx_ptr as *mut Ctx) };

        unsafe {
            // Invalidate the source BEFORE clearing CALLBACK_PTR so that any
            // in-flight callback that fires right now still finds valid data.
            // After source invalidation the tap stops delivering events, so
            // subsequent callbacks are impossible.
            let main_run_loop = CFRunLoopGetMain();
            CFRunLoopWakeUp(main_run_loop);
            CFRunLoopRemoveSource(main_run_loop, ctx.source, kCFRunLoopDefaultMode);
            CFRunLoopSourceInvalidate(ctx.source);
        }

        // Now that the tap is shut down, clear CALLBACK_PTR so any
        // hypothetical racing callback sees null and returns early.
        CALLBACK_PTR.store(std::ptr::null_mut(), Ordering::SeqCst);

        let _ = ctx.done_tx.send(());
    }

    let ctx = Box::new(Ctx { source, done_tx });
    let main_q = unsafe { dispatch_get_main_queue() };
    unsafe {
        dispatch_async_f(main_q, Box::into_raw(ctx) as *mut _, worker);
    }
}
