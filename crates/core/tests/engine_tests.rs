#![allow(clippy::field_reassign_with_default)]

use smoothscroll_core::engine::{EngineOutput, SmoothScrollEngine};
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
use smoothscroll_core::wheel::{
    DeltaTransform, ModifierKeys, SmoothingStrategy, WheelAxis, WheelInputEvent, WheelSemantic,
    WheelSequence, WheelTransport,
};

fn eff() -> EffectiveSettings {
    EffectiveSettings::from_settings(&AppSettings::default())
}

fn effective_with(
    animation_time_ms: i32,
    easing_mode: smoothscroll_core::easing::EasingMode,
    tail_to_head_ratio: i32,
    animation_easing: bool,
) -> EffectiveSettings {
    let mut s = AppSettings::default();
    s.animation_time_ms = animation_time_ms;
    s.easing_mode = easing_mode;
    s.tail_to_head_ratio = tail_to_head_ratio;
    s.animation_easing = animation_easing;
    EffectiveSettings::from_settings(&s)
}
fn on_wheel(e: &mut SmoothScrollEngine, delta: i32, now_ms: u64, eff: &EffectiveSettings) {
    e.on_wheel_with_source(delta, now_ms, InputSource::Wheel, eff);
}

fn on_hwheel(e: &mut SmoothScrollEngine, delta: i32, now_ms: u64, eff: &EffectiveSettings) {
    e.on_hwheel_with_source(delta, now_ms, InputSource::Wheel, eff);
}

fn vertical_units(output: EngineOutput) -> i32 {
    output.vertical.map_or(0, |pulse| pulse.units)
}

fn horizontal_units(output: EngineOutput) -> i32 {
    output.horizontal.map_or(0, |pulse| pulse.units)
}

fn zoom_sequence(settings: &EffectiveSettings) -> (WheelInputEvent, WheelSequence) {
    let semantic = WheelSemantic {
        axis: WheelAxis::Vertical,
        modifiers: ModifierKeys {
            ctrl: true,
            ..ModifierKeys::default()
        },
    };
    (
        WheelInputEvent {
            delta: 120,
            semantic,
            source: InputSource::Wheel,
        },
        WheelSequence {
            semantic,
            transport: WheelTransport::Native,
            strategy: SmoothingStrategy::Continuous,
            delta_transform: DeltaTransform::CtrlZoom {
                sensitivity: settings.zoom_sensitivity,
                sign: if settings.zoom_invert { -1 } else { 1 },
            },
        },
    )
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
        vertical_units(out) < 0,
        "reversed direction should produce negative output"
    );
}

#[test]
fn rapid_notches_increase_total_distance() {
    let eff = eff();
    let mut engine = SmoothScrollEngine::new();
    let now = 1_000;
    for i in 0..10 {
        engine.on_wheel_with_source(120, now + i as u64 * 50, InputSource::Wheel, &eff);
    }
    let total_v = drain_vertical(&mut engine, &eff);

    let mut engine2 = SmoothScrollEngine::new();
    for i in 0..10 {
        engine2.on_wheel_with_source(120, now + i as u64 * 500, InputSource::Wheel, &eff);
    }
    let total_v2 = drain_vertical(&mut engine2, &eff);

    assert!(
        total_v.abs() > total_v2.abs(),
        "rapid {} should exceed slow {}",
        total_v,
        total_v2
    );
}

#[cfg(windows)]
#[test]
fn instant_mode_rapid_notches_travel_farther_than_slow_notches() {
    let mut settings = AppSettings::default();
    settings.step_size_px = 60;
    settings.acceleration_max = 10;
    settings.max_velocity = 20.0;
    let mut instant = EffectiveSettings::from_settings(&settings);
    instant.instant_mode = true;

    let mut rapid = SmoothScrollEngine::new();
    for i in 0..10u64 {
        rapid.on_wheel_with_source(120, 1_000 + i * 50, InputSource::Wheel, &instant);
    }
    let rapid_output = rapid
        .step(1000.0 / 120.0, &instant)
        .vertical
        .map_or(0, |pulse| pulse.units);

    let mut slow = SmoothScrollEngine::new();
    for i in 0..10u64 {
        slow.on_wheel_with_source(120, 1_000 + i * 500, InputSource::Wheel, &instant);
    }
    let slow_output = slow
        .step(1000.0 / 120.0, &instant)
        .vertical
        .map_or(0, |pulse| pulse.units);

    assert!(
        rapid_output.abs() > slow_output.abs(),
        "instant acceleration must preserve distance: rapid={rapid_output}, slow={slow_output}"
    );
    assert!(!rapid.has_pending_work());
    assert!(!slow.has_pending_work());
}

