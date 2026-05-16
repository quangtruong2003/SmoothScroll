//! Smooth scroll engine. Ported from `SmoothScrollEngine.cs`.
//!
//! **Threading:** the engine is *not* thread-safe internally. The caller
//! (the app crate) wraps it in `parking_lot::Mutex<SmoothScrollEngine>`.

use crate::constants::{BASE_STEP_PX, EMIT_UNIT, PULSE_CLAMP_MAX, PULSE_CLAMP_MIN, WHEEL_DELTA};
use crate::easing::compute_easing_fraction;
use crate::settings::AppSettings;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct EngineOutput {
    pub vertical: i32,
    pub horizontal: i32,
}

#[derive(Debug, Default, Clone, Copy)]
struct Axis {
    remaining_px: f64,
    last_notch_ms: u64,
    accel_factor: i32,
    unit_accum: f64,
}

impl Axis {
    fn register_notch(&mut self, now_ms: u64, delta: i32, settings: &AppSettings) {
        let elapsed = now_ms.saturating_sub(self.last_notch_ms);
        if (elapsed as i64) <= settings.acceleration_delta_ms as i64 {
            self.accel_factor = (self.accel_factor + 1)
                .clamp(1, settings.acceleration_max)
                .max(1);
        } else {
            self.accel_factor = 1;
        }
        self.last_notch_ms = now_ms;

        let notches = delta as f64 / WHEEL_DELTA as f64;
        let pixels = notches * settings.step_size_px as f64 * self.accel_factor as f64;
        self.remaining_px += pixels;
    }

    fn step(&mut self, dt_ms: f64, settings: &AppSettings) -> i32 {
        if self.remaining_px.abs() < 0.1 {
            self.remaining_px = 0.0;
            self.unit_accum = 0.0;
            return 0;
        }

        let duration = (settings.animation_time_ms as f64).max(1.0);
        let frac = compute_easing_fraction(
            dt_ms,
            duration,
            settings.easing_mode,
            settings.tail_to_head_ratio as f64,
            settings.animation_easing,
        );

        let emit_px = self.remaining_px * frac;
        self.remaining_px -= emit_px;

        let wheel_units = (emit_px / BASE_STEP_PX) * WHEEL_DELTA as f64;
        let units = wheel_units / EMIT_UNIT as f64;
        self.unit_accum += units;

        let mut pulses = 0;
        if self.unit_accum.abs() >= 1.0 {
            pulses = self.unit_accum.trunc() as i32;
            self.unit_accum -= pulses as f64;
        }
        if pulses == 0 {
            return 0;
        }
        pulses = pulses.clamp(PULSE_CLAMP_MIN, PULSE_CLAMP_MAX);
        pulses * EMIT_UNIT
    }
}

#[derive(Debug)]
pub struct SmoothScrollEngine {
    settings: AppSettings,
    v: Axis,
    h: Axis,
}

impl SmoothScrollEngine {
    pub fn new(settings: AppSettings) -> Self {
        Self {
            settings,
            v: Axis::default(),
            h: Axis::default(),
        }
    }

    pub fn apply_settings(&mut self, settings: AppSettings) {
        self.settings = settings;
    }

    pub fn settings(&self) -> &AppSettings {
        &self.settings
    }

    pub fn on_wheel(&mut self, delta: i32, now_ms: u64) {
        let dir = if self.settings.reverse_wheel_direction {
            -1
        } else {
            1
        };
        self.v.register_notch(now_ms, delta * dir, &self.settings);
    }

    pub fn on_hwheel(&mut self, delta: i32, now_ms: u64) {
        let dir = if self.settings.reverse_wheel_direction {
            -1
        } else {
            1
        };
        self.h.register_notch(now_ms, delta * dir, &self.settings);
    }

    pub fn step(&mut self, dt_ms: f64) -> EngineOutput {
        let v = self.v.step(dt_ms, &self.settings);
        let h = if self.settings.horizontal_smoothness {
            self.h.step(dt_ms, &self.settings)
        } else {
            0
        };
        EngineOutput {
            vertical: v,
            horizontal: h,
        }
    }

    pub fn has_pending_work(&self) -> bool {
        self.v.remaining_px.abs() >= 0.1 || self.h.remaining_px.abs() >= 0.1
    }
}
