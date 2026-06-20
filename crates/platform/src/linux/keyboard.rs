//! Background-thread modifier-key sampler using XQueryKeymap.
//!
//! Polls at ~60fps, stores Shift/Ctrl/Alt state in atomics
//! that the mouse hook thread reads cheaply on the hot path.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use x11::xlib;

use super::display;

const POLL_INTERVAL: Duration = Duration::from_millis(16);

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
        Self::sample_once(&state);

        let s = state.clone();
        let handle = thread::Builder::new()
            .name("ss-modifier-sampler".into())
            .spawn(move || {
                let Ok(display) = display::open_display() else {
                    return;
                };
                while s.running.load(Ordering::Relaxed) {
                    Self::sample_once_on(display, &s);
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

    fn sample_once(state: &ModifierState) {
        let Ok(display) = display::open_display() else {
            return;
        };
        Self::sample_once_on(display, state);
        unsafe { display::close_display(display); }
    }

    fn sample_once_on(display: *mut xlib::Display, state: &ModifierState) {
        unsafe {
            let mut keys: [u8; 32] = [0; 32];
            xlib::XQueryKeymap(display, keys.as_mut_ptr());

            // Shift_L: keycode 50 → byte 6, bit 2 (0x04)
            // Shift_R: keycode 62 → byte 7, bit 6 (0x40)
            // Control_L: keycode 37 → byte 4, bit 5 (0x20)
            // Control_R: keycode 105 → byte 13, bit 1 (0x02)
            // Alt_L: keycode 64 → byte 8, bit 0 (0x01)
            // Alt_R: keycode 108 → byte 13, bit 4 (0x10)
            let shift = (keys[6] & 0x04) != 0 || (keys[7] & 0x40) != 0;
            let ctrl = (keys[4] & 0x20) != 0 || (keys[13] & 0x02) != 0;
            let alt = (keys[8] & 0x01) != 0 || (keys[13] & 0x10) != 0;

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