#[cfg(windows)]
#[test]
fn instant_mode_preserves_full_quantized_distance_beyond_legacy_480_limit() {
    let mut settings = AppSettings::default();
    settings.step_size_px = 144;
    settings.acceleration_max = 10;
    settings.max_velocity = 20.0;
    // Keep the animated control below its intentional per-frame clamp so this
    // fixture isolates the instant-only legacy clamp/drop behavior.
    settings.animation_time_ms = 500;
    settings.animation_easing = false;

    let animated = EffectiveSettings::from_settings(&settings);
    let mut instant = EffectiveSettings::from_settings(&settings);
    instant.instant_mode = true;

    let mut animated_engine = SmoothScrollEngine::new();
    let mut instant_engine = SmoothScrollEngine::new();
    for i in 0..8u64 {
        let now = 1_000 + i * 40;
        animated_engine.on_wheel_with_source(120, now, InputSource::Wheel, &animated);
        instant_engine.on_wheel_with_source(120, now, InputSource::Wheel, &instant);
    }

    let animated_total = drain_vertical(&mut animated_engine, &animated);
    let instant_output = instant_engine
        .step(1000.0 / 120.0, &instant)
        .vertical
        .map_or(0, |pulse| pulse.units);

    assert!(
        animated_total.abs() > 480,
        "fixture must exceed the legacy clamp"
    );
    assert_eq!(
        instant_output, animated_total,
        "instant mode must emit the same quantized distance without a timed tail"
    );
    assert!(!instant_engine.has_pending_work());
}

#[cfg(not(windows))]
#[test]
fn instant_mode_preserves_legacy_clamp_and_drop() {
    let mut settings = AppSettings::default();
    settings.step_size_px = 500;
    let mut instant = EffectiveSettings::from_settings(&settings);
    instant.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();

    on_wheel(&mut engine, 1_200, 1_000, &instant);
    let output = engine
        .step(1000.0 / 120.0, &instant)
        .vertical
        .map_or(0, |pulse| pulse.units);

    assert_eq!(output, 480);
    assert!(!engine.has_pending_work());
    assert_eq!(
        engine.step(1000.0 / 120.0, &instant),
        EngineOutput::default(),
        "legacy instant overflow must be dropped rather than carried into a tail"
    );
}

#[test]
fn slow_notches_no_acceleration() {
    let eff = eff();
    let mut engine = SmoothScrollEngine::new();
    let now = 1_000;
    for i in 0..3 {
        engine.on_wheel_with_source(120, now + i as u64 * 500, InputSource::Wheel, &eff);
    }
    let total_v = drain_vertical(&mut engine, &eff);
    let abs = total_v.abs();
    assert!(
        (390..=510).contains(&abs),
        "slow notches should have minimal accel, got {}",
        abs
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
        vertical_units(out).abs() <= 480,
        "expected pulse clamp <= 480, got {}",
        vertical_units(out)
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
fn registered_horizontal_batch_drains_when_horizontal_smoothness_is_off() {
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
        total_v += vertical_units(out);
        total_h += horizontal_units(out);
        if !e.has_pending_work() && out == EngineOutput::default() {
            break;
        }
    }
    assert!(
        total_h.abs() > 0,
        "registered horizontal batch should drain"
    );
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
        total_v += vertical_units(out);
        total_h += horizontal_units(out);
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
        total += vertical_units(out);
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
        total += e.step(8.33, &eff).vertical.map_or(0, |pulse| pulse.units);
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
        total += vertical_units(out);
        if !e.has_pending_work() && vertical_units(out) == 0 {
            break;
        }
    }
    total
}

fn register_discrete(e: &mut SmoothScrollEngine, delta: i32, now_ms: u64) {
    let semantic = WheelSemantic {
        axis: WheelAxis::Vertical,
        modifiers: ModifierKeys::default(),
    };
    e.register(
        WheelInputEvent {
            delta,
            semantic,
            source: InputSource::Wheel,
        },
        WheelSequence {
            semantic,
            transport: WheelTransport::Native,
            strategy: SmoothingStrategy::DiscreteNotchPreserving,
            delta_transform: DeltaTransform::Generic { sign: 1 },
        },
        now_ms,
        &eff(),
    );
}

