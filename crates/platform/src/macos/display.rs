#![cfg(target_os = "macos")]
use crate::traits::DisplayQuery;

pub struct MacosDisplayQuery;

impl DisplayQuery for MacosDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        60 // stub -- macOS impl pending
    }
}
