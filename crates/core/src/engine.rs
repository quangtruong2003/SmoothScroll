//! Smooth scroll engine.
//!
//! **Threading:** the engine is *not* thread-safe internally. The caller
//! (the app crate) wraps it in `parking_lot::Mutex<SmoothScrollEngine>`.
//!
//! **Statelessness w.r.t. settings:** the engine owns only the rolling
//! per-axis state (`remaining_px`, `accel_factor`, etc.). Settings are
//! passed by reference into every hot-path call so the caller can swap
//! them atomically without locking the engine.

use crate::constants::{BASE_STEP_PX, EMIT_UNIT, PULSE_CLAMP_MAX, PULSE_CLAMP_MIN, WHEEL_DELTA};
use crate::easing::compute_easing_fraction;
use crate::settings::EffectiveSettings;

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
    fn flush_instant(&mut self) -> i32 {
        if self.remaining_px.abs() < 0.1 {
            self.remaining_px = 0.0;
            self.unit_accum = 0.0;
            return 0;
        }
        let wheel_units = (self.remaining_px / BASE_STEP_PX) * WHEEL_DELTA as f64;
        let units = wheel_units / EMIT_UNIT as f64;
        self.unit_accum += units;
        let pulses = self.unit_accum.trunc() as i32;
        self.unit_accum -= pulses as f64;
        self.remaining_px = 0.0;
        // NOTE: instant-mode pulse clamp drops anything beyond PULSE_CLAMP_MAX.
        // Intentional: instant means "no carry-over" — flushing in one frame is
        // the contract, even if it caps very large pending momentum.
        pulses.clamp(PULSE_CLAMP_MIN, PULSE_CLAMP_MAX) * EMIT_UNIT
    }

    fn register_notch(&mut self, now_ms: u64, delta: i32, settings: &EffectiveSettings) {
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

    fn register_pixels(&mut self, px: f64, now_ms: u64, multiplier: f64) {
        self.last_notch_ms = now_ms;
        self.accel_factor = 1;
        self.remaining_px += px * multiplier;
    }

    fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> i32 {
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
    v: Axis,
    h: Axis,
}

impl SmoothScrollEngine {
    pub fn new() -> Self {
        Self {
            v: Axis::default(),
            h: Axis::default(),
        }
    }

    pub fn on_wheel_with_source(
        &mut self,
        delta: i32,
        now_ms: u64,
        source: crate::input_source::InputSource,
        settings: &EffectiveSettings,
    ) {
        use crate::input_source::InputSource;
        let dir = if settings.reverse_wheel_direction {
            -1
        } else {
            1
        };
        match source {
            InputSource::Wheel | InputSource::HighResWheel => {
                self.v.register_notch(now_ms, delta * dir, settings);
            }
            InputSource::Touchpad => {
                if !settings.touchpad_smoothing_enabled {
                    self.v.register_notch(now_ms, delta * dir, settings);
                    return;
                }
                let px = (delta as f64 / WHEEL_DELTA as f64) * BASE_STEP_PX * dir as f64;
                self.v
                    .register_pixels(px, now_ms, settings.touchpad_pixel_multiplier);
            }
        }
    }

    pub fn on_hwheel_with_source(
        &mut self,
        delta: i32,
        now_ms: u64,
        source: crate::input_source::InputSource,
        settings: &EffectiveSettings,
    ) {
        use crate::input_source::InputSource;
        let dir = if settings.reverse_wheel_direction {
            -1
        } else {
            1
        };
        match source {
            InputSource::Wheel | InputSource::HighResWheel => {
                self.h.register_notch(now_ms, delta * dir, settings);
            }
            InputSource::Touchpad => {
                if !settings.touchpad_smoothing_enabled {
                    self.h.register_notch(now_ms, delta * dir, settings);
                    return;
                }
                let px = (delta as f64 / WHEEL_DELTA as f64) * BASE_STEP_PX * dir as f64;
                self.h
                    .register_pixels(px, now_ms, settings.touchpad_pixel_multiplier);
            }
        }
    }

    pub fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> EngineOutput {
        if settings.instant_mode {
            let v = self.v.flush_instant();
            let h = if settings.horizontal_smoothness {
                self.h.flush_instant()
            } else {
                0
            };
            return EngineOutput {
                vertical: v,
                horizontal: h,
            };
        }
        let v = self.v.step(dt_ms, settings);
        let h = if settings.horizontal_smoothness {
            self.h.step(dt_ms, settings)
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

    /// Discard any pending pixels and unit accumulator on both axes. Used by
    /// the modifier-passthrough hot path to clear inertia the moment a
    /// precision modifier (Ctrl/Alt) is pressed, so zoom feels immediate.
    pub fn reset_axes(&mut self) {
        self.v.remaining_px = 0.0;
        self.v.unit_accum = 0.0;
        self.h.remaining_px = 0.0;
        self.h.unit_accum = 0.0;
    }
}

impl Default for SmoothScrollEngine {
    fn default() -> Self {
        Self::new()
    }
}