fn drain_discrete(e: &mut SmoothScrollEngine, settings: &EffectiveSettings) -> Vec<i32> {
    let mut pulses = Vec::new();
    for _ in 0..500 {
        if let Some(pulse) = e.step(1000.0 / 120.0, settings).vertical {
            pulses.push(pulse.units);
        }
        if !e.has_pending_work() {
            break;
        }
    }
    pulses
}

#[test]
fn one_discrete_notch_emits_exactly_one_notch() {
    let mut engine = SmoothScrollEngine::new();
    register_discrete(&mut engine, 120, 1_000);

    assert_eq!(drain_discrete(&mut engine, &eff()), vec![120]);
}

#[test]
fn discrete_strategy_never_emits_sub_notch_units() {
    let mut engine = SmoothScrollEngine::new();
    for (i, delta) in [40, 40, 40, 120, -120].into_iter().enumerate() {
        register_discrete(&mut engine, delta, 1_000 + i as u64 * 10);
    }

    let pulses = drain_discrete(&mut engine, &eff());
    assert!(pulses.iter().all(|units| units % 120 == 0));
    assert_eq!(pulses.iter().sum::<i32>(), 120);
}

#[test]
fn instant_discrete_output_keeps_whole_notch_total() {
    let mut settings = eff();
    settings.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();
    for i in 0..3 {
        register_discrete(&mut engine, 120, 1_000 + i * 10);
    }

    let pulse = engine.step(1000.0 / 120.0, &settings).vertical.unwrap();
    assert_eq!(pulse.units, 360);
    assert!(!engine.has_pending_work());
}

fn drain_first_vertical(
    e: &mut SmoothScrollEngine,
    eff: &EffectiveSettings,
) -> smoothscroll_core::wheel::SemanticPulse {
    for _ in 0..500 {
        if let Some(pulse) = e.step(1000.0 / 120.0, eff).vertical {
            return pulse;
        }
    }
    panic!("expected a vertical semantic pulse");
}

fn register_event(
    e: &mut SmoothScrollEngine,
    delta: i32,
    modifiers: ModifierKeys,
    source: InputSource,
    now_ms: u64,
    eff: &EffectiveSettings,
    transport: WheelTransport,
    transform: DeltaTransform,
) -> WheelSequence {
    let semantic = WheelSemantic {
        axis: WheelAxis::Vertical,
        modifiers,
    };
    let sequence = WheelSequence {
        semantic,
        transport,
        strategy: SmoothingStrategy::Continuous,
        delta_transform: transform,
    };
    e.register(
        WheelInputEvent {
            delta,
            semantic,
            source,
        },
        sequence,
        now_ms,
        eff,
    );
    sequence
}

#[test]
fn ctrl_tail_keeps_captured_ctrl_after_registration() {
    let eff = eff();
    let mut engine = SmoothScrollEngine::new();
    let sequence = register_event(
        &mut engine,
        120,
        ModifierKeys {
            ctrl: true,
            ..ModifierKeys::default()
        },
        InputSource::Wheel,
        1_000,
        &eff,
        WheelTransport::Native,
        DeltaTransform::CtrlZoom {
            sensitivity: 1.0,
            sign: 1,
        },
    );
    let pulse = drain_first_vertical(&mut engine, &eff);
    assert!(pulse.sequence.semantic.modifiers.ctrl);
    assert_eq!(pulse.sequence, sequence);
}

#[test]
fn semantic_change_resets_tail_and_cadence() {
    let eff = eff();
    let mut engine = SmoothScrollEngine::new();
    register_event(
        &mut engine,
        120,
        ModifierKeys::default(),
        InputSource::Wheel,
        1_000,
        &eff,
        WheelTransport::Native,
        DeltaTransform::Generic { sign: 1 },
    );
    register_event(
        &mut engine,
        120,
        ModifierKeys::default(),
        InputSource::Wheel,
        1_050,
        &eff,
        WheelTransport::Native,
        DeltaTransform::Generic { sign: 1 },
    );
    assert!(engine.last_velocity() > 0.0);

    let alt_sequence = register_event(
        &mut engine,
        120,
        ModifierKeys {
            alt: true,
            ..ModifierKeys::default()
        },
        InputSource::Wheel,
        1_100,
        &eff,
        WheelTransport::Native,
        DeltaTransform::Generic { sign: 1 },
    );

    assert_eq!(
        engine.active_sequence(WheelAxis::Vertical),
        Some(alt_sequence)
    );
    assert_eq!(engine.last_velocity(), 0.0);
    let mut pulses = Vec::new();
    for _ in 0..500 {
        if let Some(pulse) = engine.step(1000.0 / 120.0, &eff).vertical {
            pulses.push(pulse);
        }
        if !engine.has_pending_work() {
            break;
        }
    }
    assert!(pulses
        .iter()
        .all(|pulse| pulse.sequence.semantic.modifiers.alt));
}

