//! Wheel emitter using `SendInput` for vertical and `PostMessageW` for horizontal.
//! PostMessageW is used for horizontal because apps like Figma/Pencil listen
//! for WM_MOUSEWHEEL with MK_SHIFT flag instead of MOUSEEVENTF_HWHEEL.
//! Zoom events use PostMessageW with MK_CONTROL.

#![cfg(windows)]

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::mem;
use windows_sys::Win32::Foundation::{GetLastError, POINT};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    MOUSEINPUT, SendInput, MOUSEEVENTF_WHEEL,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetAncestor, GetCursorPos, PostMessageW, WindowFromPoint, GA_ROOT, WM_MOUSEWHEEL,
};

const MK_SHIFT: usize = 0x0004;
const MK_CONTROL: usize = 0x0008;

/// Retrieves the target window for PostMessageW injection.
/// Returns (hwnd, screen_x, screen_y) or error.
fn get_target_window() -> Result<(usize, i32, i32)> {
    unsafe {
        let mut pt = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut pt) == 0 {
            return Err(PlatformError::Os("GetCursorPos failed".into()));
        }

        let hwnd = WindowFromPoint(pt);
        if hwnd.is_null() {
            return Err(PlatformError::Os("WindowFromPoint returned null".into()));
        }

        let root = GetAncestor(hwnd, GA_ROOT);
        let target = if !root.is_null() { root } else { hwnd };
        Ok((target as usize, pt.x, pt.y))
    }
}

pub struct WindowsWheelEmitter;

impl WheelEmitter for WindowsWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }

        if vertical_units != 0 {
            emit_vertical(vertical_units)?;
        }
        if horizontal_units != 0 {
            emit_horizontal(horizontal_units)?;
        }
        Ok(())
    }
}

impl ZoomEmitter for WindowsWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        if units == 0 {
            return Ok(());
        }

        // PostMessageW with MK_CONTROL — most compatible with design apps like Figma
        if let Ok((target, x, y)) = get_target_window() {
            unsafe {
                let mouse_data = ((units as u32) << 16) as usize;
                let w_param = MK_CONTROL | mouse_data;
                let l_param = ((y as usize) << 16) | (x as usize & 0xFFFF);
                if PostMessageW(target as _, WM_MOUSEWHEEL, w_param as _, l_param as _) != 0 {
                    return Ok(());
                }
            }
        }

        // Fallback: SendInput sequence — Ctrl down → Wheel → Ctrl up
        emit_zoom_via_send_input(units)
    }
}

fn emit_vertical(units: i32) -> Result<()> {
    let cb = mem::size_of::<INPUT>() as i32;
    let buf = wheel_input(MOUSEEVENTF_WHEEL, units);

    let sent = unsafe { SendInput(1, &buf, cb) };
    if sent != 1 {
        return Err(PlatformError::Os(format!(
            "SendInput injected {}/1 events",
            sent
        )));
    }
    Ok(())
}

fn emit_horizontal(units: i32) -> Result<()> {
    let (target, x, y) = get_target_window()?;

    unsafe {
        let mouse_data = ((units as u32) << 16) as usize;
        let w_param = MK_SHIFT | mouse_data;
        let l_param = ((y as usize) << 16) | (x as usize & 0xFFFF);

        if PostMessageW(target as _, WM_MOUSEWHEEL, w_param as _, l_param as _) == 0 {
            return Err(PlatformError::Os(format!(
                "PostMessageW failed with error {}",
                GetLastError()
            )));
        }
    }
    Ok(())
}

fn wheel_input(flags: u32, mouse_data: i32) -> INPUT {
    INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: mouse_data as u32,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn emit_zoom_via_send_input(units: i32) -> Result<()> {
    // Fallback: Ctrl keydown → Wheel → Ctrl keyup via SendInput.
    // Using KEYEVENTF_UNICODE with scan code for the modifier key to avoid
    // potential VK映射 quirks when the keyboard layout differs.
    unsafe {
        let cb = mem::size_of::<INPUT>() as i32;

        // Ctrl down via Unicode scan (0x1D = left Ctrl in extended scan code)
        let ctrl_down = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: 0,
                    wScan: 0x1D,
                    dwFlags: KEYEVENTF_UNICODE,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };

        // Wheel
        let wheel = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: units as u32,
                    dwFlags: MOUSEEVENTF_WHEEL,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };

        // Ctrl up
        let ctrl_up = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: 0,
                    wScan: 0x1D,
                    dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };

        let inputs = [ctrl_down, wheel, ctrl_up];
        let sent = SendInput(3, inputs.as_ptr(), cb);
        if sent != 3 {
            return Err(PlatformError::Os(format!(
                "SendInput zoom injected {}/3 events",
                sent
            )));
        }
        Ok(())
    }
}
