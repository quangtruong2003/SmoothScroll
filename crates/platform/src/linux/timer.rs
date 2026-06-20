//! Linux high-resolution timer guard — no-op.
//! Linux clock_nanosleep already provides ~1ms precision.

pub struct LinuxHighResTimerGuard;

impl LinuxHighResTimerGuard {
    pub fn begin(_period_ms: u32) -> Self {
        Self
    }
}
