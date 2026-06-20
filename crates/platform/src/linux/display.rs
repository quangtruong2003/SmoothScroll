//! Shared X11 display connection utilities.
//!
//! Each subsystem opens its own Display connection because X11 connections
//! are NOT thread-safe. Opening per-subsystem connections is the standard
//! approach for X11 apps that need threads.

use crate::types::PlatformError;
use x11::xlib;

/// Open a new X11 display connection.
pub fn open_display() -> Result<*mut xlib::Display, PlatformError> {
    let display = unsafe { xlib::XOpenDisplay(std::ptr::null()) };
    if display.is_null() {
        Err(PlatformError::Os(
            "failed to open X11 display — is DISPLAY set?".into(),
        ))
    } else {
        Ok(display)
    }
}

/// # Safety
/// `display` must be a valid pointer from `XOpenDisplay`.
pub unsafe fn close_display(display: *mut xlib::Display) {
    if !display.is_null() {
        xlib::XCloseDisplay(display);
    }
}

/// # Safety
/// `display` must be a valid, open display connection.
pub unsafe fn root_window(display: *mut xlib::Display) -> xlib::Window {
    xlib::XDefaultRootWindow(display)
}

/// Resolve keysym to keycode at runtime. Returns 0 if not found.
///
/// # Safety
/// `display` must be a valid open display.
pub unsafe fn keysym_to_keycode(display: *mut xlib::Display, keysym: xlib::KeySym) -> u32 {
    xlib::XKeysymToKeycode(display, keysym) as u32
}

/// Resolve a string keysym name to a KeySym.
pub fn string_to_keysym(name: &str) -> Result<xlib::KeySym, PlatformError> {
    let c_name = std::ffi::CString::new(name)
        .map_err(|e| PlatformError::Os(format!("keysym name: {e}")))?;
    let sym = unsafe { xlib::XStringToKeysym(c_name.as_ptr()) };
    if sym == 0 {
        Err(PlatformError::Os(format!("unknown keysym: {name}")))
    } else {
        Ok(sym)
    }
}
