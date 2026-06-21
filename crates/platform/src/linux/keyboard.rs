//! Background-thread modifier-key sampler using XQueryKeymap.
//!
//! Polls at ~60fps, stores Shift/Ctrl/Alt state in atomics
//! that the mouse hook thread reads cheaply on the hot path.
//! Keycodes are resolved once at startup via XKeysymToKeycode.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use x11::keysym;
use x11::xlib;

use super::display;

const POLL_INTERVAL: Duration = Duration::from_millis(16);

/// Cached keycodes resolved from keysyms at startup.
struct Keycodes {
    shift_l: usize,
    shift_r: usize,
    ctrl_l: usize,
    ctrl_r: usize,
    alt_l: usize,
    alt_r: usize,
}

impl Keycodes {
    /// Resolve all modifier keycodes from the display once.
    ///
    /// # Safety
    /// `display` must be a valid open connection.
    unsafe fn resolve(display: *mut xlib::Display) -> Self {
        Self {
            shift_l: xlib::XKeysymToKeycode(display, keysym::XK_Shift_L) as usize,
            shift_r: xlib::XKeysymToKeycode(display, keysym::XK_Shift_R) as usize,
            ctrl_l: xlib::XKeysymToKeycode(display, keysym::XK_Control_L) as usize,
            ctrl_r: xlib::XKeysymToKeycode(display, keysym::XK_Control_R) as usize,
            alt_l: xlib::XKeysymToKeycode(display, keysym::XK_Alt_L) as usize,
            alt_r: xlib::XKeysymToKeycode(display, keysym::XK_Alt_R) as usize,
        }
    }

    fn is_pressed(&self, keys: &[u8; 32], kc: usize) -> bool {
        kc > 0 && kc / 8 < 32 && (keys[kc / 8] & (1 << (kc % 8))) != 0
    }
}

#[derive(Default)]
pub struct ModifierState {
    pub shift: AtomicBool,
    pub ctrl: AtomicBool,
    pub alt: AtomicBool,
    running: AtomicBool,
}

impl ModifierState {
    pub fn snapshot(&self) -> crate::types::ModifierKeys {
        crate::types::ModifierKeys {
            shift: self.shift.load(Ordering::Relaxed),
            ctrl: self.ctrl.load(Ordering::Relaxed),
            alt: self.alt.load(Ordering::Relaxed),
            cmd: false,
        }
    }
}

pub struct ModifierSampler {
    state: Arc<ModifierState>,
    handle: Option<thread::JoinHandle<()>>,
}

impl ModifierSampler {
    pub fn start() -> Self {
        let state = Arc::new(ModifierState::default());
        state.running.store(true, Ordering::Relaxed);

        // Initial sample with a throwaway display connection
        if let Ok(d) = display::open_display() {
            let keycodes = unsafe { Keycodes::resolve(d) };
            Self::sample_with(d, &state, &keycodes);
            unsafe { display::close_display(d); }
        }

        let s = state.clone();
        let handle = thread::Builder::new()
            .name("ss-modifier-sampler".into())
            .spawn(move || {
                let Ok(display) = display::open_display() else {
                    return;
                };
                // Resolve keycodes once from this thread's display connection
                let keycodes = unsafe { Keycodes::resolve(display) };

                while s.running.load(Ordering::Relaxed) {
                    Self::sample_with(display, &s, &keycodes);
                    thread::sleep(POLL_INTERVAL);
                }
                unsafe {
                    display::close_display(display);
                }
            })
            .expect("spawn modifier sampler thread");

        Self {
            state,
            handle: Some(handle),
        }
    }

    pub fn state(&self) -> Arc<ModifierState> {
        self.state.clone()
    }

    fn sample_with(display: *mut xlib::Display, state: &ModifierState, keycodes: &Keycodes) {
        unsafe {
            let mut keys: [u8; 32] = [0; 32];
            xlib::XQueryKeymap(display, keys.as_mut_ptr());

            let shift = keycodes.is_pressed(&keys, keycodes.shift_l)
                || keycodes.is_pressed(&keys, keycodes.shift_r);
            let ctrl = keycodes.is_pressed(&keys, keycodes.ctrl_l)
                || keycodes.is_pressed(&keys, keycodes.ctrl_r);
            let alt = keycodes.is_pressed(&keys, keycodes.alt_l)
                || keycodes.is_pressed(&keys, keycodes.alt_r);

            state.shift.store(shift, Ordering::Relaxed);
            state.ctrl.store(ctrl, Ordering::Relaxed);
            state.alt.store(alt, Ordering::Relaxed);
        }
    }
}

impl Drop for ModifierSampler {
    fn drop(&mut self) {
        self.state.running.store(false, Ordering::Relaxed);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}
