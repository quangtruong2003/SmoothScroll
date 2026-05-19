#![allow(clippy::field_reassign_with_default)]

use smoothscroll_core::engine::{EngineOutput, SmoothScrollEngine};
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};

fn eff() -> EffectiveSettings {
    EffectiveSettings::from_settings(&AppSettings::default())
}

fn on_wheel(e: &mut SmoothScrollEngine, delta: i32, now_ms: u64, eff: &EffectiveSettings) {
    e.on_wheel_with_source(delta, now_ms, InputSource::Wheel, eff);
}

fn on_hwheel(e: &mut SmoothScrollEngine, delta: i32, now_ms: u64, eff: &EffectiveSettings) {
    e.on_hwheel_with_source(delta, now_ms, InputSource::Wheel, eff);
}

#[test]
fn fresh_engine_has_no_pending_work() {
    let e = SmoothScrollEngine::new();
    assert!(!e.has_pending_work());
}

#[test]
fn step_with_no_input_returns_zero_output() {
    let mut e = SmoothScrollEngine::new();
    let out = e.step(8.33, &eff());
    assert_eq!(out, EngineOutput::default());
}

#[test]
fn one_notch_makes_engine_pending() {
    let mut e = SmoothScrollEngine::new();
    on_wheel(&mut e, 120, 0, &eff());
    assert!(e.has_pending_work());
}

#[test]
fn reverse_direction_inverts_pending_sign() {
    let mut s = AppSettings::default();
    s.reverse_wheel_direction = true;
    let eff_rev = EffectiveSettings::from_settings(&s);
    let mut e = SmoothScrollEngine::new();
    on_wheel(&mut e, 120, 0, &eff_rev);
    let out = e.step(360.0, &eff_rev);
    assert!(
        out.vertical < 0,
        "reversed direction should produce negative output"
    );
}

#[test]
fn rapid_notches_within_accel_window_increase_acceleration() {
    let eff = eff();
    let mut e = SmoothScrollEngine::new();
    let now = 1_000;
    on_wheel(&mut e, 120, now, &eff);
    on_wheel(&mut e, 120, now + 50, &eff);
    on_wheel(&mut e, 120, now + 100, &eff);

    let total_v = drain_vertical(&mut e, &eff);

    let abs = total_v.abs();
    assert!(
        (700..=740).contains(&abs),
        "expected approx 720 emitted wheel units, got {total_v}"
    );
}

#[test]
fn notches_outside_accel_window_reset_factor() {
    let eff = eff();
    let mut e = SmoothScrollEngine::new();
    on_wheel(&mut e, 120, 0, &eff);
    let _ = drain_vertical(&mut e, &eff);
    on_wheel(&mut e, 120, 10_000, &eff);

    let total_v = drain_vertical(&mut e, &eff);
    let abs = total_v.abs();
    assert!(
        (110..=130).contains(&abs),
        "expected approx 120 emitted wheel units, got {total_v}"
    );
}

#[test]
fn step_clamps_pulse_count_per_frame() {
    let mut s = AppSettings::default();
    s.step_size_px = 500;
    s.acceleration_max = 20;
    let eff = EffectiveSettings::from_settings(&s);
    let mut e = SmoothScrollEngine::new();
    let now = 1_000;
    for i in 0..10 {
        on_wheel(&mut e, 120, now + (i as u64) * 10, &eff);
    }
    let out = e.step(1000.0, &eff);
    assert!(
        out.vertical.abs() <= 240,
        "expected pulse clamp <= 240, got {}",
        out.vertical
    );
}

#[test]
fn engine_finishes_within_reasonable_time() {
    let eff = eff();
    let mut e = SmoothScrollEngine::new();
    on_wheel(&mut e, 120, 0, &eff);

    let mut frames = 0;
    while e.has_pending_work() && frames < 200 {
        e.step(1000.0 / 120.0, &eff);
        frames += 1;
    }

    assert!(
        !e.has_pending_work(),
        "engine should drain within 200 frames at 120fps, still has work after {frames}"
    );
}

#[test]
fn horizontal_smoothness_off_zeroes_horizontal_output_only() {
    let mut s = AppSettings::default();
    s.horizontal_smoothness = false;
    let eff = EffectiveSettings::from_settings(&s);
    let mut e = SmoothScrollEngine::new();
    on_wheel(&mut e, 120, 0, &eff);
    on_hwheel(&mut e, 120, 0, &eff);

    let mut total_h = 0;
    let mut total_v = 0;
    for _ in 0..500 {
        let out = e.step(1000.0 / 120.0, &eff);
        total_v += out.vertical;
        total_h += out.horizontal;
        if !e.has_pending_work() && out == EngineOutput::default() {
            break;
        }
    }
    assert_eq!(total_h, 0, "horizontal output should be suppressed");
    assert!(total_v.abs() > 0, "vertical should still emit");
}

