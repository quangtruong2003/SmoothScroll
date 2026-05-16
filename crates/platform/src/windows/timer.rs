//! High-resolution timer guard. Calls `timeBeginPeriod(1)` on construction
//! and `timeEndPeriod(1)` on drop, so `Thread::sleep` is sub-millisecond
//! precise — required for our 120fps engine loop.

#![cfg(windows)]

use windows_sys::Win32::Media::{timeBeginPeriod, timeEndPeriod};

pub struct HighResTimerGuard {
    period_ms: u32,
}

impl HighResTimerGuard {
    pub fn begin(period_ms: u32) -> Self {
        // SAFETY: timeBeginPeriod is FFI-safe; ignore return — failure just
        // means we're stuck with the default ~15ms tick which still works.
        unsafe {
            let _ = timeBeginPeriod(period_ms);
        }
        Self { period_ms }
    }
}

impl Drop for HighResTimerGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = timeEndPeriod(self.period_ms);
        }
    }
}
