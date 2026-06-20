//! Scroll injection via XTest extension.
//!
//! CRITICAL: XTest events trigger XInput2 raw events, causing feedback loops.
//! We use a static suppression flag — WheelEmitter sets it before injecting,
//! and MouseHook skips events while it's set.
//!
//! Uses a persistent Display connection to avoid per-emit open/close overhead.

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use x11::xlib;
use x11::xtest;

use super::display;

/// Global suppression flag. WheelEmitter sets this before injecting events.
/// MouseHook checks and skips events while this is true.
static SUPPRESSING: AtomicBool = AtomicBool::new(false);

/// Check if the current event should be suppressed (self-injected by WheelEmitter).
pub fn is_suppressed() -> bool {
    SUPPRESSING.load(Ordering::Relaxed)
}

const BUTTON_SCROLL_UP: u32 = 4;
const BUTTON_SCROLL_DOWN: u32 = 5;
const BUTTON_SCROLL_LEFT: u32 = 6;
const BUTTON_SCROLL_RIGHT: u32 = 7;

pub struct LinuxWheelEmitter {
    display: Mutex<*mut xlib::Display>,
    ctrl_keycode: u32,
}

impl LinuxWheelEmitter {
    pub fn new() -> Result<Self, PlatformError> {
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
        let ctrl_keycode = unsafe { display::keysym_to_keycode(d, xlib::XK_Control_L) };

        Ok(Self {
            display: Mutex::new(d),
            ctrl_keycode,
        })
    }

    fn emit_with<F>(&self, f: F) -> Result<()>
    where
        F: FnOnce(*mut xlib::Display) -> Result<()>,
    {
        let d = *self
            .display
            .lock()
            .map_err(|_| PlatformError::Os("display lock poisoned".into()))?;
        let result = f(d);
        unsafe { xlib::XFlush(d); }
        result
    }
}

impl WheelEmitter for LinuxWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }

        // Set suppression flag to prevent feedback loop
        SUPPRESSING.store(true, Ordering::Relaxed);

        let result = self.emit_with(|d| {
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

        // Clear suppression flag
        SUPPRESSING.store(false, Ordering::Relaxed);
        // Brief delay to ensure MouseHook sees the flag change
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

        // Check if Ctrl is already pressed by the user
        let ctrl_already_pressed = self.emit_with(|d| -> Result<bool> {
            let mut keys: [u8; 32] = [0; 32];
            unsafe { xlib::XQueryKeymap(d, keys.as_mut_ptr()); }
            Ok((keys[4] & 0x20) != 0 || (keys[13] & 0x02) != 0)
        })?;

        SUPPRESSING.store(true, Ordering::Relaxed);
        let ctrl_keycode = self.ctrl_keycode;

        let result = self.emit_with(|d| {
            unsafe {
                if !ctrl_already_pressed && ctrl_keycode > 0 {
                    xtest::XTestFakeKeyEvent(
                        d,
                        ctrl_keycode as c_int,
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
                        ctrl_keycode as c_int,
                        xlib::False,
                        xlib::CurrentTime,
                    );
                }
            }
            Ok(())
        });

        SUPPRESSING.store(false, Ordering::Relaxed);
        std::thread::sleep(std::time::Duration::from_micros(500));

        result
    }
}