#[test]
fn same_semantic_retains_acceleration_cadence() {
    let eff = eff();
    let mut engine = SmoothScrollEngine::new();
    for now_ms in [1_000, 1_050] {
        register_event(
            &mut engine,
            120,
            ModifierKeys {
                ctrl: true,
                ..ModifierKeys::default()
            },
            InputSource::Wheel,
            now_ms,
            &eff,
            WheelTransport::Native,
            DeltaTransform::CtrlZoom {
                sensitivity: 1.0,
                sign: 1,
            },
        );
    }
    assert!(engine.last_velocity() > 0.0);
}

#[test]
fn engine_semantics_cover_alt_ctrl_alt_high_res_and_compatibility_transport() {
    let eff = eff();
    let mut engine = SmoothScrollEngine::new();

    let ctrl_alt = register_event(
        &mut engine,
        120,
        ModifierKeys {
            ctrl: true,
            alt: true,
            ..ModifierKeys::default()
        },
        InputSource::HighResWheel,
        1_000,
        &eff,
        WheelTransport::Native,
        DeltaTransform::Generic { sign: 1 },
    );
    assert_eq!(engine.active_sequence(WheelAxis::Vertical), Some(ctrl_alt));

    let compat = register_event(
        &mut engine,
        120,
        ModifierKeys {
            shift: true,
            ..ModifierKeys::default()
        },
        InputSource::Wheel,
        1_050,
        &eff,
        WheelTransport::CompatibilityHorizontal,
        DeltaTransform::Generic { sign: -1 },
    );
    assert_eq!(
        engine.active_sequence(WheelAxis::Vertical),
        Some(compat),
        "a transport change must reset the previous owner"
    );
    assert_eq!(engine.last_velocity(), 0.0);
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
    assert!(vertical_units(out) != 0, "expected pulses on instant flush");
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
    assert_eq!(vertical_units(out), 0);
    assert_eq!(horizontal_units(out), 0);
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
        total_v += vertical_units(out);
    }
    assert!(total_v != 0, "no output produced from 10 wheel notches");
    assert!(
        total_v.abs() > 100,
        "expected meaningful output, got {total_v}"
    );
}

#[test]
fn velocity_tracking_smooth_acceleration() {
    let eff = eff();
    let mut engine = SmoothScrollEngine::new();
    let now = 1_000;
    engine.on_wheel_with_source(120, now, InputSource::Wheel, &eff);
    for i in 0..5 {
        engine.on_wheel_with_source(120, now + 50 + i as u64 * 50, InputSource::Wheel, &eff);
    }
    assert!(engine.has_pending_work());
}

#[test]
fn captured_animation_settings_survive_global_step_settings() {
    let profile = effective_with(50, smoothscroll_core::easing::EasingMode::Linear, 1, true);
    let global = effective_with(
        1500,
        smoothscroll_core::easing::EasingMode::QuinticOut,
        20,
        true,
    );
    let mut engine = SmoothScrollEngine::new();
    on_wheel(&mut engine, 120, 1000, &profile);

    let mut frames = 0;
    while engine.has_pending_work() && frames < 200 {
        engine.step(1000.0 / 120.0, &global);
        frames += 1;
    }
    assert!(frames < 45, "captured 50ms profile took {frames} frames");
}

