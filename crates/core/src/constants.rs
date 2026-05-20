//! Engine-wide numeric constants.

pub const WHEEL_DELTA: i32 = 120;
pub const EMIT_UNIT: i32 = 12;
pub const BASE_STEP_PX: f64 = 120.0;
pub const PULSE_CLAMP_MIN: i32 = -40;
pub const PULSE_CLAMP_MAX: i32 = 40;
pub const FRAME_RATE: u32 = 120;
pub const FRAME_MS: f64 = 1000.0 / FRAME_RATE as f64;
pub const SPIN_WAIT_COUNT: u32 = 10;
pub const IDLE_TIMEOUT_MS: i64 = 2000;
