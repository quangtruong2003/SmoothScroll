//! Wheel emitter using `SendInput` for vertical and zoom, and `PostMessageW`
//! for horizontal. PostMessageW is used for horizontal because apps like
//! Figma/Pencil listen for WM_MOUSEWHEEL with MK_SHIFT instead of
//! MOUSEEVENTF_HWHEEL.
//!
//! Zoom uses SendInput rather than PostMessageW: WM_MOUSEWHEEL only bubbles
//! from child to parent, so posting to GA_ROOT never reaches apps whose
//! scroll target is a child window (Word's `_WwG` under `OpusApp`).

#![cfg(windows)]

use super::horizontal_scroll::HorizontalScrollDispatcher;
use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::mem;
use windows_sys::Win32::Foundation::{GetLastError, POINT};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYEVENTF_KEYUP, MOUSEEVENTF_WHEEL, MOUSEINPUT, VK_CONTROL,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, PostMessageW, WindowFromPoint, WM_MOUSEWHEEL,
};

const MK_SHIFT: usize = 0x0004;

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

        Ok((horizontal_post_target(hwnd as usize), pt.x, pt.y))
    }
}

/// Keep the hit-tested child window as the horizontal wheel target.
///
/// `WM_MOUSEWHEEL` propagates from a child to its parents, but a message posted
/// to the root window cannot propagate back down to the child that owns the
/// document or content area.
fn horizontal_post_target(window_under_cursor: usize) -> usize {
    window_under_cursor
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

    fn emit_horizontal_immediate(&self, units: i32) -> Result<()> {
        HorizontalScrollDispatcher::dispatch(units)
    }
}

impl ZoomEmitter for WindowsWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        match zoom_injection(units, ctrl_physically_down()) {
            ZoomInjection::None => Ok(()),
            ZoomInjection::WheelOnly(u) => emit_vertical(u),
            ZoomInjection::CtrlWrapped(u) => emit_zoom_with_ctrl(u),
        }
    }
}

/// True while either Ctrl key is physically down. Runs on the engine thread,
/// never in the `WH_MOUSE_LL` callback.
fn ctrl_physically_down() -> bool {
    // GetAsyncKeyState sets the high bit while the key is held.
    (unsafe { GetAsyncKeyState(VK_CONTROL as i32) } as u16 & 0x8000) != 0
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
                dwExtraInfo: super::SMOOTHSCROLL_INPUT_MARKER,
            },
        },
    }
}

/// What to inject for a drained zoom pulse.
///
/// `emit_zoom` only ever runs because the user physically held Ctrl while
/// scrolling, so in the common case Ctrl is still down and a bare wheel
/// pulse already reads as Ctrl+Wheel to the target app. The inertia tail
/// can outlive the key press, and that case needs a real modifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ZoomInjection {
    None,
    WheelOnly(i32),
    CtrlWrapped(i32),
}

pub(crate) fn zoom_injection(units: i32, ctrl_physically_down: bool) -> ZoomInjection {
    if units == 0 {
        ZoomInjection::None
    } else if ctrl_physically_down {
        ZoomInjection::WheelOnly(units)
    } else {
        ZoomInjection::CtrlWrapped(units)
    }
}

/// Ctrl down → wheel → Ctrl up, as one atomic `SendInput` batch.
///
/// Only used for the inertia tail, after the user has released Ctrl. Uses a
/// real `VK_CONTROL` virtual key — the previous `KEYEVENTF_UNICODE` version
/// sent the character U+001D and never registered as a modifier.
fn emit_zoom_with_ctrl(units: i32) -> Result<()> {
    let cb = mem::size_of::<INPUT>() as i32;

    let ctrl = |flags: u32| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VK_CONTROL,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    let inputs = [
        ctrl(0),
        wheel_input(MOUSEEVENTF_WHEEL, units),
        ctrl(KEYEVENTF_KEYUP),
    ];

    let sent = unsafe { SendInput(3, inputs.as_ptr(), cb) };
    if sent != 3 {
        return Err(PlatformError::Os(format!(
            "SendInput zoom injected {}/3 events",
            sent
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn horizontal_post_targets_window_under_cursor() {
        let child_window = 0x1234usize;

        assert_eq!(horizontal_post_target(child_window), child_window);
    }

    #[test]
    fn zero_units_injects_nothing() {
        assert_eq!(zoom_injection(0, true), ZoomInjection::None);
        assert_eq!(zoom_injection(0, false), ZoomInjection::None);
    }

    #[test]
    fn ctrl_held_sends_bare_wheel_pulse() {
        assert_eq!(zoom_injection(120, true), ZoomInjection::WheelOnly(120));
        assert_eq!(zoom_injection(-40, true), ZoomInjection::WheelOnly(-40));
    }

    #[test]
    fn ctrl_released_wraps_pulse_so_inertia_tail_still_zooms() {
        assert_eq!(zoom_injection(120, false), ZoomInjection::CtrlWrapped(120));
        assert_eq!(zoom_injection(-40, false), ZoomInjection::CtrlWrapped(-40));
    }
}
