#![cfg(target_os = "macos")]

use crate::traits::FullscreenDetector;

pub struct MacosFullscreenDetector;

impl FullscreenDetector for MacosFullscreenDetector {
    fn is_foreground_fullscreen(&self) -> bool {
        false
    }
}
