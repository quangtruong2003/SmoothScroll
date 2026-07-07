//! Primary display refresh rate detection via Win32 EnumDisplaySettingsW.

#![cfg(windows)]

use crate::traits::DisplayQuery;
use windows_sys::Win32::Graphics::Gdi::{EnumDisplaySettingsW, DEVMODEW, ENUM_CURRENT_SETTINGS};

pub struct WindowsDisplayQuery;

impl DisplayQuery for WindowsDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        unsafe {
            let mut devmode: DEVMODEW = std::mem::zeroed();
            devmode.dmSize = std::mem::size_of::<DEVMODEW>() as u16;
            let ok = EnumDisplaySettingsW(std::ptr::null(), ENUM_CURRENT_SETTINGS, &mut devmode);
            if ok != 0 {
                let freq = devmode.dmDisplayFrequency;
                if freq > 30 && freq < 500 {
                    return freq;
                }
            }
            60
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_query_returns_valid_hz() {
        let q = WindowsDisplayQuery;
        let hz = q.primary_refresh_rate_hz();
        assert!(hz >= 30 && hz <= 500, "invalid refresh rate: {}", hz);
    }
}
