//! Background-thread modifier-key sampler. The hook callback is on a hot
//! path; we don't want to call `GetAsyncKeyState` synchronously there.
//! This polls at ~60fps and exposes atomics the hook reads cheaply.

#![cfg(windows)]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL, VK_MENU, VK_SHIFT,
};

use crate::types::ModifierKeys;

const POLL_INTERVAL: Duration = Duration::from_millis(16);

#[derive(Default)]
pub struct ModifierState {
    pub shift: AtomicBool,
    pub ctrl: AtomicBool,
    pub alt: AtomicBool,
    running: AtomicBool,
}

impl ModifierState {
    pub fn snapshot(&self) -> ModifierKeys {
        ModifierKeys {
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
                while s.running.load(Ordering::Relaxed) {
                    Self::sample_once(&s);
                    thread::sleep(POLL_INTERVAL);
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
        unsafe {
            state.shift.store(
                (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0,
                Ordering::Relaxed,
            );
            state.ctrl.store(
                (GetAsyncKeyState(VK_CONTROL as i32) as u16 & 0x8000) != 0,
                Ordering::Relaxed,
            );
            state.alt.store(
                (GetAsyncKeyState(VK_MENU as i32) as u16 & 0x8000) != 0,
                Ordering::Relaxed,
            );
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
