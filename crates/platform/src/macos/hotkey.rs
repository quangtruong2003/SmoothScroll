//! Global hotkey via Carbon RegisterEventHotKey. Carbon is deprecated but
//! still functional through macOS 14+ and is the simplest API for app-wide
//! hotkeys. The handler runs on the main app event loop.

#![cfg(target_os = "macos")]

use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
use std::os::raw::{c_int, c_void};
use std::sync::Arc;

#[allow(non_camel_case_types)]
type EventHotKeyRef = *mut c_void;

#[repr(C)]
struct EventHotKeyID {
    signature: u32,
    id: u32,
}

#[link(name = "Carbon", kind = "framework")]
extern "C" {
    fn RegisterEventHotKey(
        in_hotkey_code: u32,
        in_hotkey_modifiers: u32,
        in_hotkey_id: EventHotKeyID,
        in_target: *const c_void,
        in_options: u32,
        out_ref: *mut EventHotKeyRef,
    ) -> c_int;
    fn UnregisterEventHotKey(in_hotkey: EventHotKeyRef) -> c_int;
    fn GetApplicationEventTarget() -> *const c_void;
    fn InstallEventHandler(
        in_target: *const c_void,
        in_handler: extern "C" fn(*mut c_void, *mut c_void, *mut c_void) -> c_int,
        in_num_types: u32,
        in_types: *const EventTypeSpec,
        in_user_data: *mut c_void,
        out_handler: *mut *mut c_void,
    ) -> c_int;
    fn GetEventClass(event: *mut c_void) -> u32;
    fn GetEventKind(event: *mut c_void) -> u32;
    fn GetEventParameter(
        event: *mut c_void,
        in_name: u32,
        in_desired_type: u32,
        out_actual_type: *mut u32,
        in_buffer_size: u32,
        out_actual_size: *mut u32,
        out_buffer: *mut c_void,
    ) -> c_int;
}

#[repr(C)]
struct EventTypeSpec {
    event_class: u32,
    event_kind: u32,
}

const K_EVENT_CLASS_KEYBOARD: u32 = 0x6b657962; // 'keyb'
const K_EVENT_HOT_KEY_PRESSED: u32 = 5;
const K_EVENT_PARAM_DIRECT_OBJECT: u32 = 0x2d2d2d2d; // '----'
const TYPE_EVENT_HOT_KEY_ID: u32 = 0x686b6964; // 'hkid'

const CMD_KEY: u32 = 256;
const SHIFT_KEY: u32 = 512;
const OPTION_KEY: u32 = 2048;
const CONTROL_KEY: u32 = 4096;

static mut CALLBACK: Option<Arc<Box<dyn Fn() + Send + Sync>>> = None;

extern "C" fn handler(_next: *mut c_void, event: *mut c_void, _user_data: *mut c_void) -> c_int {
    unsafe {
        if GetEventClass(event) != K_EVENT_CLASS_KEYBOARD {
            return -1;
        }
        if GetEventKind(event) != K_EVENT_HOT_KEY_PRESSED {
            return -1;
        }
        let mut id = EventHotKeyID {
            signature: 0,
            id: 0,
        };
        let mut actual: u32 = 0;
        if GetEventParameter(
            event,
            K_EVENT_PARAM_DIRECT_OBJECT,
            TYPE_EVENT_HOT_KEY_ID,
            std::ptr::null_mut(),
            std::mem::size_of::<EventHotKeyID>() as u32,
            &mut actual,
            &mut id as *mut _ as *mut c_void,
        ) != 0
        {
            return -1;
        }
        if let Some(cb) = CALLBACK.as_ref() {
            cb();
        }
    }
    0
}

pub struct MacosHotkey;

impl Hotkey for MacosHotkey {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        let (mods, vk) = parse_accelerator(&accel.raw)?;
        unsafe {
            CALLBACK = Some(Arc::new(on_pressed));

            let target = GetApplicationEventTarget();
            let spec = EventTypeSpec {
                event_class: K_EVENT_CLASS_KEYBOARD,
                event_kind: K_EVENT_HOT_KEY_PRESSED,
            };
            let mut handler_ref: *mut c_void = std::ptr::null_mut();
            let r = InstallEventHandler(
                target,
                handler,
                1,
                &spec,
                std::ptr::null_mut(),
                &mut handler_ref,
            );
            if r != 0 {
                return Err(PlatformError::Os(format!("InstallEventHandler: {r}")));
            }

            let mut hk_ref: EventHotKeyRef = std::ptr::null_mut();
            let id = EventHotKeyID {
                signature: u32::from_be_bytes(*b"SSCR"),
                id: 1,
            };
            let r = RegisterEventHotKey(vk, mods, id, target, 0, &mut hk_ref);
            if r != 0 {
                return Err(PlatformError::Os(format!("RegisterEventHotKey: {r}")));
            }

            struct Installed {
                hk: EventHotKeyRef,
            }
            impl Drop for Installed {
                fn drop(&mut self) {
                    unsafe {
                        UnregisterEventHotKey(self.hk);
                        CALLBACK = None;
                    }
                }
            }
            unsafe impl Send for Installed {}
            unsafe impl Sync for Installed {}

            Ok(HotkeyHandle {
                _inner: Box::new(Installed { hk: hk_ref }),
            })
        }
    }
}

fn parse_accelerator(raw: &str) -> Result<(u32, u32)> {
    let mut mods = 0u32;
    let mut vk: Option<u32> = None;
    for part in raw.split('+').map(|p| p.trim()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= CONTROL_KEY,
            "alt" | "option" => mods |= OPTION_KEY,
            "shift" => mods |= SHIFT_KEY,
            "cmd" | "command" | "super" | "win" | "commandorcontrol" => mods |= CMD_KEY,
            other => vk = Some(parse_key(other)?),
        }
    }
    let vk = vk.ok_or_else(|| PlatformError::Os(format!("no key in '{raw}'")))?;
    Ok((mods, vk))
}

fn parse_key(s: &str) -> Result<u32> {
    if s.len() == 1 {
        // Carbon virtual key codes for ASCII. Cover common letters used in hotkeys.
        let c = s.chars().next().unwrap().to_ascii_lowercase();
        let code: u32 = match c {
            'a' => 0,
            's' => 1,
            'd' => 2,
            'f' => 3,
            'h' => 4,
            'g' => 5,
            'z' => 6,
            'x' => 7,
            'c' => 8,
            'v' => 9,
            'b' => 11,
            'q' => 12,
            'w' => 13,
            'e' => 14,
            'r' => 15,
            'y' => 16,
            't' => 17,
            'o' => 31,
            'u' => 32,
            'i' => 34,
            'p' => 35,
            'l' => 37,
            'j' => 38,
            'k' => 40,
            'n' => 45,
            'm' => 46,
            _ => return Err(PlatformError::Os(format!("unsupported key '{s}'"))),
        };
        return Ok(code);
    }
    Err(PlatformError::Os(format!("unsupported key '{s}'")))
}
