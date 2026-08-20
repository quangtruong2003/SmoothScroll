//! Wheel emitter using `SendInput` for vertical, horizontal, and zoom.
//! Horizontal pulses use the native Shift+Wheel input stream so Office apps
//! receive the same event as a real Shift-held wheel gesture.
//!
//! Zoom uses SendInput so the event reaches the focused application through
//! the normal Windows input path instead of being posted to a guessed child
//! window.

#![cfg(windows)]

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::mem;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYEVENTF_KEYUP, MOUSEEVENTF_WHEEL, MOUSEINPUT, VK_CONTROL, VK_SHIFT,
};

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

/// What to inject for a horizontal pulse represented by Shift+Wheel.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HorizontalInjection {
    None,
    WheelOnly(i32),
    ShiftWrapped(i32),
}

pub(crate) fn horizontal_injection(units: i32, shift_physically_down: bool) -> HorizontalInjection {
    if units == 0 {
        HorizontalInjection::None
    } else if shift_physically_down {
        HorizontalInjection::WheelOnly(units)
    } else {
        HorizontalInjection::ShiftWrapped(units)
    }
}

/// True while either Shift key is physically down. Runs on the engine thread,
/// never in the `WH_MOUSE_LL` callback.
fn shift_physically_down() -> bool {
    (unsafe { GetAsyncKeyState(VK_SHIFT as i32) } as u16 & 0x8000) != 0
}

fn emit_horizontal(units: i32) -> Result<()> {
    match horizontal_injection(units, shift_physically_down()) {
        HorizontalInjection::None => Ok(()),
        HorizontalInjection::WheelOnly(units) => emit_horizontal_wheel(units),
        HorizontalInjection::ShiftWrapped(units) => emit_horizontal_with_shift(units),
    }
}

fn emit_horizontal_wheel(units: i32) -> Result<()> {
    let cb = mem::size_of::<INPUT>() as i32;
    let buf = wheel_input(MOUSEEVENTF_WHEEL, units);
    let sent = unsafe { SendInput(1, &buf, cb) };
    if sent != 1 {
        return Err(PlatformError::Os(format!(
            "SendInput injected {}/1 horizontal events",
            sent
        )));
    }
    Ok(())
}

fn emit_horizontal_with_shift(units: i32) -> Result<()> {
    let cb = mem::size_of::<INPUT>() as i32;
    let shift = |flags: u32| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VK_SHIFT,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    let inputs = [
        shift(0),
        wheel_input(MOUSEEVENTF_WHEEL, units),
        shift(KEYEVENTF_KEYUP),
    ];
    let sent = unsafe { SendInput(3, inputs.as_ptr(), cb) };
    if sent != 3 {
        return Err(PlatformError::Os(format!(
            "SendInput injected {}/3 horizontal events",
            sent
        )));
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
    fn zero_horizontal_units_inject_nothing() {
        assert_eq!(horizontal_injection(0, true), HorizontalInjection::None);
        assert_eq!(horizontal_injection(0, false), HorizontalInjection::None);
    }

    #[test]
    fn horizontal_scroll_uses_native_wheel_while_shift_is_held() {
        assert_eq!(
            horizontal_injection(120, true),
            HorizontalInjection::WheelOnly(120)
        );
        assert_eq!(
            horizontal_injection(-40, true),
            HorizontalInjection::WheelOnly(-40)
        );
    }

    #[test]
    fn horizontal_inertia_wraps_wheel_with_shift_after_release() {
        assert_eq!(
            horizontal_injection(120, false),
            HorizontalInjection::ShiftWrapped(120)
        );
        assert_eq!(
            horizontal_injection(-40, false),
            HorizontalInjection::ShiftWrapped(-40)
        );
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
