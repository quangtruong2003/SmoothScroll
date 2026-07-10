#![cfg(target_os = "linux")]

use crate::traits::DisplayQuery;
use super::display;
use x11::xlib;

pub struct LinuxDisplayQuery;

impl LinuxDisplayQuery {
    /// Detect refresh rate using XRR (X RandR extension).
    /// Falls back to 60Hz on error.
    ///
    /// # Safety
    /// Requires open X11 display connection.
    unsafe fn detect_refresh_rate(display: *mut xlib::Display) -> u32 {
        use x11::xrandr;

        // Query XRR version (need 1.3+ for current rate)
        let mut major: i32 = 1;
        let mut minor: i32 = 3;
        if xrandr::XRRQueryVersion(display, &mut major, &mut minor) == 0 {
            return 60;
        }

        // Get root window
        let screen = xlib::XDefaultScreenOfDisplay(display);
        let root = xlib::XRootWindowOfScreen(screen);

        // Get screen resources (XRR 1.3+)
        let resources = xrandr::XRRGetScreenResourcesCurrent(display, root);
        if resources.is_null() {
            return 60;
        }

        // Get current configuration
        let config = xrandr::XRRGetScreenInfo(display, root);
        if config.is_null() {
            xrandr::XRRFreeScreenResources(resources);
            return 60;
        }

        // Get current rate (returns rate * 100, e.g., 5999 for 59.99Hz)
        let rate = xrandr::XRRConfigCurrentRate(config);

        // Cleanup
        xrandr::XRRFreeScreenConfigInfo(config);
        xrandr::XRRFreeScreenResources(resources);

        // Convert from centi-Hz to Hz
        (rate as f64 / 100.0).round() as u32
    }
}

impl DisplayQuery for LinuxDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        unsafe {
            let d = match display::open_display() {
                Ok(d) => d,
                Err(_) => return 60,
            };

            let rate = Self::detect_refresh_rate(d);

            display::close_display(d);

            // Clamp to reasonable range (30-500Hz) and default to 60
            rate.max(30).min(500).max(1)
        }
    }
}
