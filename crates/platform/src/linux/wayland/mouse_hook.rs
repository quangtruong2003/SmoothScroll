//! Mouse wheel interception via evdev with exclusive grab.
//!
//! IMPORTANT: This implementation uses GRAB_MODE_EXCLUSIVE which
//! prevents other applications from receiving scroll events. Users must
//! choose SmoothScroll OR other input tools (fusuma, libinput-gestures).
//!
//! The grab captures scroll events before they reach the compositor,
//! allowing SmoothScroll to process and reinject smoothed scroll.

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{PlatformError, Result};
use crate::linux::wayland::{evdev_scanner, wheel_emitter};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use super::keyboard::WaylandKeyboardState;

pub struct WaylandMouseHook {
    device_paths: Vec<std::path::PathBuf>,
    device_names: Vec<String>,
    stop_flag: Arc<AtomicBool>,
}

impl WaylandMouseHook {
    pub fn new() -> Result<Self> {
        let devices = evdev_scanner::find_scroll_devices()?;
        
        let device_paths: Vec<_> = devices.iter().map(|d| d.path.clone()).collect();
        let device_names: Vec<_> = devices.iter().map(|d| d.name.clone()).collect();
        
        Ok(Self {
            device_paths,
            device_names,
            stop_flag: Arc::new(AtomicBool::new(false)),
        })
    }
}

impl MouseHook for WaylandMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let alive = self.stop_flag.clone();
        let sink = Arc::new(sink);
        let device_paths = self.device_paths.clone();
        let device_names = self.device_names.clone();
        
        // Get modifier state sampler
        let keyboard_state = WaylandKeyboardState::start();
        
        thread::Builder::new()
            .name("ss-wayland-wheel-hook".into())
            .spawn(move || {
                // Open and grab devices in the thread
                let mut streams: Vec<_> = Vec::new();
                
                for (path, name) in device_paths.iter().zip(device_names.iter()) {
                    match evdev::Device::open(path) {
                        Ok(device) => {
                            // Grab device to intercept scroll events
                            if let Err(e) = device.grab(evdev::GrabMode::Exclusive) {
                                eprintln!(
                                    "ss-wayland-wheel-hook: failed to grab {}: {e}",
                                    name
                                );
                                continue;
                            }
                            
                            // Get event stream
                            match device.into_event_stream() {
                                Ok(stream) => streams.push(stream),
                                Err(e) => {
                                    eprintln!(
                                        "ss-wayland-wheel-hook: failed to create stream for {}: {e}",
                                        name
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!(
                                "ss-wayland-wheel-hook: failed to open {}: {e}",
                                name
                            );
                        }
                    }
                }
                
                if streams.is_empty() {
                    eprintln!("ss-wayland-wheel-hook: no devices available");
                    return;
                }
                
                // Create classifiers
                let classifier_v = Arc::new(Mutex::new(
                    smoothscroll_core::input_source::InputClassifier::new()
                ));
                let classifier_h = Arc::new(Mutex::new(
                    smoothscroll_core::input_source::InputClassifier::new()
                ));
                
                let epoch = Instant::now();
                
                // Event loop
                while alive.load(Ordering::Relaxed) {
                    for stream in &streams {
                        // read_event blocks, use timeout
                        if let Ok(event) = stream.read_event() {
                            if let Ok(event) = event {
                                Self::process_event(
                                    event,
                                    &classifier_v,
                                    &classifier_h,
                                    &sink,
                                    &keyboard_state,
                                    epoch,
                                );
                            }
                        }
                    }
                    
                    thread::sleep(Duration::from_micros(100));
                }
                
                // Release grabs on exit
                eprintln!("ss-wayland-wheel-hook: shutting down");
            })
            .map_err(|e| PlatformError::Os(format!("spawn mouse hook: {e}")))?;
        
        Ok(HookHandle::new(Box::new(Installed {
            alive: self.stop_flag.clone(),
        })))
    }
}

impl WaylandMouseHook {
    fn process_event(
        event: evdev::InputEvent,
        classifier_v: &Arc<Mutex<smoothscroll_core::input_source::InputClassifier>>,
        classifier_h: &Arc<Mutex<smoothscroll_core::input_source::InputClassifier>>,
        sink: &Arc<dyn HookEventSink>,
        keyboard_state: &WaylandKeyboardState,
        epoch: Instant,
    ) {
        // Skip if we're emitting (feedback loop prevention)
        if wheel_emitter::is_suppressing() {
            return;
        }
        
        use evdev::EventType;
        
        let event_type = event.event_type();
        
        if event_type != EventType::REL_WHEEL 
            && event_type != EventType::REL_HWHEEL 
            && event_type != EventType::REL_WHEEL_HI_RES
            && event_type != EventType::REL_HWHEEL_HI_RES 
        {
            return;
        }
        
        let now_ms = epoch.elapsed().as_millis() as u64;
        let mods = keyboard_state.snapshot();
        
        match event.kind() {
            evdev::EventKind::RelWheel { value } => {
                let source = classifier_v.lock().classify(value, now_ms);
                sink.on_wheel_ext(value, mods, source);
            }
            evdev::EventKind::RelHorizontalWheel { value } => {
                let source = classifier_h.lock().classify(value, now_ms);
                sink.on_hwheel_ext(value, source);
            }
            evdev::EventKind::RelWheelHiRes { value } => {
                // Accumulate hi-res units
                sink.on_wheel_ext(value, mods, smoothscroll_core::input_source::InputSource::HighResWheel);
            }
            evdev::EventKind::RelHorizontalWheelHiRes { value } => {
                sink.on_hwheel_ext(value, smoothscroll_core::input_source::InputSource::HighResWheel);
            }
            _ => {}
        }
    }
}

struct Installed {
    alive: Arc<AtomicBool>,
}

impl Drop for Installed {
    fn drop(&mut self) {
        self.alive.store(false, Ordering::SeqCst);
    }
}
