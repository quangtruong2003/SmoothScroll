//! Fullscreen detection via _NET_WM_STATE_FULLSCREEN atom.

use crate::traits::FullscreenDetector;
use std::os::raw::{c_int, c_uchar, c_ulong};
use x11::xlib;

use super::display;

pub struct LinuxFullscreenDetector;

impl FullscreenDetector for LinuxFullscreenDetector {
    fn is_foreground_fullscreen(&self) -> bool {
        unsafe {
            let d = match display::open_display() {
                Ok(d) => d,
                Err(_) => return false,
            };

            let root = display::root_window(d);

            let net_active = {
                let name = b"_NET_ACTIVE_WINDOW\0".as_ptr() as *const i8;
                xlib::XInternAtom(d, name, xlib::False)
            };
            let net_wm_state = {
                let name = b"_NET_WM_STATE\0".as_ptr() as *const i8;
                xlib::XInternAtom(d, name, xlib::False)
            };
            let net_wm_fullscreen = {
                let name = b"_NET_WM_STATE_FULLSCREEN\0".as_ptr() as *const i8;
                xlib::XInternAtom(d, name, xlib::False)
            };

            if net_active == 0 || net_wm_state == 0 || net_wm_fullscreen == 0 {
                display::close_display(d);
                return false;
            }

            // Get active window
            let mut actual_type: xlib::Atom = 0;
            let mut actual_format: c_int = 0;
            let mut n_items: c_ulong = 0;
            let mut bytes_after: c_ulong = 0;
            let mut prop_return: *mut c_uchar = std::ptr::null_mut();

            let status = xlib::XGetWindowProperty(
                d, root, net_active, 0, 1, xlib::False,
                xlib::XA_WINDOW,
                &mut actual_type, &mut actual_format,
                &mut n_items, &mut bytes_after, &mut prop_return,
            );
            if status != xlib::Success as c_int || prop_return.is_null() || n_items == 0 {
                if !prop_return.is_null() { xlib::XFree(prop_return as *mut _); }
                display::close_display(d);
                return false;
            }
            let win = *(prop_return as *const xlib::Window);
            xlib::XFree(prop_return as *mut _);

            if win == 0 {
                display::close_display(d);
                return false;
            }

            // Read _NET_WM_STATE
            let status = xlib::XGetWindowProperty(
                d, win, net_wm_state, 0, 32, xlib::False,
                xlib::XA_ATOM,
                &mut actual_type, &mut actual_format,
                &mut n_items, &mut bytes_after, &mut prop_return,
            );
            if status != xlib::Success as c_int || prop_return.is_null() || n_items == 0 {
                if !prop_return.is_null() { xlib::XFree(prop_return as *mut _); }
                display::close_display(d);
                return false;
            }

            let atoms = std::slice::from_raw_parts(prop_return as *const xlib::Atom, n_items as usize);
            let fullscreen = atoms.contains(&net_wm_fullscreen);
            xlib::XFree(prop_return as *mut _);
            display::close_display(d);
            fullscreen
        }
    }
}
