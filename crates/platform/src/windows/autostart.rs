//! HKCU\Software\Microsoft\Windows\CurrentVersion\Run autostart.
//!
//! Stores the absolute path of the current executable under "SoftScrollNext",
//! quoted so paths containing spaces work.

#![cfg(windows)]

use crate::traits::Autostart;
use crate::types::{PlatformError, Result};
use std::path::PathBuf;
use windows_sys::core::PCWSTR;
use windows_sys::Win32::Foundation::ERROR_SUCCESS;
use windows_sys::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyW, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY, HKEY_CURRENT_USER, KEY_READ, REG_SZ,
};

const APP_NAME: &str = "SoftScrollNext";
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

pub struct WindowsAutostart;

impl Autostart for WindowsAutostart {
    fn is_enabled(&self) -> bool {
        let subkey = wide(RUN_KEY);
        let mut handle: HKEY = std::ptr::null_mut();
        let r = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                subkey.as_ptr() as PCWSTR,
                0,
                KEY_READ,
                &mut handle,
            )
        };
        if r != ERROR_SUCCESS {
            return false;
        }
        let value_name = wide(APP_NAME);
        let mut size: u32 = 0;
        let exists = unsafe {
            RegQueryValueExW(
                handle,
                value_name.as_ptr() as PCWSTR,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut size,
            ) == ERROR_SUCCESS
        };
        unsafe { RegCloseKey(handle) };
        exists
    }

    fn set(&self, enabled: bool) -> Result<()> {
        let subkey = wide(RUN_KEY);
        let mut handle: HKEY = std::ptr::null_mut();
        let r = unsafe { RegCreateKeyW(HKEY_CURRENT_USER, subkey.as_ptr() as PCWSTR, &mut handle) };
        if r != ERROR_SUCCESS {
            return Err(PlatformError::Os(format!("RegCreateKeyW failed: {r}")));
        }

        let value_name = wide(APP_NAME);
        let result = if enabled {
            let exe = current_exe_path()?;
            let quoted = format!("\"{}\"", exe.display());
            let value = wide(&quoted);
            let bytes = value.len().checked_mul(2).unwrap_or(0) as u32;
            let r = unsafe {
                RegSetValueExW(
                    handle,
                    value_name.as_ptr() as PCWSTR,
                    0,
                    REG_SZ,
                    value.as_ptr() as *const u8,
                    bytes,
                )
            };
            if r != ERROR_SUCCESS {
                Err(PlatformError::Os(format!("RegSetValueExW failed: {r}")))
            } else {
                Ok(())
            }
        } else {
            let r = unsafe { RegDeleteValueW(handle, value_name.as_ptr() as PCWSTR) };
            if r != ERROR_SUCCESS && r != 2 {
                Err(PlatformError::Os(format!("RegDeleteValueW failed: {r}")))
            } else {
                Ok(())
            }
        };
        unsafe { RegCloseKey(handle) };
        result
    }
}

fn current_exe_path() -> Result<PathBuf> {
    std::env::current_exe().map_err(|e| PlatformError::Os(format!("current_exe: {e}")))
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}
