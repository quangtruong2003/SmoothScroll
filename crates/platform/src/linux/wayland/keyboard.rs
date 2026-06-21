//! Keyboard modifier state sampling for Wayland.
//!
//! On Wayland, we sample keyboard state by reading from evdev devices
//! or by tracking key events. This is less reliable than X11's
//! XQueryKeymap but works for basic Ctrl/Shift/Alt detection.

use crate::types::ModifierKeys;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

const POLL_INTERVAL: Duration = Duration::from_millis(16); // ~60fps

#[derive(Default)]
pub struct ModifierState {
    pub shift: AtomicBool,
    pub ctrl: AtomicBool,
    pub alt: AtomicBool,
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

pub struct WaylandKeyboardState {
    state: Arc<ModifierState>,
    stop_flag: Arc<AtomicBool>,
}

impl WaylandKeyboardState {
    pub fn start() -> Arc<Self> {
        let state = Arc::new(ModifierState::default());
        let stop_flag = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_flag.clone();
        let state_clone = state.clone();

        thread::Builder::new()
            .name("ss-wayland-keyboard".into())
            .spawn(move || {
                if let Some(mut device) = Self::find_keyboard() {
                    let _ = device.set_nonblocking(true);
                    Self::sample_loop(device, &state_clone, &stop_clone);
                }
            })
            .ok();

        Arc::new(Self { state, stop_flag })
    }

    fn find_keyboard() -> Option<evdev::Device> {
        let entries = std::fs::read_dir("/dev/input").ok()?;

        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;

            if !name.starts_with("event") {
                continue;
            }

            if let Ok(device) = evdev::Device::open(&path) {
                if device.supported_events().contains(evdev::EventType::KEY) {
                    let path_str = path.to_string_lossy();
                    if path_str.contains("kbd") || path_str.contains("keyboard") {
                        return Some(device);
                    }
                }
            }
        }

        // Fallback: use first available keyboard
        for entry in std::fs::read_dir("/dev/input").ok()?.flatten() {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;

            if !name.starts_with("event") {
                continue;
            }

            if let Ok(device) = evdev::Device::open(&path) {
                if device.supported_events().contains(evdev::EventType::KEY) {
                    return Some(device);
                }
            }
        }

        None
    }

    fn sample_loop(mut device: evdev::Device, state: &Arc<ModifierState>, stop: &Arc<AtomicBool>) {
        while !stop.load(Ordering::Relaxed) {
            if let Ok(events) = device.fetch_events() {
                for event in events {
                    Self::update_modifiers(event, state);
                }
            }
            thread::sleep(POLL_INTERVAL);
        }
    }

    fn update_modifiers(event: evdev::InputEvent, state: &Arc<ModifierState>) {
        if let evdev::EventSummary::Key(_ev, key, value) = event.destructure() {
            let pressed = value == 1;

            match key {
                evdev::KeyCode::KEY_LEFTSHIFT | evdev::KeyCode::KEY_RIGHTSHIFT => {
                    state.shift.store(pressed, Ordering::Relaxed);
                }
                evdev::KeyCode::KEY_LEFTCTRL | evdev::KeyCode::KEY_RIGHTCTRL => {
                    state.ctrl.store(pressed, Ordering::Relaxed);
                }
                evdev::KeyCode::KEY_LEFTALT
                | evdev::KeyCode::KEY_RIGHTALT
                | evdev::KeyCode::KEY_COMPOSE => {
                    state.alt.store(pressed, Ordering::Relaxed);
                }
                _ => {}
            }
        }
    }

    pub fn snapshot(&self) -> ModifierKeys {
        self.state.snapshot()
    }
}
