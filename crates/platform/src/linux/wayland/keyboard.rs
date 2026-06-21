//! Keyboard modifier state sampling for Wayland.
//!
//! On Wayland, we sample keyboard state by reading from evdev devices
//! or by tracking key events. This is less reliable than X11's
//! XQueryKeymap but works for basic Ctrl/Shift/Alt detection.

use crate::types::ModifierKeys;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
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
                // Try to find a keyboard device
                if let Some(device) = Self::find_keyboard() {
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
            
            if let Ok(device) = evdev::Device::open(path) {
                // Check if it's a keyboard
                if device.has_event_type(evdev::EventType::KEY) {
                    // Look for common keyboard device paths
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
            
            if let Ok(device) = evdev::Device::open(path) {
                if device.has_event_type(evdev::EventType::KEY) {
                    return Some(device);
                }
            }
        }
        
        None
    }
    
    fn sample_loop(device: evdev::Device, state: &Arc<ModifierState>, stop: &Arc<AtomicBool>) {
        let stream = match device.into_event_stream() {
            Ok(s) => s,
            Err(_) => return,
        };
        
        while !stop.load(Ordering::Relaxed) {
            if let Ok(event) = stream.read_event() {
                if let Ok(event) = event {
                    Self::update_modifiers(event, state);
                }
            }
            thread::sleep(POLL_INTERVAL);
        }
    }
    
    fn update_modifiers(event: evdev::InputEvent, state: &Arc<ModifierState>) {
        use evdev::EventKind;
        
        if let EventKind::Key(key) = event.kind() {
            let pressed = event.value() == 1;
            
            match key {
                evdev::Key::KEY_LEFTSHIFT | evdev::Key::KEY_RIGHTSHIFT => {
                    state.shift.store(pressed, Ordering::Relaxed);
                }
                evdev::Key::KEY_LEFTCTRL | evdev::Key::KEY_RIGHTCTRL => {
                    state.ctrl.store(pressed, Ordering::Relaxed);
                }
                evdev::Key::KEY_LEFTALT | evdev::Key::KEY_RIGHTALT
                | evdev::Key::KEY_ALTGR => {
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
