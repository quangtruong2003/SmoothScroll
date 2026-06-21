//! Scroll injection via uinput virtual device.
//!
//! Creates a virtual mouse device that injects scroll events
//! into the kernel input layer. Events are visible to all
//! Wayland compositors.
//!
//! CRITICAL: WheelEmitter sets suppression flag before injecting
//! to prevent feedback loops. MouseHook checks and skips events
//! while suppressed.

use crate::traits::{WheelEmitter, ZoomEmitter};
use crate::types::{PlatformError, Result};
use std::fs::File;
use std::os::unix::io::AsRawFd;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use nix::ioctl_write_int;

static SUPPRESSING: AtomicBool = AtomicBool::new(false);

/// Check if currently suppressing (self-injected events).
pub fn is_suppressing() -> bool {
    SUPPRESSING.load(Ordering::Acquire)
}

// uinput ioctls - defined in linux/uinput.h
ioctl_write_int!(ui_set_evbit, UI_SET_EVBIT, 0);
ioctl_write_int!(ui_set_relbit, UI_SET_RELBIT, 0);
ioctl_write_int!(ui_set_keybit, UI_SET_KEYBIT, 0);
ioctl_write_int!(ui_dev_create, UI_DEV_CREATE, 0);
ioctl_write_int!(ui_dev_destroy, UI_DEV_DESTROY, 0);

pub struct WaylandWheelEmitter {
    fd: File,
}

impl WaylandWheelEmitter {
    pub fn new() -> Result<Self> {
        let fd = std::fs::OpenOptions::new()
            .write(true)
            .open("/dev/uinput")
            .map_err(|e| PlatformError::Os(format!("/dev/uinput: {e}")))?;
        
        let fd_raw = fd.as_raw_fd();
        
        // Setup virtual mouse device
        unsafe {
            // Enable EV_REL event type
            ui_set_evbit(fd_raw, nix::libc::EV_REL as i32)?;
            
            // Enable wheel events
            ui_set_relbit(fd_raw, nix::libc::REL_WHEEL as i32)?;
            ui_set_relbit(fd_raw, nix::libc::REL_HWHEEL as i32)?;
            
            // Enable EV_KEY for Ctrl key (zoom)
            ui_set_evbit(fd_raw, nix::libc::EV_KEY as i32)?;
            ui_set_keybit(fd_raw, nix::libc::KEY_LEFTCTRL as i32)?;
            ui_set_keybit(fd_raw, nix::libc::KEY_RIGHTCTRL as i32)?;
            
            // Create uinput_user_dev structure
            let mut uidev: nix::libc::uinput_user_dev = std::mem::zeroed();
            
            // Set device name
            let name = b"SmoothScroll\0";
            for (i, &byte) in name.iter().take(80).enumerate() {
                uidev.name[i] = byte as i8;
            }
            
            // Set device ID (USB bus type)
            uidev.id.bustype = nix::libc::BUS_USB as u16;
            uidev.id.vendor = 0x1234;
            uidev.id.product = 0x5678;
            
            // Write device config to uinput
            let ret = nix::libc::write(
                fd_raw,
                &uidev as *const _ as *const _,
                std::mem::size_of::<nix::libc::uinput_user_dev>()
            );
            if ret < 0 {
                return Err(PlatformError::Os(format!(
                    "write uinput_user_dev: {}",
                    nix::errno::errno()
                )));
            }
            
            // Create device
            ui_dev_create(fd_raw)?;
        }
        
        Ok(Self { fd })
    }
    
