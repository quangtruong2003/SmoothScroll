//! Windows accessibility signals.
//!
//! Windows lacks a "Reduce Motion" signal that's specific to motion
//! sensitivity. The closest API is `SPI_GETCLIENTAREAANIMATION`, but it
//! covers menu/list/window animations and is commonly disabled by users
//! for performance reasons unrelated to motion sensitivity. Reading it
//! caused users who had animations off to lose smooth scrolling entirely
//! (engine flushed all pixels in one frame).
//!
//! Decision: report `false` unconditionally on Windows. Users who want
//! instant scroll can set `RespectReduceMotion::Always` explicitly.
//! macOS keeps the OS signal because `accessibilityDisplayShouldReduceMotion`
//! is a dedicated motion-sensitivity preference.

#![cfg(windows)]

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::Result;

pub struct WindowsAccessibilitySignals;

impl AccessibilitySignals for WindowsAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        // See module doc: Windows lacks a trustworthy RM signal.
        false
    }

    fn watch(&self, _on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        // No-op: the signal we report is constant `false`, so it never
        // changes and the callback would never fire. Returning an empty
        // handle keeps the trait contract intact and avoids spawning a
        // pointless polling thread.
        Ok(HookHandle::new(Box::new(())))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn always_reports_false() {
        let signals = WindowsAccessibilitySignals;
        assert!(!signals.reduce_motion_enabled());
    }
}
