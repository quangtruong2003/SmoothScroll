//! Smooth scroll engine.
//!
//! **Threading:** the engine is *not* thread-safe internally. The caller
//! (the app crate) wraps it in `parking_lot::Mutex<SmoothScrollEngine>`.
//!
//! **Statelessness w.r.t. settings:** the engine owns only the rolling
//! per-axis state (`remaining_px`, `velocity`, semantic owner, etc.). Settings
//! are passed by reference into every hot-path call so the caller can swap them
//! atomically without locking the engine.

use crate::constants::{BASE_STEP_PX, EMIT_UNIT, PULSE_CLAMP_MAX, PULSE_CLAMP_MIN, WHEEL_DELTA};
use crate::easing::{compute_easing_fraction, EasingMode};
use crate::input_source::InputSource;
use crate::settings::EffectiveSettings;
use crate::wheel::{
    DeltaTransform, ModifierKeys, SemanticPulse, SmoothingStrategy, WheelAxis, WheelInputEvent,
    WheelSemantic, WheelSequence, WheelTransport,
};
use std::collections::VecDeque;

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct EngineOutput {
    /// Pulse owned by the physical vertical input axis.
    pub vertical: Option<SemanticPulse>,
    /// Pulse owned by the physical horizontal input axis.
    pub horizontal: Option<SemanticPulse>,
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
    velocity: f64,
    unit_accum: f64,
    clamp_carry_pulses: i32,
    sequence: Option<WheelSequence>,
    discrete_notches: VecDeque<i8>,
    discrete_remainder: i32,
}

impl Axis {
    fn reconcile_sequence(&mut self, next: WheelSequence) {
        if self.sequence.is_some_and(|current| current != next) {
            self.reset_sequence();
        }
        self.sequence = Some(next);
    }

    fn reset_sequence(&mut self) {
        self.pending.clear();
        self.last_notch_ms = 0;
        self.velocity = 0.0;
        self.unit_accum = 0.0;
        self.clamp_carry_pulses = 0;
        self.sequence = None;
        self.discrete_notches.clear();
        self.discrete_remainder = 0;
    }

    fn has_pending(&self) -> bool {
        !self.pending.is_empty()
            || self.clamp_carry_pulses != 0
            || !self.discrete_notches.is_empty()
    }

    fn flush_instant(&mut self) -> i32 {
        let remaining_px: f64 = self.pending.iter().map(|batch| batch.remaining_px).sum();
        self.pending.clear();
        let mut pulses = self.clamp_carry_pulses;
        self.clamp_carry_pulses = 0;

        if remaining_px.abs() < 0.1 {
            self.unit_accum = 0.0;
        } else {
            let wheel_units = (remaining_px / BASE_STEP_PX) * WHEEL_DELTA as f64;
            let units = wheel_units / EMIT_UNIT as f64;
            self.unit_accum += units;
            let fresh_pulses = self.unit_accum.trunc() as i32;
            self.unit_accum -= fresh_pulses as f64;
            pulses = pulses.saturating_add(fresh_pulses);
        }

        #[cfg(windows)]
        {
            // The Windows emitter synchronously chunks oversized instant output.
            pulses.saturating_mul(EMIT_UNIT)
        }
        #[cfg(not(windows))]
        {
            // Preserve the legacy clamp/drop behavior on other platforms.
            pulses.clamp(PULSE_CLAMP_MIN, PULSE_CLAMP_MAX) * EMIT_UNIT
        }
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

        let instant_velocity = if self.last_notch_ms > 0 {
            let dt = now_ms - self.last_notch_ms;
            if (1..500).contains(&dt) {
                1000.0 / dt as f64
            } else {
                0.0
            }
        } else {
            0.0
        };

        const ALPHA: f64 = 0.3;
        self.velocity = ALPHA * instant_velocity + (1.0 - ALPHA) * self.velocity;
        self.last_notch_ms = now_ms;

        let velocity_ratio = (self.velocity / settings.max_velocity).min(1.0);
        let accel_factor =
            1.0 + velocity_ratio * velocity_ratio * (settings.acceleration_max as f64 - 1.0);
        self.add_pending(
            notches * settings.step_size_px as f64 * accel_factor,
            easing,
        );
    }

    fn register_pixels(&mut self, px: f64, now_ms: u64, multiplier: f64, easing: EasingSnapshot) {
        self.last_notch_ms = now_ms;
        self.velocity = 0.0;
        self.add_pending(px * multiplier, easing);
    }