#[test]
fn captured_tail_ratio_survives_global_step_ratio() {
    let profile = effective_with(
        500,
        smoothscroll_core::easing::EasingMode::ExponentialOut,
        1,
        true,
    );
    let global = effective_with(
        500,
        smoothscroll_core::easing::EasingMode::ExponentialOut,
        20,
        true,
    );
    let mut profile_engine = SmoothScrollEngine::new();
    let mut global_engine = SmoothScrollEngine::new();
    on_wheel(&mut profile_engine, 120, 1000, &profile);
    on_wheel(&mut global_engine, 120, 1000, &global);

    let mut profile_frames = 0;
    let mut global_frames = 0;
    while profile_engine.has_pending_work() && profile_frames < 300 {
        profile_engine.step(1000.0 / 120.0, &global);
        profile_frames += 1;
    }
    while global_engine.has_pending_work() && global_frames < 300 {
        global_engine.step(1000.0 / 120.0, &global);
        global_frames += 1;
    }
    assert!(
        profile_frames > global_frames * 2,
        "ratio 1 should drain slower: profile={profile_frames}, global={global_frames}"
    );
}
#[test]
fn captured_easing_mode_survives_global_step_settings() {
    let profile = effective_with(500, smoothscroll_core::easing::EasingMode::Linear, 5, true);
    let global = effective_with(
        500,
        smoothscroll_core::easing::EasingMode::QuinticOut,
        5,
        true,
    );
    let mut control = SmoothScrollEngine::new();
    let mut global_control = SmoothScrollEngine::new();
    let mut profile_registered = SmoothScrollEngine::new();
    on_wheel(&mut control, 120, 1000, &profile);
    on_wheel(&mut global_control, 120, 1000, &global);
    on_wheel(&mut profile_registered, 120, 1000, &profile);

    let mut expected = Vec::new();
    let mut global_schedule = Vec::new();
    let mut actual = Vec::new();
    for _ in 0..8 {
        expected.push(
            control
                .step(1000.0 / 120.0, &profile)
                .vertical
                .map_or(0, |pulse| pulse.units),
        );
        global_schedule.push(
            global_control
                .step(1000.0 / 120.0, &global)
                .vertical
                .map_or(0, |pulse| pulse.units),
        );
        actual.push(
            profile_registered
                .step(1000.0 / 120.0, &global)
                .vertical
                .map_or(0, |pulse| pulse.units),
        );
    }
    assert_ne!(
        expected, global_schedule,
        "profile and global easing controls must produce distinct schedules"
    );
    assert_eq!(
        actual, expected,
        "profile easing mode must survive global step settings"
    );
}

#[test]
fn mixed_profile_batches_keep_their_own_easing() {
    let fast = effective_with(50, smoothscroll_core::easing::EasingMode::Linear, 5, true);
    let slow = effective_with(
        1_500,
        smoothscroll_core::easing::EasingMode::Linear,
        5,
        true,
    );
    let global = effective_with(
        220,
        smoothscroll_core::easing::EasingMode::QuinticOut,
        5,
        true,
    );
    let mut engine = SmoothScrollEngine::new();

    on_wheel(&mut engine, 120, 1_000, &fast);
    on_wheel(&mut engine, 120, 1_100, &slow);

    let first = engine.step(50.0, &global);
    assert!(
        vertical_units(first) >= 120,
        "fast batch should drain first"
    );
    assert!(
        engine.has_pending_work(),
        "slow batch should remain pending"
    );
}

#[test]
fn touchpad_batch_keeps_captured_easing() {
    let profile = effective_with(50, smoothscroll_core::easing::EasingMode::Linear, 5, true);
    let global = effective_with(
        1_500,
        smoothscroll_core::easing::EasingMode::QuinticOut,
        5,
        true,
    );
    let mut engine = SmoothScrollEngine::new();

    engine.on_wheel_with_source(120, 1_000, InputSource::Touchpad, &profile);

    let mut frames = 0;
    while engine.has_pending_work() && frames < 200 {
        engine.step(1000.0 / 120.0, &global);
        frames += 1;
    }
    assert!(
        frames < 45,
        "captured 50ms touchpad batch took {frames} frames"
    );
}

#[test]
fn zoom_batch_keeps_captured_easing() {
    let profile = effective_with(50, smoothscroll_core::easing::EasingMode::Linear, 5, true);
    let global = effective_with(
        1_500,
        smoothscroll_core::easing::EasingMode::QuinticOut,
        5,
        true,
    );
    let mut profile_drained = SmoothScrollEngine::new();
    let mut global_drained = SmoothScrollEngine::new();
    let mut global_registered = SmoothScrollEngine::new();

    let (profile_event, profile_sequence) = zoom_sequence(&profile);
    profile_drained.register(profile_event, profile_sequence, 1_000, &profile);
    global_drained.register(profile_event, profile_sequence, 1_000, &profile);
    let (global_event, global_sequence) = zoom_sequence(&global);
    global_registered.register(global_event, global_sequence, 1_000, &global);

    let profile_output: Vec<_> = (0..8)
        .map(|_| {
            profile_drained
                .step(1000.0 / 120.0, &profile)
                .vertical
                .map_or(0, |pulse| pulse.units)
        })
        .collect();
    let global_output: Vec<_> = (0..8)
        .map(|_| {
            global_drained
                .step(1000.0 / 120.0, &global)
                .vertical
                .map_or(0, |pulse| pulse.units)
        })
        .collect();
    let control: Vec<_> = (0..8)
        .map(|_| {
            global_registered
                .step(1000.0 / 120.0, &global)
                .vertical
                .map_or(0, |pulse| pulse.units)
        })
        .collect();

    assert_eq!(profile_output, global_output);
    assert_ne!(profile_output, control);
}