#[test]
fn reverse_direction_inverts_both_axes() {
    let mut s = AppSettings::default();
    s.reverse_wheel_direction = true;
    let eff = EffectiveSettings::from_settings(&s);
    let mut e = SmoothScrollEngine::new();
    on_wheel(&mut e, 120, 0, &eff);
    on_hwheel(&mut e, 120, 0, &eff);

    let mut total_v = 0;
    let mut total_h = 0;
    for _ in 0..500 {
        let out = e.step(1000.0 / 120.0, &eff);
        total_v += out.vertical;
        total_h += out.horizontal;
        if !e.has_pending_work() && out == EngineOutput::default() {
            break;
        }
    }
    assert!(
        total_v < 0,
        "reversed vertical should be negative, got {total_v}"
    );
    assert!(
        total_h < 0,
        "reversed horizontal should be negative, got {total_h}"
    );
}

#[test]
fn touchpad_input_skips_acceleration() {
    let eff = eff();
    let mut e = SmoothScrollEngine::new();
    for i in 0..6 {
        e.on_wheel_with_source(30, i * 20, InputSource::Touchpad, &eff);
    }
    assert!(e.has_pending_work());
    let mut total = 0;
    for _ in 0..200 {
        let out = e.step(8.33, &eff);
        total += out.vertical;
        if !e.has_pending_work() {
            break;
        }
    }
    assert!(total.abs() < 600, "touchpad output too large: {}", total);
}

#[test]
fn touchpad_pixel_multiplier_scales_output() {
    let mut s = AppSettings::default();
    s.touchpad_pixel_multiplier = 2.0;
    let eff = EffectiveSettings::from_settings(&s);
    let mut e = SmoothScrollEngine::new();
    for i in 0..6 {
        e.on_wheel_with_source(30, i * 20, InputSource::Touchpad, &eff);
    }
    let mut total = 0;
    for _ in 0..200 {
        total += e.step(8.33, &eff).vertical;
        if !e.has_pending_work() {
            break;
        }
    }
    assert!(total > 0, "expected positive output");
}

#[test]
fn default_engine_has_no_pending_work() {
    let e = SmoothScrollEngine::default();
    assert!(!e.has_pending_work());
}

fn drain_vertical(e: &mut SmoothScrollEngine, eff: &EffectiveSettings) -> i32 {
    let mut total = 0;
    for _ in 0..500 {
        let out = e.step(1000.0 / 120.0, eff);
        total += out.vertical;
        if !e.has_pending_work() && out.vertical == 0 {
            break;
        }
    }
    total
}

#[test]
fn instant_mode_flushes_pending_pixels_in_one_step() {
    let mut s = AppSettings::default();
    s.animation_time_ms = 360;
    let mut eff = EffectiveSettings::from_settings(&s);
    let mut engine = SmoothScrollEngine::new();

    // Inject pending work via a normal wheel event in non-instant mode.
    eff.instant_mode = false;
    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &eff);
    assert!(engine.has_pending_work());

    // Switch to instant — one step should drain everything.
    eff.instant_mode = true;
    let out = engine.step(1000.0 / 120.0, &eff);
    assert!(out.vertical != 0, "expected pulses on instant flush");
    assert!(
        !engine.has_pending_work(),
        "expected no remaining work after instant step"
    );
}

#[test]
fn instant_mode_no_pending_returns_zero() {
    let s = AppSettings::default();
    let mut eff = EffectiveSettings::from_settings(&s);
    eff.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();
    let out = engine.step(8.0, &eff);
    assert_eq!(out.vertical, 0);
    assert_eq!(out.horizontal, 0);
}

/// Deterministic fixture so the WASM build can be cross-checked against
/// native by replaying this sequence in JS — outputs must match.
#[test]
fn deterministic_fixture_output() {
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    let mut e = SmoothScrollEngine::new();
    let mut total_v = 0i32;
    for tick in 0..100u64 {
        if tick % 10 == 0 {
            e.on_wheel_with_source(120, tick * 8, InputSource::Wheel, &eff);
        }
        let out = e.step(8.0, &eff);
        total_v += out.vertical;
    }
    assert!(total_v != 0, "no output produced from 10 wheel notches");
    assert!(
        total_v.abs() > 100,
        "expected meaningful output, got {total_v}"
    );
}