    fn inject_wheel(&self, fd: std::os::raw::c_int, event: u32, value: i32) -> Result<()> {
        let ev = nix::libc::input_event {
            time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
            type_: nix::libc::EV_REL as u16,
            code: event,
            value,
        };
        
        unsafe {
            let ret = nix::libc::write(fd, &ev as *const _ as *const _, std::mem::size_of_val(&ev));
            if ret < 0 {
                return Err(PlatformError::Os(format!(
                    "write wheel: {}",
                    nix::errno::errno()
                )));
            }
            
            // Send SYN_REPORT
            let syn = nix::libc::input_event {
                time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
                type_: nix::libc::EV_SYN as u16,
                code: 0,
                value: 0,
            };
            let ret = nix::libc::write(fd, &syn as *const _ as *const _, std::mem::size_of_val(&syn));
            if ret < 0 {
                return Err(PlatformError::Os(format!(
                    "write syn: {}",
                    nix::errno::errno()
                )));
            }
        }
        
        Ok(())
    }
    
    fn inject_key(&self, fd: std::os::raw::c_int, key: u32, value: i32) -> Result<()> {
        let ev = nix::libc::input_event {
            time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
            type_: nix::libc::EV_KEY as u16,
            code: key,
            value,
        };
        
        unsafe {
            let ret = nix::libc::write(fd, &ev as *const _ as *const _, std::mem::size_of_val(&ev));
            if ret < 0 {
                return Err(PlatformError::Os(format!(
                    "write key: {}",
                    nix::errno::errno()
                )));
            }
            
            // SYN_REPORT
            let syn = nix::libc::input_event {
                time: nix::libc::timeval { tv_sec: 0, tv_usec: 0 },
                type_: nix::libc::EV_SYN as u16,
                code: 0,
                value: 0,
            };
            let _ = nix::libc::write(fd, &syn as *const _ as *const _, std::mem::size_of_val(&syn));
        }
        
        Ok(())
    }
}

impl WheelEmitter for WaylandWheelEmitter {
    fn emit(&self, vertical_units: i32, horizontal_units: i32) -> Result<()> {
        if vertical_units == 0 && horizontal_units == 0 {
            return Ok(());
        }
        
        SUPPRESSING.store(true, Ordering::Release);
        let fd = self.fd.as_raw_fd();
        
        // Emit Ctrl keydown if zooming (large units)
        if vertical_units.abs() > 5 {
            self.inject_key(fd, nix::libc::KEY_LEFTCTRL, 1)?;
        }
        
        // Emit wheel events
        if vertical_units != 0 {
            for _ in 0..vertical_units.unsigned_abs() {
                self.inject_wheel(fd, nix::libc::REL_WHEEL, vertical_units.signum())?;
            }
        }
        
        if horizontal_units != 0 {
            for _ in 0..horizontal_units.unsigned_abs() {
                self.inject_wheel(fd, nix::libc::REL_HWHEEL, horizontal_units.signum())?;
            }
        }
        
        // Release Ctrl
        if vertical_units.abs() > 5 {
            self.inject_key(fd, nix::libc::KEY_LEFTCTRL, 0)?;
        }
        
        // Brief delay to allow hook to observe suppression
        std::thread::sleep(Duration::from_micros(500));
        SUPPRESSING.store(false, Ordering::Release);
        
        Ok(())
    }
}

impl ZoomEmitter for WaylandWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        if units == 0 {
            return Ok(());
        }
        
        SUPPRESSING.store(true, Ordering::Release);
        let fd = self.fd.as_raw_fd();
        
        // Emit Ctrl keydown
        self.inject_key(fd, nix::libc::KEY_LEFTCTRL, 1)?;
        
        // Emit wheel events
        for _ in 0..units.unsigned_abs() {
            self.inject_wheel(fd, nix::libc::REL_WHEEL, units.signum())?;
        }
        
        // Release Ctrl
        self.inject_key(fd, nix::libc::KEY_LEFTCTRL, 0)?;
        
        // Brief delay to allow hook to observe suppression
        std::thread::sleep(Duration::from_micros(500));
        SUPPRESSING.store(false, Ordering::Release);
        
        Ok(())
    }
}

impl Drop for WaylandWheelEmitter {
    fn drop(&mut self) {
        unsafe {
            let _ = ui_dev_destroy(self.fd.as_raw_fd());
        }
    }
}