#[test]
fn touchpad_zoom_batch_keeps_captured_easing() {
    let profile = effective_with(50, smoothscroll_core::easing::EasingMode::Linear, 5, true);
    let global = effective_with(
        1_500,
        smoothscroll_core::easing::EasingMode::QuinticOut,
        5,
        true,
    );
    let mut profile_drained = SmoothScrollEngine::new();
    let mut global_drained = SmoothScrollEngine::new();
    let mut global_registered = SmoothScrollEngine::new();

    let (mut profile_event, profile_sequence) = zoom_sequence(&profile);
    profile_event.source = InputSource::Touchpad;
    profile_drained.register(profile_event, profile_sequence, 1_000, &profile);
    global_drained.register(profile_event, profile_sequence, 1_000, &profile);
    let (mut global_event, global_sequence) = zoom_sequence(&global);
    global_event.source = InputSource::Touchpad;
    global_registered.register(global_event, global_sequence, 1_000, &global);

    let profile_output: Vec<_> = (0..8)
        .map(|_| {
            profile_drained
                .step(1000.0 / 120.0, &profile)
                .vertical
                .map_or(0, |pulse| pulse.units)
        })
        .collect();
    let global_output: Vec<_> = (0..8)
        .map(|_| {
            global_drained
                .step(1000.0 / 120.0, &global)
                .vertical
                .map_or(0, |pulse| pulse.units)
        })
        .collect();
    let control: Vec<_> = (0..8)
        .map(|_| {
            global_registered
                .step(1000.0 / 120.0, &global)
                .vertical
                .map_or(0, |pulse| pulse.units)
        })
        .collect();

    assert_eq!(profile_output, global_output);
    assert_ne!(profile_output, control);
}

#[test]
fn instant_mode_flushes_mixed_scroll_batches() {
    let fast = effective_with(50, smoothscroll_core::easing::EasingMode::Linear, 5, true);
    let slow = effective_with(
        1_500,
        smoothscroll_core::easing::EasingMode::Linear,
        5,
        true,
    );
    let mut instant = eff();
    let mut engine = SmoothScrollEngine::new();
    on_wheel(&mut engine, 120, 0, &fast);
    on_wheel(&mut engine, 120, 100, &slow);

    instant.instant_mode = true;
    let out = engine.step(1000.0 / 120.0, &instant);
    assert_eq!(
        vertical_units(out),
        288,
        "instant mode should flush both batches"
    );
    assert!(!engine.has_pending_work());
}

#[test]
fn reset_sequence_clears_pending_velocity_and_notch_timing() {
    let settings = eff();
    let mut engine = SmoothScrollEngine::new();

    on_wheel(&mut engine, 120, 1_000, &settings);
    on_wheel(&mut engine, 120, 1_050, &settings);
    on_wheel(&mut engine, 120, 1_100, &settings);
    assert!(engine.has_pending_work());
    assert!(engine.last_velocity() > 0.0);

    engine.reset_sequence();

    assert!(!engine.has_pending_work());
    assert_eq!(engine.last_velocity(), 0.0);

    let mut fresh = SmoothScrollEngine::new();
    on_wheel(&mut engine, 120, 1_150, &settings);
    on_wheel(&mut fresh, 120, 1_150, &settings);

    assert_eq!(
        drain_vertical(&mut engine, &settings),
        drain_vertical(&mut fresh, &settings),
        "the first notch after reset must behave like a fresh sequence"
    );
}

#[test]
fn reset_axes_clears_all_pending_batches() {
    let settings = eff();
    let mut engine = SmoothScrollEngine::new();
    on_wheel(&mut engine, 120, 0, &settings);
    on_hwheel(&mut engine, 120, 0, &settings);
    let (event, sequence) = zoom_sequence(&settings);
    engine.register(event, sequence, 0, &settings);
    assert!(engine.has_pending_work());

    engine.reset_axes();
    assert!(!engine.has_pending_work());
    assert_eq!(
        engine.step(1000.0 / 120.0, &settings),
        EngineOutput::default()
    );
}
