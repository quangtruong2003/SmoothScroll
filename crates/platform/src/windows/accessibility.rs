//! Windows accessibility signal access via `SystemParametersInfoW`.
//!
//! Note: `SPI_GETCLIENTAREAANIMATION` returns the inverse of "Reduce Motion".
//! Animation enabled => Reduce Motion OFF.

#![cfg(windows)]

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SystemParametersInfoW, SPI_GETCLIENTAREAANIMATION,
};

pub struct WindowsAccessibilitySignals;

fn query_animations_enabled() -> bool {
    let mut value: i32 = 1; // default to "animations enabled" if query fails
    unsafe {
        // SAFETY: SPI_GETCLIENTAREAANIMATION reads a BOOL into the supplied
        // pointer; we provide a properly aligned i32 (= 4-byte BOOL) and
        // ignore the success boolean — failure leaves `value` at its
        // default of 1 (animations enabled, RM off).
        let _ = SystemParametersInfoW(
            SPI_GETCLIENTAREAANIMATION,
            0,
            &mut value as *mut _ as *mut _,
            0,
        );
    }
    value != 0
}

impl AccessibilitySignals for WindowsAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        // Reduce Motion ON when animations are disabled.
        !query_animations_enabled()
    }

    fn watch(
        &self,
        on_change: Box<dyn Fn(bool) + Send + Sync>,
    ) -> Result<HookHandle> {
        // 1 Hz polling thread. One syscall/sec is acceptable and avoids
        // wiring WM_SETTINGCHANGE into the message loop.
        let stop = Arc::new(AtomicBool::new(false));
        let stop_clone = stop.clone();
        let last = Arc::new(AtomicBool::new(!query_animations_enabled()));
        let last_clone = last.clone();
        std::thread::Builder::new()
            .name("smoothscroll-rm-watch".into())
            .spawn(move || {
                while !stop_clone.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    let cur = !query_animations_enabled();
                    let prev = last_clone.swap(cur, Ordering::Relaxed);
                    if cur != prev {
                        on_change(cur);
                    }
                }
            })
            .map_err(|e| PlatformError::Os(e.to_string()))?;

        struct Guard(Arc<AtomicBool>);
        impl Drop for Guard {
            fn drop(&mut self) {
                self.0.store(true, Ordering::Relaxed);
            }
        }
        Ok(HookHandle::new(Box::new(Guard(stop))))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_does_not_panic() {
        let signals = WindowsAccessibilitySignals;
        let _ = signals.reduce_motion_enabled();
    }
}
