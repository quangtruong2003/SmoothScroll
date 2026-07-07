#![cfg(target_os = "linux")]
use crate::traits::DisplayQuery;

pub struct LinuxDisplayQuery;

impl DisplayQuery for LinuxDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        60 // stub -- full impl uses XRRConfigCurrentRate
    }
}
