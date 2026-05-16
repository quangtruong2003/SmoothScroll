//! Easing curves. Ported from `SmoothScrollEngine.ComputeEasingFraction`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum EasingMode {
    #[default]
    ExponentialOut,
    CubicOut,
    QuinticOut,
    Linear,
}

/// Returns the fraction (0..=1) of the remaining distance to emit this frame.
///
/// `dt_ms` is the elapsed time since the last frame in milliseconds.
/// `duration` is the total animation time in milliseconds.
/// `tail_to_head_ratio` controls the ExponentialOut curve sharpness (typical 1..=20).
/// `easing_enabled = false` short-circuits to `min(1.0, dt_ms/duration)`.
pub fn compute_easing_fraction(
    dt_ms: f64,
    duration: f64,
    mode: EasingMode,
    tail_to_head_ratio: f64,
    easing_enabled: bool,
) -> f64 {
    let denom = duration.max(1.0);

    if !easing_enabled || mode == EasingMode::Linear {
        return (dt_ms / denom).min(1.0);
    }

    let t = (dt_ms / denom).min(1.0);

    match mode {
        EasingMode::Linear => t,
        EasingMode::CubicOut => 1.0 - (1.0 - t).powi(3),
        EasingMode::QuinticOut => 1.0 - (1.0 - t).powi(5),
        EasingMode::ExponentialOut => 1.0 - (-(2.0 + tail_to_head_ratio) * t).exp(),
    }
}
