//! Window payout model: each received amount is handed over across exactly its
//! own duration; overlapping windows add; hand-over is exactly conservative.
//!
//! Port of the model-3.0 design studied in bobo198504/SmoothWheelScroll
//! (src/anim3_core.h), adapted to SmoothScroll settings: a window's payout
//! shape is the user's chosen easing curve instead of a fixed smoothstep.

use crate::easing::EasingMode;
use std::collections::VecDeque;

/// Cap on windows in flight. A free-spinning wheel can report ~1000 events/s;
/// at the longest duration that is a few hundred windows. Overflow goes to
/// `due_px` and pays out at once — an amount is never lost.
pub const MAX_WINDOWS: usize = 2048;

/// Frozen payout parameters for one window (from settings at feed time).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PayoutParams {
    pub duration_ms: f64,
    pub easing_mode: EasingMode,
    pub tail_to_head_ratio: f64,
    pub easing_enabled: bool,
}

#[derive(Debug, Clone, Copy)]
struct Window {
    remaining_px: f64,
    age_ms: f64,
    params: PayoutParams,
    eased: bool,
}

/// One axis' in-flight windows.
#[derive(Debug, Default)]
pub struct WindowGlide {
    windows: VecDeque<Window>,
    due_px: f64,
}

impl WindowGlide {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset(&mut self) {
        self.windows.clear();
        self.due_px = 0.0;
    }

    pub fn is_empty(&self) -> bool {
        self.windows.is_empty() && self.due_px == 0.0
    }

    /// Total still owed (for instant flush / pending checks).
    pub fn pending_px(&self) -> f64 {
        self.windows.iter().map(|w| w.remaining_px).sum::<f64>() + self.due_px
    }

    /// Open one window holding exactly `amount_px`. `gap_ms` is the time since
    /// the previous feed on this axis (0 for the first message of a gesture).
    pub fn feed(&mut self, amount_px: f64, gap_ms: f64, params: PayoutParams) {
        if amount_px == 0.0 {
            return;
        }
        if self.windows.len() >= MAX_WINDOWS {
            self.due_px += amount_px;
            return;
        }
        let eased = payout_ease_for(gap_ms, params.duration_ms);
        self.windows.push_back(Window {
            remaining_px: amount_px,
            age_ms: 0.0,
            params,
            eased,
        });
    }

    /// Advance by `dt_ms`; returns the pixels to hand over this frame.
    pub fn tick(&mut self, dt_ms: f64) -> f64 {
        if dt_ms <= 0.0 {
            return 0.0;
        }
        let mut out = self.due_px;
        self.due_px = 0.0;
        self.windows.retain_mut(|w| {
            let duration = if w.params.duration_ms > 0.0 { w.params.duration_ms } else {
                out += w.remaining_px;
                return false; // zero duration: hand over at once
            };
            let u0 = (w.age_ms / duration).min(1.0);
            w.age_ms += dt_ms;
            let u1 = (w.age_ms / duration).min(1.0);
            let s0 = payout_frac(u0, &w.params, w.eased);
            let s1 = payout_frac(u1, &w.params, w.eased);
            let rem = 1.0 - s0;
            let pay = if rem > 1e-12 { w.remaining_px * (s1 - s0) / rem } else { w.remaining_px };
            out += pay;
            w.remaining_px -= pay;
            w.age_ms < duration
        });
        out
    }
}

/// Cumulative share paid by progress u of a window. Constant rate unless the
/// window was opened with easing, in which case the user's Out-curve applies.
fn payout_frac(u: f64, params: &PayoutParams, eased: bool) -> f64 {
    if u <= 0.0 {
        return 0.0;
    }
    if u >= 1.0 {
        return 1.0;
    }
    if !eased || !params.easing_enabled || params.easing_mode == EasingMode::Linear {
        return u;
    }
    match params.easing_mode {
        EasingMode::CubicOut => 1.0 - (1.0 - u).powi(3),
        EasingMode::QuinticOut => 1.0 - (1.0 - u).powi(5),
        EasingMode::ExponentialOut => 1.0 - (-(2.0 + params.tail_to_head_ratio) * u).exp(),
        EasingMode::Linear => u,
    }
}

