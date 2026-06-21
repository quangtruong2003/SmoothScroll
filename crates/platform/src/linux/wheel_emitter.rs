//! Scroll injection via XTest extension.
//!
//! CRITICAL: XTest events trigger XInput2 raw events, causing feedback loops.
//! We use a static suppression flag — WheelEmitter sets it before injecting,
//! and MouseHook skips events while it's set.
//!
//! The suppression flag is set/cleared INSIDE the Display mutex to prevent
//! race conditions where concurrent emit() calls could clear the flag early.
//!
//! Uses a persistent Display connection to avoid per-emit open/close overhead.

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use parking_lot::Mutex;
use x11::keysym;
use x11::xlib;
use x11::xtest;

use super::display;

/// Wrapper to make `*mut xlib::Display` thread-safe.
///
/// # Safety
/// X11 Display connections are NOT thread-safe at the protocol level.
/// Each subsystem opens its own Display (see `display.rs` comments).
/// The Mutex ensures only one thread accesses this connection at a time.
struct SendDisplay(*mut xlib::Display);

// SAFETY: Each LinuxWheelEmitter owns its own Display connection
// opened via XOpenDisplay. The Mutex<*mut Display> guarantees
// exclusive access. No two threads call xlib functions on the
// same pointer simultaneously.
unsafe impl Send for SendDisplay {}
unsafe impl Sync for SendDisplay {}

/// Global suppression flag. WheelEmitter sets this before injecting events.
/// MouseHook checks and skips events while this is true.
static SUPPRESSING: AtomicBool = AtomicBool::new(false);

/// Check if the current event should be suppressed (self-injected by WheelEmitter).
pub fn is_suppressed() -> bool {
    SUPPRESSING.load(Ordering::Acquire)
}

const BUTTON_SCROLL_UP: u32 = 4;
const BUTTON_SCROLL_DOWN: u32 = 5;
const BUTTON_SCROLL_LEFT: u32 = 6;
const BUTTON_SCROLL_RIGHT: u32 = 7;

pub struct LinuxWheelEmitter {
    display: Mutex<SendDisplay>,
    ctrl_keycode: u32,
}

impl LinuxWheelEmitter {
    pub fn new() -> Result<Self> {
        let d = display::open_display()?;

        // Verify XTest is available
        let mut event_base: c_int = 0;
        let mut error_base: c_int = 0;
        let mut major: c_int = 0;
        let mut minor: c_int = 0;
        if unsafe {
            xtest::XTestQueryExtension(d, &mut event_base, &mut error_base, &mut major, &mut minor)
        } == 0
        {
            unsafe { display::close_display(d) };
            return Err(PlatformError::Os("XTest extension not available".into()));
        }

        // Resolve Ctrl keycode at runtime (not hardcoded!)
        let ctrl_keycode = unsafe { display::keysym_to_keycode(d, keysym::XK_Control_L.into()) };

        Ok(Self {
            display: Mutex::new(SendDisplay(d)),
            ctrl_keycode,
        })
    }

    /// Run a closure with the Display connection held.
    ///
    /// When `suppress` is true, sets the suppression flag INSIDE the mutex
    /// so no concurrent emit() can clear it prematurely. Cleared after flush.
    fn emit_with_suppress<T, F>(&self, suppress: bool, f: F) -> Result<T>
    where
        F: FnOnce(*mut xlib::Display) -> Result<T>,
    {
        let SendDisplay(d) = *self.display.lock();
        if suppress {
            SUPPRESSING.store(true, Ordering::Release);
        }
        let result = f(d);
        unsafe { xlib::XFlush(d); }
        if suppress {
            SUPPRESSING.store(false, Ordering::Release);
        }
        result
    }
}

impl WheelEmitter for LinuxWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }

        let result = self.emit_with_suppress(true, |d| {
            if vertical_units != 0 {
                let button = if vertical_units > 0 {
                    BUTTON_SCROLL_UP
                } else {
                    BUTTON_SCROLL_DOWN
                };
                let count = vertical_units.unsigned_abs();
                for _ in 0..count {
                    unsafe {
                        xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                        xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                    }
                }
            }
            if horizontal_units != 0 {
                let button = if horizontal_units > 0 {
                    BUTTON_SCROLL_RIGHT
                } else {
                    BUTTON_SCROLL_LEFT
                };
                let count = horizontal_units.unsigned_abs();
                for _ in 0..count {
                    unsafe {
                        xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                        xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                    }
                }
            }
            Ok(())
        });

        // Brief delay after releasing mutex to ensure MouseHook thread observes
        // the flag change before processing next real events. This is a timing
        // heuristic — on heavily loaded systems the MouseHook thread may not
        // be scheduled within 500µs, causing potential double-scroll. Acceptable
        // for a first release; a more robust approach would use aCondvar or
        // event-based signaling.
        std::thread::sleep(std::time::Duration::from_micros(500));

        result
    }
}

impl ZoomEmitter for LinuxWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        if units == 0 {
            return Ok(());
        }

        let button = if units > 0 {
            BUTTON_SCROLL_UP
        } else {
            BUTTON_SCROLL_DOWN
        };
        let count = units.unsigned_abs();

        // Check if Ctrl is already pressed by the user (no suppression needed
        // for this read-only query)
        let ctrl_already_pressed = self.emit_with_suppress(false, |d| -> Result<bool> {
            let mut keys: [u8; 32] = [0; 32];
            unsafe { xlib::XQueryKeymap(d, keys.as_mut_ptr() as *mut std::os::raw::c_char); }
            Ok((keys[4] & 0x20) != 0 || (keys[13] & 0x02) != 0)
        })?;

        let ctrl_keycode = self.ctrl_keycode;

        let result = self.emit_with_suppress(true, |d| {
            unsafe {
                if !ctrl_already_pressed && ctrl_keycode > 0 {
                    xtest::XTestFakeKeyEvent(
                        d,
                        ctrl_keycode,
                        xlib::True,
                        xlib::CurrentTime,
                    );
                }

                for _ in 0..count {
                    xtest::XTestFakeButtonEvent(d, button, xlib::True, xlib::CurrentTime);
                    xtest::XTestFakeButtonEvent(d, button, xlib::False, xlib::CurrentTime);
                }

                if !ctrl_already_pressed && ctrl_keycode > 0 {
                    xtest::XTestFakeKeyEvent(
                        d,
                        ctrl_keycode,
                        xlib::False,
                        xlib::CurrentTime,
                    );
                }
            }
            Ok(())
        });

        std::thread::sleep(std::time::Duration::from_micros(500));

        result
    }
}

impl Drop for LinuxWheelEmitter {
    fn drop(&mut self) {
        let SendDisplay(d) = *self.display.lock();
        if !d.is_null() {
            // SAFETY: d is a MutexGuard holding a valid *mut Display from XOpenDisplay.
            // The Mutex prevents concurrent access, and Drop runs exactly once.
            unsafe { display::close_display(d); }
        }
    }
}
