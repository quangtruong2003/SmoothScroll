//! Global hotkey registration via CGEventTap.
//!
//! Hotkeys are dispatched through the shared event tap (event_tap.rs). Each
//! registered hotkey stores a (modifiers, keycode) → callback mapping in the
//! global `HOTKEY_REGISTRY`. When kCGEventKeyDown fires, the tap's callback
//! looks up the (flags, keycode) pair and invokes the matching callback.
//!
//! This replaces the deprecated Carbon RegisterEventHotKey API.

#![cfg(target_os = "macos")]

use crate::macos::event_tap::HOTKEY_REGISTRY;
use crate::traits::{Hotkey, HotkeyHandle};
use crate::types::{Accelerator, PlatformError, Result};
use std::sync::Mutex;

// ---------------------------------------------------------------------------
// Modifiers — CGEventFlags bit positions
// CGEventGetFlags() returns: Shift=0x100, Cmd=0x200, Option=0x400, Control=0x800
// ---------------------------------------------------------------------------

const MOD_SHIFT: u32 = 0x00000100;
const MOD_CMD: u32 = 0x00000200;
const MOD_OPTION: u32 = 0x00000400;
const MOD_CONTROL: u32 = 0x00000800;

// ---------------------------------------------------------------------------
// Keycode mapping — macOS virtual keycodes (same as Carbon)
// ---------------------------------------------------------------------------

fn parse_key(s: &str) -> Result<u16> {
    match s.to_ascii_lowercase().as_str() {
        // Function keys
        "f1" => Ok(122), "f2" => Ok(120), "f3" => Ok(99),
        "f4" => Ok(118), "f5" => Ok(96), "f6" => Ok(97),
        "f7" => Ok(98), "f8" => Ok(101), "f9" => Ok(109),
        "f10" => Ok(103), "f11" => Ok(111), "f12" => Ok(111),
        "f13" => Ok(105), "f14" => Ok(107), "f15" => Ok(113),
        "f16" => Ok(106), "f17" => Ok(64), "f18" => Ok(79),
        "f19" => Ok(80), "f20" => Ok(90),

        // Arrow keys
        "up" | "arrowup" => Ok(126),
        "down" | "arrowdown" => Ok(125),
        "left" | "arrowleft" => Ok(123),
        "right" | "arrowright" => Ok(124),

        // Special keys
        "escape" | "esc" => Ok(53),
        "space" => Ok(49),
        "return" | "enter" => Ok(36),
        "tab" => Ok(48),
        "backspace" => Ok(51),
        "delete" => Ok(117),
        "home" => Ok(115),
        "end" => Ok(119),
        "pageup" => Ok(116),
        "pagedown" => Ok(121),

        // ASCII letter/number keys
        s if s.len() == 1 => {
            let c = s.chars().next().unwrap().to_ascii_lowercase();
            let code = match c {
                'a' => 0,  's' => 1,  'd' => 2,  'f' => 3,  'h' => 4,
                'g' => 5,  'z' => 6,  'x' => 7,  'c' => 8,  'v' => 9,
                'b' => 11, 'q' => 12, 'w' => 13, 'e' => 14, 'r' => 15,
                'y' => 16, 't' => 17, '1' => 18, '2' => 19, '3' => 20,
                '4' => 21, '6' => 22, '5' => 23, '=' => 24, '9' => 25,
                '7' => 26, '-' => 27, '8' => 28, '0' => 29, ']' => 30,
                'o' => 31, 'u' => 32, '[' => 33, 'i' => 34, 'p' => 35,
                'l' => 37, 'j' => 38, '\'' => 39, 'k' => 40, ';' => 41,
                '\\' => 42, ',' => 43, '/' => 44, 'n' => 45, 'm' => 46,
                '.' => 47, '`' => 50,
                _ => return Err(PlatformError::Os(format!("unsupported key '{s}'"))),
            };
            Ok(code)
        }

        _ => Err(PlatformError::Os(format!("unsupported key '{s}'"))),
    }
}

/// Parse "Cmd+Shift+S" → (MOD_CMD | MOD_SHIFT, 1)
fn parse_accelerator(raw: &str) -> Result<(u32, u16)> {
    let mut mods = 0u32;
    let mut keycode: Option<u16> = None;

    for part in raw.split('+').map(|p| p.trim()) {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= MOD_CONTROL,
            "alt" | "option" => mods |= MOD_OPTION,
            "shift" => mods |= MOD_SHIFT,
            "cmd" | "command" | "super" | "win" | "commandorcontrol" => mods |= MOD_CMD,
            other => {
                if keycode.is_some() {
                    return Err(PlatformError::Os(format!(
                        "multiple keys in accelerator '{raw}'"
                    )));
                }
                keycode = Some(parse_key(other)?);
            }
        }
    }

    let keycode = keycode.ok_or_else(|| PlatformError::Os(format!("no key in '{raw}'")))?;
    Ok((mods, keycode))
}

// ---------------------------------------------------------------------------
// RAII handle — unregisters on drop
// ---------------------------------------------------------------------------

struct InstalledHotkey {
    modifiers: u32,
    keycode: u16,
}

impl Drop for InstalledHotkey {
    fn drop(&mut self) {
        if let Some(reg) = HOTKEY_REGISTRY.get() {
            let _ = reg.lock().unwrap().unregister(self.modifiers, self.keycode);
        }
    }
}

unsafe impl Send for InstalledHotkey {}
unsafe impl Sync for InstalledHotkey {}

// ---------------------------------------------------------------------------
// MacosHotkey
// ---------------------------------------------------------------------------

pub struct MacosHotkey;

impl MacosHotkey {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MacosHotkey {
    fn default() -> Self {
        Self::new()
    }
}

impl Hotkey for MacosHotkey {
    fn register(
        &self,
        accel: Accelerator,
        on_pressed: Box<dyn Fn() + Send + Sync>,
    ) -> Result<HotkeyHandle> {
        let (mods, keycode) = parse_accelerator(&accel.raw)?;

        let registry = HOTKEY_REGISTRY.get().ok_or_else(|| {
            PlatformError::Os("hotkey registry not initialized — is smooth scroll installed?".into())
        })?;

        let mut reg = registry.lock().unwrap();
        if reg.callbacks.contains_key(&(mods, keycode)) {
            return Err(PlatformError::Os(format!(
                "hotkey '{accel}' already registered"
            )));
        }
        reg.register(mods, keycode, on_pressed);

        Ok(HotkeyHandle::new(Box::new(InstalledHotkey {
            modifiers: mods,
            keycode,
        })))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_key_f12() {
        assert_eq!(parse_key("f12").unwrap(), 111);
        assert_eq!(parse_key("f4").unwrap(), 118);
    }
}