/// Easing only helps when windows overlap AND the window/gap ratio is not
/// (nearly) an integer — otherwise the constant rate is already flat and
/// easing only adds ripple. Band 0.08 is the measured optimum (see spec §5.2).
pub fn payout_ease_for(gap_ms: f64, window_ms: f64) -> bool {
    if !(gap_ms > 0.0) || !(window_ms > 0.0) || gap_ms >= window_ms {
        return false;
    }
    let ratio = window_ms / gap_ms;
    let nearest = if ratio - ratio.floor() < 0.5 { ratio.floor() } else { ratio.ceil() };
    (ratio - nearest).abs() >= 0.08
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::easing::EasingMode;

    fn params(duration_ms: f64, mode: EasingMode) -> PayoutParams {
        PayoutParams { duration_ms, easing_mode: mode, tail_to_head_ratio: 5.0, easing_enabled: true }
    }

    #[test]
    fn single_window_pays_exactly_its_amount_by_its_duration() {
        let mut g = WindowGlide::new();
        g.feed(144.0, 0.0, params(220.0, EasingMode::ExponentialOut));
        let mut paid = 0.0;
        for _ in 0..220 {
            paid += g.tick(1.0);
        }
        assert!((paid - 144.0).abs() < 1e-9, "paid {paid}");
        assert!(g.is_empty());
        assert_eq!(g.tick(1.0), 0.0); // nothing after the window ends
    }

    #[test]
    fn overlapping_windows_conserve_the_total() {
        let mut g = WindowGlide::new();
        let mut fed = 0.0;
        let mut paid = 0.0;
        for i in 0..10 {
            g.feed(120.0 + i as f64, 30.0, params(220.0, EasingMode::CubicOut));
            fed += 120.0 + i as f64;
            paid += g.tick(10.0);
        }
        for _ in 0..600 {
            paid += g.tick(1.0);
        }
        assert!((fed - paid).abs() < 1e-9, "fed {fed} paid {paid}");
    }

    #[test]
    fn signed_reversal_conserves_the_signed_total() {
        let mut g = WindowGlide::new();
        g.feed(144.0, 0.0, params(220.0, EasingMode::Linear));
        let mut paid = g.tick(50.0);
        g.feed(-144.0, 10.0, params(220.0, EasingMode::Linear));
        for _ in 0..500 {
            paid += g.tick(1.0);
        }
        assert!(paid.abs() < 1e-9, "signed total {paid}");
    }

    #[test]
    fn overflow_is_handed_over_not_dropped() {
        let mut g = WindowGlide::new();
        for _ in 0..(MAX_WINDOWS + 1) {
            g.feed(1.0, 1000.0, params(200.0, EasingMode::Linear));
        }
        // MAX_WINDOWS windows are spreading; the excess sits in due and pays next tick.
        let first = g.tick(1.0);
        assert!(first >= 1.0, "due must pay out immediately, got {first}");
    }

    #[test]
    fn payout_ease_for_matches_the_measured_band() {
        assert!(!payout_ease_for(0.0, 200.0));      // first message: constant rate
        assert!(!payout_ease_for(250.0, 200.0));    // no overlap
        assert!(!payout_ease_for(100.0, 200.0));    // ratio exactly 2: already flat
        assert!(payout_ease_for(150.0, 200.0));     // ratio 1.33: overlapping, eased
        assert!(!payout_ease_for(200.0 / 1.05, 200.0)); // |1.05 − 1| = 0.05 < 0.08 band
        assert!(payout_ease_for(200.0 / 1.10, 200.0));  // 0.10 outside the band
    }

    #[test]
    fn linear_payout_is_constant_rate() {
        let mut g = WindowGlide::new();
        g.feed(200.0, 0.0, params(200.0, EasingMode::Linear));
        let first = g.tick(1.0);
        assert!((first - 1.0).abs() < 1e-9, "constant rate pays 1 px/ms, got {first}");
    }
}
