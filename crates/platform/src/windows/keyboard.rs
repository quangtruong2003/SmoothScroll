//! Background-thread modifier-key sampler.
//!
//! Ctrl and Alt are sampled in the background so the hook callback stays
//! cheap. Shift is refreshed at the wheel boundary as well: the first wheel
//! notch after pressing Shift must not wait for the next sampler tick.

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

    /// Read the modifier state used to classify a vertical wheel event.
    ///
    /// The sampler can be up to one poll interval stale. A stale Shift state
    /// is especially visible because it routes the first Shift+Wheel notch to
    /// the vertical axis. Refresh only Shift at this boundary; Ctrl/Alt keep
    /// their sampled values and therefore do not add more work to the common
    /// modifier path.
    pub fn snapshot_for_wheel(&self) -> ModifierKeys {
        refresh_shift(self.snapshot(), is_shift_down())
    }
}

fn is_shift_down() -> bool {
    unsafe { (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0 }
}

fn refresh_shift(mut modifiers: ModifierKeys, shift_down: bool) -> ModifierKeys {
    modifiers.shift = shift_down;
    modifiers
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wheel_snapshot_uses_current_shift_without_changing_other_modifiers() {
        let sampled = ModifierKeys {
            shift: false,
            ctrl: true,
            alt: true,
            cmd: false,
        };
        let refreshed = refresh_shift(sampled, true);

        assert!(refreshed.shift);
        assert_eq!(refreshed.ctrl, sampled.ctrl);
        assert_eq!(refreshed.alt, sampled.alt);
        assert_eq!(refreshed.cmd, sampled.cmd);
    }
}
