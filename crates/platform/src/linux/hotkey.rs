//! Global hotkey via XGrabKey on root window.

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use x11::xlib;

use super::display;

const MOD_CONTROL: u32 = xlib::ControlMask;
const MOD_ALT: u32 = xlib::Mod1Mask;
const MOD_SHIFT: u32 = xlib::ShiftMask;
const MOD_SUPER: u32 = xlib::Mod4Mask;

pub struct LinuxHotkey;

impl Hotkey for LinuxHotkey {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        let (modifiers, keysym_name) = parse_accelerator(&accel.raw)?;

        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<()>>(1);
        let alive = Arc::new(AtomicBool::new(true));
        let alive_thread = alive.clone();
        let on_pressed = Arc::new(on_pressed);

        thread::Builder::new()
            .name("ss-hotkey".into())
            .spawn(move || {
                let d = match display::open_display() {
                    Ok(d) => d,
                    Err(e) => {
                        let _ = tx.send(Err(e));
                        return;
                    }
                };
                let root = unsafe { display::root_window(d) };

                let keysym = match display::string_to_keysym(&keysym_name) {
                    Ok(ks) => ks,
                    Err(e) => {
                        let _ = tx.send(Err(e));
                        unsafe { display::close_display(d) };
                        return;
                    }
                };

                let keycode = unsafe { display::keysym_to_keycode(d, keysym) };
                if keycode == 0 {
                    let _ = tx.send(Err(PlatformError::Os(format!(
                        "no keycode for {keysym_name}"
                    ))));
                    unsafe { display::close_display(d) };
                    return;
                }

                let grab_status = unsafe {
                    xlib::XGrabKey(
                        d,
                        keycode as c_int,
                        modifiers,
                        root,
                        xlib::False,
                        xlib::GrabModeAsync,
                        xlib::GrabModeAsync,
                    )
                };
                if grab_status != xlib::Success as i32 {
                    let _ = tx.send(Err(PlatformError::Os(format!(
                        "XGrabKey failed for {keysym_name} (status={grab_status})"
                    ))));
                    unsafe { display::close_display(d) };
                    return;
                }

                let _ = tx.send(Ok(()));

                while alive_thread.load(Ordering::Relaxed) {
                    unsafe {
                        if xlib::XPending(d) > 0 {
                            let mut event: xlib::XEvent = std::mem::zeroed();
                            xlib::XNextEvent(d, &mut event);
                            if event.type_ == xlib::KeyPress {
                                on_pressed();
                            }
                        } else {
                            thread::sleep(std::time::Duration::from_millis(10));
                        }
                    }
                }

                unsafe {
                    xlib::XUngrabKey(d, keycode as c_int, modifiers, root);
                    display::close_display(d);
                }
            })
            .map_err(|e| PlatformError::Os(format!("spawn hotkey thread: {e}")))?;

        rx.recv()
            .map_err(|_| PlatformError::Os("hotkey thread died before grab".into()))??;

        struct Installed {
            alive: Arc<AtomicBool>,
        }
        impl Drop for Installed {
            fn drop(&mut self) {
                self.alive.store(false, Ordering::SeqCst);
            }
        }

        Ok(HotkeyHandle::new(Box::new(Installed { alive })))
    }
}

fn parse_accelerator(raw: &str) -> Result<(u32, String)> {
    let parts: Vec<&str> = raw.split('+').map(|s| s.trim()).collect();
    if parts.is_empty() {
        return Err(PlatformError::Os("empty accelerator".into()));
    }

    let mut mods: u32 = 0;
    let mut key_name = String::new();

    for (i, part) in parts.iter().enumerate() {
        let is_last = i == parts.len() - 1;
        if !is_last {
            match part.to_lowercase().as_str() {
                "ctrl" | "control" => mods |= MOD_CONTROL,
                "alt" => mods |= MOD_ALT,
                "shift" => mods |= MOD_SHIFT,
                "super" => mods |= MOD_SUPER,
                "command" | "commandorcontrol" | "cmdorctrl" => mods |= MOD_CONTROL, // Ctrl on Linux, not Super
                other => return Err(PlatformError::Os(format!("unknown modifier: {other}"))),
            }
        } else {
            key_name = match part.to_lowercase().as_str() {
                "enter" | "return" => "Return".into(),
                "escape" | "esc" => "Escape".into(),
                "space" => "space".into(),
                "tab" => "Tab".into(),
                "delete" | "del" => "Delete".into(),
                "backspace" => "BackSpace".into(),
                s if s.len() == 1 => s.to_uppercase(),
                s => {
                    let upper = s.to_uppercase();
                    if upper.starts_with('F') && upper.len() <= 3 {
                        upper
                    } else {
                        s.to_string()
                    }
                }
            };
        }
    }

    if key_name.is_empty() {
        return Err(PlatformError::Os("no key in accelerator".into()));
    }
    Ok((mods, key_name))
}
