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
use crate::easing::{compute_easing_fraction, EasingMode};
use crate::settings::EffectiveSettings;
use std::collections::VecDeque;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct EngineOutput {
    pub vertical: i32,
    pub horizontal: i32,
    pub zoom: i32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct EasingSnapshot {
    animation_time_ms: i32,
    easing_mode: EasingMode,
    tail_to_head_ratio: i32,
    animation_easing: bool,
}

impl From<&EffectiveSettings> for EasingSnapshot {
    fn from(settings: &EffectiveSettings) -> Self {
        Self {
            animation_time_ms: settings.animation_time_ms,
            easing_mode: settings.easing_mode,
            tail_to_head_ratio: settings.tail_to_head_ratio,
            animation_easing: settings.animation_easing,
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct PendingBatch {
    remaining_px: f64,
    easing: EasingSnapshot,
}

#[derive(Debug, Default, Clone)]
struct Axis {
    pending: VecDeque<PendingBatch>,
    last_notch_ms: u64,
    pub(crate) velocity: f64,
    unit_accum: f64,
}

// ZoomAxis is identical to Axis — same accumulation, easing, step logic.
// Only difference is output routing (zoom channel vs scroll).
type ZoomAxis = Axis;

impl Axis {
    fn flush_instant(&mut self) -> i32 {
        let remaining_px: f64 = self.pending.iter().map(|batch| batch.remaining_px).sum();
        self.pending.clear();
        if remaining_px.abs() < 0.1 {
            self.unit_accum = 0.0;
            return 0;
        }
        let wheel_units = (remaining_px / BASE_STEP_PX) * WHEEL_DELTA as f64;
        let units = wheel_units / EMIT_UNIT as f64;
        self.unit_accum += units;
        let pulses = self.unit_accum.trunc() as i32;
        self.unit_accum -= pulses as f64;
        // NOTE: instant-mode pulse clamp drops anything beyond PULSE_CLAMP_MAX.
        // Intentional: instant means "no carry-over" — flushing in one frame is
        // the contract, even if it caps very large pending momentum.
        pulses.clamp(PULSE_CLAMP_MIN, PULSE_CLAMP_MAX) * EMIT_UNIT
    }

    fn add_pending(&mut self, pixels: f64, easing: EasingSnapshot) {
        if pixels.abs() < f64::EPSILON {
            return;
        }
        if let Some(last) = self.pending.back_mut() {
            if last.easing == easing {
                last.remaining_px += pixels;
                return;
            }
        }
        self.pending.push_back(PendingBatch {
            remaining_px: pixels,
            easing,
        });
    }

    fn register_notch(&mut self, now_ms: u64, delta: i32, settings: &EffectiveSettings) {
        self.register_notch_with_easing(now_ms, delta, settings, settings.into());
    }

    fn register_notch_with_easing(
        &mut self,
        now_ms: u64,
        delta: i32,
        settings: &EffectiveSettings,
        easing: EasingSnapshot,
    ) {
        let notches = delta as f64 / WHEEL_DELTA as f64;

        // Compute instantaneous velocity from inter-notch interval
        let instant_velocity = if self.last_notch_ms > 0 {
            let dt = (now_ms - self.last_notch_ms) as f64;
            if dt > 0.0 && dt < 500.0 {
                1000.0 / dt
            } else {
                0.0
            }
        } else {
            0.0
        };

        // Exponential moving average (alpha=0.3)
        const ALPHA: f64 = 0.3;
        self.velocity = ALPHA * instant_velocity + (1.0 - ALPHA) * self.velocity;
        self.last_notch_ms = now_ms;

        // Compute acceleration factor from velocity (quadratic curve)
        let velocity_ratio = (self.velocity / settings.max_velocity).min(1.0);
        let accel_factor =
            1.0 + velocity_ratio * velocity_ratio * (settings.acceleration_max as f64 - 1.0);

        let pixels = notches * settings.step_size_px as f64 * accel_factor;
        self.add_pending(pixels, easing);
    }

    fn register_pixels(
        &mut self,
        px: f64,
        now_ms: u64,
        multiplier: f64,
        settings: &EffectiveSettings,
    ) {
        self.register_pixels_with_easing(px, now_ms, multiplier, settings.into());
    }

    fn register_pixels_with_easing(
        &mut self,
        px: f64,
        now_ms: u64,
        multiplier: f64,
        easing: EasingSnapshot,
    ) {
        self.last_notch_ms = now_ms;
        self.velocity = 0.0;
        self.add_pending(px * multiplier, easing);
    }

    fn step(&mut self, dt_ms: f64) -> i32 {
        // Decay velocity when no new notches (half-life ~200ms)
        const DECAY_HALF_LIFE_MS: f64 = 200.0;
        let decay = (-0.693 * dt_ms / DECAY_HALF_LIFE_MS).exp();
        self.velocity *= decay;
        if self.velocity < 0.1 {
            self.velocity = 0.0;
        }

        let mut emitted_px = 0.0;
        for batch in &mut self.pending {
            let snapshot = batch.easing;
            let (duration, mode, ratio, enabled) = (
                snapshot.animation_time_ms,
                snapshot.easing_mode,
                snapshot.tail_to_head_ratio,
                snapshot.animation_easing,
            );
            let frac = compute_easing_fraction(
                dt_ms,
                (duration as f64).max(1.0),
                mode,
                ratio as f64,
                enabled,
            );
            let emit_px = batch.remaining_px * frac;
            batch.remaining_px -= emit_px;
            emitted_px += emit_px;
        }
        self.pending.retain(|batch| batch.remaining_px.abs() >= 0.1);
        if self.pending.is_empty() {
            self.unit_accum = 0.0;
        }

        let wheel_units = (emitted_px / BASE_STEP_PX) * WHEEL_DELTA as f64;
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
    z: ZoomAxis,
}

impl SmoothScrollEngine {
    pub fn new() -> Self {
        Self {
            v: Axis::default(),
            h: Axis::default(),
            z: ZoomAxis::default(),
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
                    .register_pixels(px, now_ms, settings.touchpad_pixel_multiplier, settings);
            }
        }
    }

    /// Register a wheel notch for the zoom axis. Called by the hook wiring layer
    /// when Ctrl is held and smooth_zoom is enabled.
    pub fn on_wheel_zoom(
        &mut self,
        delta: i32,
        now_ms: u64,
        source: crate::input_source::InputSource,
        settings: &EffectiveSettings,
    ) {
        use crate::input_source::InputSource;
        let dir = if settings.zoom_invert { -1 } else { 1 };
        let sensitivity = settings.zoom_sensitivity.clamp(0.25, 4.0);
        let scaled_delta = ((delta as f64) * sensitivity) as i32;
        match source {
            InputSource::Wheel | InputSource::HighResWheel => {
                self.z.register_notch(now_ms, scaled_delta * dir, settings);
            }
            InputSource::Touchpad => {
                let px = (delta as f64 / WHEEL_DELTA as f64) * BASE_STEP_PX * dir as f64;
                self.z
                    .register_pixels(px, now_ms, settings.touchpad_pixel_multiplier, settings);
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
                    .register_pixels(px, now_ms, settings.touchpad_pixel_multiplier, settings);
            }
        }
    }

    pub fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> EngineOutput {
        if settings.instant_mode {
            let v = self.v.flush_instant();
            let h = self.h.flush_instant();
            return EngineOutput {
                vertical: v,
                horizontal: h,
                zoom: 0,
            };
        }
        let v = self.v.step(dt_ms);
        let h = self.h.step(dt_ms);
        // Always drain zoom axis — even if smooth_zoom is disabled, complete
        // any in-flight animation before stopping.
        let z = self.z.step(dt_ms);
        EngineOutput {
            vertical: v,
            horizontal: h,
            zoom: z,
        }
    }

    pub fn has_pending_work(&self) -> bool {
        !self.v.pending.is_empty() || !self.h.pending.is_empty() || !self.z.pending.is_empty()
    }

    /// Returns the current vertical axis velocity (notches/sec) for stats tracking.
    pub fn last_velocity(&self) -> f64 {
        self.v.velocity
    }

    /// Discard any pending pixels and unit accumulator on all axes. Used by
    /// the modifier-passthrough hot path to clear inertia the moment a
    /// precision modifier (Ctrl/Alt) is pressed, so zoom feels immediate.
    pub fn reset_axes(&mut self) {
        self.v.pending.clear();
        self.v.unit_accum = 0.0;
        self.h.pending.clear();
        self.h.unit_accum = 0.0;
        self.z.pending.clear();
        self.z.unit_accum = 0.0;
    }
}

impl Default for SmoothScrollEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_pending_coalesces_only_adjacent_matching_easing() {
        let settings = EffectiveSettings::from_settings(&crate::settings::AppSettings::default());
        let captured: EasingSnapshot = (&settings).into();
        let different = EasingSnapshot {
            animation_time_ms: captured.animation_time_ms + 1,
            ..captured
        };
        let mut axis = Axis::default();

        axis.add_pending(10.0, captured);
        axis.add_pending(20.0, captured);
        axis.add_pending(30.0, different);
        axis.add_pending(40.0, captured);

        assert_eq!(axis.pending.len(), 3);
        assert_eq!(axis.pending[0].remaining_px, 30.0);
        assert_eq!(axis.pending[1].remaining_px, 30.0);
        assert_eq!(axis.pending[2].remaining_px, 40.0);
    }
}
