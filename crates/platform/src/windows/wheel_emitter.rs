//! Wheel emitter using `SendInput`. Vertical and horizontal pulses are
//! emitted in the same call when both axes have output (two-input
//! optimisation).

#![cfg(windows)]

use crate::traits::WheelEmitter;
use crate::types::{PlatformError, Result};
use std::mem;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_HWHEEL, MOUSEEVENTF_WHEEL, MOUSEINPUT,
};

pub struct WindowsWheelEmitter;

impl WheelEmitter for WindowsWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }

        let cb = mem::size_of::<INPUT>() as i32;
        let mut buf: [INPUT; 2] = [empty_input(); 2];
        let mut count = 0u32;

        if vertical_units != 0 {
            buf[count as usize] = wheel_input(MOUSEEVENTF_WHEEL, vertical_units);
            count += 1;
        }
        if horizontal_units != 0 {
            buf[count as usize] = wheel_input(MOUSEEVENTF_HWHEEL, horizontal_units);
            count += 1;
        }

        // SAFETY: pointer + count + size all describe the same INPUT array.
        let sent = unsafe { SendInput(count, buf.as_ptr(), cb) };
        if sent != count {
            return Err(PlatformError::Os(format!(
                "SendInput injected {}/{count} events",
                sent
            )));
        }
        Ok(())
    }
}

fn empty_input() -> INPUT {
    // SAFETY: zeroed INPUT is a valid bit pattern (unions use mouse variant
    // selected by `r#type = INPUT_MOUSE`).
    unsafe { mem::zeroed() }
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
