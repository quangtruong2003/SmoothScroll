use softscroll_core::engine::{EngineOutput, SmoothScrollEngine};
use softscroll_core::settings::AppSettings;

fn settings() -> AppSettings {
    AppSettings::default()
}

#[test]
fn fresh_engine_has_no_pending_work() {
    let e = SmoothScrollEngine::new(settings());
    assert!(!e.has_pending_work());
}

#[test]
fn step_with_no_input_returns_zero_output() {
    let mut e = SmoothScrollEngine::new(settings());
    let out = e.step(8.33);
    assert_eq!(out, EngineOutput::default());
}

#[test]
fn one_notch_makes_engine_pending() {
    let mut e = SmoothScrollEngine::new(settings());
    e.on_wheel(120, 0);
    assert!(e.has_pending_work());
}

#[test]
fn reverse_direction_inverts_pending_sign() {
    let mut s = settings();
    s.reverse_wheel_direction = true;
    let mut e = SmoothScrollEngine::new(s);
    e.on_wheel(120, 0);
    let out = e.step(360.0);
    assert!(
        out.vertical < 0,
        "reversed direction should produce negative output"
    );
}

#[test]
fn rapid_notches_within_accel_window_increase_acceleration() {
    let mut e = SmoothScrollEngine::new(settings());
    let now = 1_000;
    e.on_wheel(120, now);
    e.on_wheel(120, now + 50);
    e.on_wheel(120, now + 100);

    let total_v = drain_vertical(&mut e);

    let abs = total_v.abs();
    assert!(
        (700..=740).contains(&abs),
        "expected approx 720 emitted wheel units, got {total_v}"
    );
}

#[test]
fn notches_outside_accel_window_reset_factor() {
    let mut e = SmoothScrollEngine::new(settings());
    e.on_wheel(120, 0);
    let _ = drain_vertical(&mut e);
    e.on_wheel(120, 10_000);

    let total_v = drain_vertical(&mut e);
    let abs = total_v.abs();
    assert!(
        (110..=130).contains(&abs),
        "expected approx 120 emitted wheel units, got {total_v}"
    );
}

#[test]
fn step_clamps_pulse_count_per_frame() {
    let mut s = settings();
    s.step_size_px = 500;
    s.acceleration_max = 20;
    let mut e = SmoothScrollEngine::new(s);
    let now = 1_000;
    for i in 0..10 {
        e.on_wheel(120, now + (i as u64) * 10);
    }
    let out = e.step(1000.0);
    assert!(
        out.vertical.abs() <= 240,
        "expected pulse clamp <= 240, got {}",
        out.vertical
    );
}

#[test]
fn engine_finishes_within_reasonable_time() {
    let mut e = SmoothScrollEngine::new(settings());
    e.on_wheel(120, 0);

    let mut frames = 0;
    while e.has_pending_work() && frames < 200 {
        e.step(1000.0 / 120.0);
        frames += 1;
    }

    assert!(
        !e.has_pending_work(),
        "engine should drain within 200 frames at 120fps, still has work after {frames}"
    );
}

#[test]
fn apply_settings_updates_internal_settings() {
    let mut e = SmoothScrollEngine::new(settings());
    let mut new_s = settings();
    new_s.step_size_px = 999;
    e.apply_settings(new_s);
    assert_eq!(e.settings().step_size_px, 999);
}

#[test]
fn horizontal_smoothness_off_zeroes_horizontal_output_only() {
    let mut s = settings();
    s.horizontal_smoothness = false;
    let mut e = SmoothScrollEngine::new(s);
    e.on_wheel(120, 0);
    e.on_hwheel(120, 0);

    let mut total_h = 0;
    let mut total_v = 0;
    for _ in 0..500 {
        let out = e.step(1000.0 / 120.0);
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
    let mut s = settings();
    s.reverse_wheel_direction = true;
    let mut e = SmoothScrollEngine::new(s);
    e.on_wheel(120, 0);
    e.on_hwheel(120, 0);

    let mut total_v = 0;
    let mut total_h = 0;
    for _ in 0..500 {
        let out = e.step(1000.0 / 120.0);
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

fn drain_vertical(e: &mut SmoothScrollEngine) -> i32 {
    let mut total = 0;
    for _ in 0..500 {
        let out = e.step(1000.0 / 120.0);
        total += out.vertical;
        if !e.has_pending_work() && out.vertical == 0 {
            break;
        }
    }
    total
}
