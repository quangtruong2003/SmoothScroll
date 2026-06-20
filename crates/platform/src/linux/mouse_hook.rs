//! Mouse wheel interception via XInput2 raw events.
//!
//! Listens for XI_RawButtonPress (buttons 4-7 for discrete scroll) on the
//! root window.
//!
//! LIMITATION: XInput2 cannot swallow events — original scroll passes through
//! alongside smooth scroll. Documented known limitation.

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{HookDecision, PlatformError, Result};
use parking_lot::Mutex;
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use x11::xlib;

use super::display;

pub struct LinuxMouseHook;

impl LinuxMouseHook {
    pub fn new() -> Result<Self, PlatformError> {
        let d = display::open_display()?;
        let mut major: c_int = 2;
        let mut minor: c_int = 0;
        let available = unsafe {
            x11::xi2::XIQueryVersion(d, &mut major, &mut minor) == xlib::Success as c_int
        };
        unsafe { display::close_display(d) };
        if !available {
            return Err(PlatformError::Os("XInput2 extension not available".into()));
        }
        Ok(Self)
    }
}

impl MouseHook for LinuxMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let alive = Arc::new(AtomicBool::new(true));
        let alive_thread = alive.clone();
        let modifier_sampler = super::keyboard::ModifierSampler::start();
        let modifiers = modifier_sampler.state();

        thread::Builder::new()
            .name("ss-mouse-hook".into())
            .spawn(move || {
                let d = match display::open_display() {
                    Ok(d) => d,
                    Err(e) => {
                        eprintln!("ss-mouse-hook: {e}");
                        return;
                    }
                };
                let root = unsafe { display::root_window(d) };

                // Select XI_RawButtonPress events
                let mut mask = [0u8; 4];
                mask[2] |= 1 << (x11::xi2::XI_RawButtonPress - 16);

                let mut event_mask = x11::xi2::XIEventMask {
                    deviceid: x11::xi2::XIAllMasterDevices,
                    mask_len: mask.len() as c_int,
                    mask: mask.as_mut_ptr(),
                };

                if unsafe { x11::xi2::XISelectEvents(d, root, &mut event_mask, 1) }
                    != xlib::Success as c_int
                {
                    eprintln!("ss-mouse-hook: failed to select XInput2 events");
                    unsafe { display::close_display(d) };
                    return;
                }

                let xi_event_type = unsafe {
                    let mut event_base: c_int = 0;
                    let mut error_base: c_int = 0;
                    let name = std::ffi::CString::new("XInputExtension").unwrap();
                    xlib::XQueryExtension(
                        d,
                        name.as_ptr(),
                        &mut event_base,
                        &mut error_base,
                        &mut error_base,
                    );
                    event_base + xlib::GenericEvent as c_int
                };

                let epoch = std::time::Instant::now();
                let mut classifier_v =
                    Mutex::new(smoothscroll_core::input_source::InputClassifier::new());
                let mut classifier_h =
                    Mutex::new(smoothscroll_core::input_source::InputClassifier::new());

                while alive_thread.load(Ordering::Relaxed) {
                    if unsafe { xlib::XPending(d) } == 0 {
                        thread::sleep(std::time::Duration::from_millis(1));
                        continue;
                    }

                    unsafe {
                        let mut event: xlib::XEvent = std::mem::zeroed();
                        xlib::XNextEvent(d, &mut event);

                        if event.type_ != xi_event_type {
                            continue;
                        }
                        if xlib::XGetEventData(d, &mut event.cookie) == 0 {
                            continue;
                        }

                        let xi_event = event.cookie.data as *mut x11::xi2::XIRawEvent;
                        if xi_event.is_null()
                            || (*xi_event).evtype != x11::xi2::XI_RawButtonPress
                        {
                            xlib::XFreeEventData(d, &mut event.cookie);
                            continue;
                        }

                        let button = (*xi_event).detail;
                        xlib::XFreeEventData(d, &mut event.cookie);

                        // Skip self-injected events from WheelEmitter
                        if super::wheel_emitter::is_suppressed() {
                            continue;
                        }

                        let now_ms = epoch.elapsed().as_millis() as u64;
                        let mods = modifiers.snapshot();

                        match button {
                            4 => {
                                let source = classifier_v.lock().classify(120, now_ms);
                                sink.on_wheel_ext(120, mods, source);
                            }
                            5 => {
                                let source = classifier_v.lock().classify(-120, now_ms);
                                sink.on_wheel_ext(-120, mods, source);
                            }
                            6 => {
                                let source = classifier_h.lock().classify(-120, now_ms);
                                sink.on_hwheel_ext(-120, source);
                            }
                            7 => {
                                let source = classifier_h.lock().classify(120, now_ms);
                                sink.on_hwheel_ext(120, source);
                            }
                            _ => {}
                        }
                    }
                }

                unsafe { display::close_display(d) };
            })
            .map_err(|e| PlatformError::Os(format!("spawn mouse hook: {e}")))?;

        struct Installed {
            alive: Arc<AtomicBool>,
            _modifier_sampler: super::keyboard::ModifierSampler,
        }
        impl Drop for Installed {
            fn drop(&mut self) {
                self.alive.store(false, Ordering::SeqCst);
            }
        }

        Ok(HookHandle::new(Box::new(Installed {
            alive,
            _modifier_sampler: modifier_sampler,
        })))
    }
}