    fn register_discrete(&mut self, delta: i32) {
        if delta == 0 {
            return;
        }
        let direction = delta.signum();
        if self.discrete_remainder != 0 && self.discrete_remainder.signum() != direction {
            self.discrete_remainder = 0;
        }
        self.discrete_remainder = self.discrete_remainder.saturating_add(delta);
        while self.discrete_remainder.abs() >= WHEEL_DELTA {
            self.discrete_notches.push_back(direction as i8);
            self.discrete_remainder -= direction * WHEEL_DELTA;
        }
    }

    fn flush_discrete(&mut self) -> i32 {
        self.discrete_notches
            .pop_front()
            .map_or(0, |direction| direction as i32 * WHEEL_DELTA)
    }

    fn flush_discrete_instant(&mut self) -> i32 {
        let Some(direction) = self.discrete_notches.pop_front() else {
            return 0;
        };
        let mut notches = 1i32;
        while self.discrete_notches.front() == Some(&direction) {
            self.discrete_notches.pop_front();
            notches = notches.saturating_add(1);
        }
        (direction as i32)
            .saturating_mul(WHEEL_DELTA)
            .saturating_mul(notches)
    }

    fn step_continuous(&mut self, dt_ms: f64) -> i32 {
        const DECAY_HALF_LIFE_MS: f64 = 200.0;
        let decay = (-0.693 * dt_ms / DECAY_HALF_LIFE_MS).exp();
        self.velocity *= decay;
        if self.velocity < 0.1 {
            self.velocity = 0.0;
        }

        let mut emitted_px = 0.0;
        for batch in &mut self.pending {
            let snapshot = batch.easing;
            let frac = compute_easing_fraction(
                dt_ms,
                (snapshot.animation_time_ms as f64).max(1.0),
                snapshot.easing_mode,
                snapshot.tail_to_head_ratio as f64,
                snapshot.animation_easing,
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
        self.unit_accum += wheel_units / EMIT_UNIT as f64;

        let mut pulses = self.clamp_carry_pulses;
        self.clamp_carry_pulses = 0;
        if self.unit_accum.abs() >= 1.0 {
            let fresh_pulses = self.unit_accum.trunc() as i32;
            self.unit_accum -= fresh_pulses as f64;
            pulses = pulses.saturating_add(fresh_pulses);
        }
        if pulses == 0 {
            return 0;
        }
        let emitted = pulses.clamp(PULSE_CLAMP_MIN, PULSE_CLAMP_MAX);
        self.clamp_carry_pulses = pulses.saturating_sub(emitted);
        emitted * EMIT_UNIT
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

    pub fn register(
        &mut self,
        event: WheelInputEvent,
        sequence: WheelSequence,
        now_ms: u64,
        settings: &EffectiveSettings,
    ) {
        let axis = self.axis_mut(event.semantic.axis);
        axis.reconcile_sequence(sequence);
        let delta = transformed_delta(event.delta, sequence.delta_transform);

        match sequence.strategy {
            SmoothingStrategy::Continuous => match event.source {
                InputSource::Wheel | InputSource::HighResWheel => {
                    axis.register_notch(now_ms, delta, settings);
                }
                InputSource::Touchpad if settings.touchpad_smoothing_enabled => {
                    let pixels = (delta as f64 / WHEEL_DELTA as f64) * BASE_STEP_PX;
                    axis.register_pixels(
                        pixels,
                        now_ms,
                        settings.touchpad_pixel_multiplier,
                        settings.into(),
                    );
                }
                InputSource::Touchpad => axis.register_notch(now_ms, delta, settings),
            },
            SmoothingStrategy::DiscreteNotchPreserving => axis.register_discrete(delta),
        }
    }

    /// Temporary source-compatible wrapper for callers that have not migrated
    /// to a complete semantic event yet.
    pub fn on_wheel_with_source(
        &mut self,
        delta: i32,
        now_ms: u64,
        source: InputSource,
        settings: &EffectiveSettings,
    ) {
        let semantic = WheelSemantic {
            axis: WheelAxis::Vertical,
            modifiers: ModifierKeys::default(),
        };
        self.register(
            WheelInputEvent {
                delta,
                semantic,
                source,
            },
            WheelSequence {
                semantic,
                transport: WheelTransport::Native,
                strategy: SmoothingStrategy::Continuous,
                delta_transform: DeltaTransform::Generic {
                    sign: if settings.reverse_wheel_direction {
                        -1
                    } else {
                        1
                    },
                },
            },
            now_ms,
            settings,
        );
    }

    /// Temporary source-compatible wrapper for callers that have not migrated
    /// to a complete semantic event yet.
    pub fn on_hwheel_with_source(
        &mut self,
        delta: i32,
        now_ms: u64,
        source: InputSource,
        settings: &EffectiveSettings,
    ) {
        let semantic = WheelSemantic {
            axis: WheelAxis::Horizontal,
            modifiers: ModifierKeys::default(),
        };
        self.register(
            WheelInputEvent {
                delta,
                semantic,
                source,
            },
            WheelSequence {
                semantic,
                transport: WheelTransport::Native,
                strategy: SmoothingStrategy::Continuous,
                delta_transform: DeltaTransform::Generic {
                    sign: if settings.reverse_wheel_direction {
                        -1
                    } else {
                        1
                    },
                },
            },
            now_ms,
            settings,
        );
    }

    pub fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> EngineOutput {
        EngineOutput {
            vertical: self.step_axis(WheelAxis::Vertical, dt_ms, settings.instant_mode),
            horizontal: self.step_axis(WheelAxis::Horizontal, dt_ms, settings.instant_mode),
        }
    }

    pub fn active_sequence(&self, axis: WheelAxis) -> Option<WheelSequence> {
        self.axis(axis).sequence
    }

    pub fn has_pending_axis(&self, axis: WheelAxis) -> bool {
        self.axis(axis).has_pending()
    }

    pub fn has_pending_work(&self) -> bool {
        self.has_pending_axis(WheelAxis::Vertical) || self.has_pending_axis(WheelAxis::Horizontal)
    }

    pub fn finish_axis_pulse(&mut self, axis: WheelAxis, sequence: WheelSequence) {
        let axis = self.axis_mut(axis);
        if axis.sequence == Some(sequence) && !axis.has_pending() {
            axis.sequence = None;
        }
    }

    pub fn reset_axis_if_sequence(&mut self, axis: WheelAxis, sequence: WheelSequence) -> bool {
        let axis = self.axis_mut(axis);
        if axis.sequence == Some(sequence) {
            axis.reset_sequence();
            true
        } else {
            false
        }
    }

    pub fn reset_axis(&mut self, axis: WheelAxis) {
        self.axis_mut(axis).reset_sequence();
    }

    /// Returns the current vertical axis velocity (notches/sec) for stats tracking.
    pub fn last_velocity(&self) -> f64 {
        self.v.velocity
    }

    /// Discard pending output and semantic ownership on both axes.
    pub fn reset_axes(&mut self) {
        self.v.reset_sequence();
        self.h.reset_sequence();
    }

    /// Cancel complete animated sequences, including cadence/velocity history.
    /// Used when window ownership changes so the next window starts fresh.
    pub fn reset_sequence(&mut self) {
        self.reset_axes();
    }

    fn step_axis(
        &mut self,
        axis: WheelAxis,
        dt_ms: f64,
        instant_mode: bool,
    ) -> Option<SemanticPulse> {
        let axis_state = self.axis_mut(axis);
        let sequence = axis_state.sequence?;
        let units = match sequence.strategy {
            SmoothingStrategy::Continuous if instant_mode => axis_state.flush_instant(),
            SmoothingStrategy::Continuous => axis_state.step_continuous(dt_ms),
            SmoothingStrategy::DiscreteNotchPreserving if instant_mode => {
                axis_state.flush_discrete_instant()
            }
            SmoothingStrategy::DiscreteNotchPreserving => axis_state.flush_discrete(),
        };

        if units == 0 {
            if !axis_state.has_pending() {
                axis_state.sequence = None;
            }
            return None;
        }

        Some(SemanticPulse { units, sequence })
    }

    fn axis(&self, axis: WheelAxis) -> &Axis {
        match axis {
            WheelAxis::Vertical => &self.v,
            WheelAxis::Horizontal => &self.h,
        }
    }

    fn axis_mut(&mut self, axis: WheelAxis) -> &mut Axis {
        match axis {
            WheelAxis::Vertical => &mut self.v,
            WheelAxis::Horizontal => &mut self.h,
        }
    }
}

fn transformed_delta(delta: i32, transform: DeltaTransform) -> i32 {
    match transform {
        DeltaTransform::Generic { sign } => delta.saturating_mul(sign as i32),
        DeltaTransform::CtrlZoom { sensitivity, sign } => {
            ((delta as f64 * sensitivity.clamp(0.25, 4.0)) as i32).saturating_mul(sign as i32)
        }
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
