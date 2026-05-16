#![allow(clippy::field_reassign_with_default)]

use smoothscroll_core::easing::EasingMode;
use smoothscroll_core::settings::AppSettings;

#[test]
fn defaults_are_unchanged_after_clamp() {
    let mut s = AppSettings::default();
    let before = s.clone();
    s.clamp();
    assert_eq!(s, before);
}

#[test]
fn step_size_below_min_is_clamped_up() {
    let mut s = AppSettings::default();
    s.step_size_px = 0;
    s.clamp();
    assert_eq!(s.step_size_px, 10);
}

#[test]
fn step_size_above_max_is_clamped_down() {
    let mut s = AppSettings::default();
    s.step_size_px = 9999;
    s.clamp();
    assert_eq!(s.step_size_px, 500);
}

#[test]
fn animation_time_clamps_to_inclusive_range() {
    let mut s = AppSettings::default();
    s.animation_time_ms = 0;
    s.clamp();
    assert_eq!(s.animation_time_ms, 10);

    s.animation_time_ms = 99_999;
    s.clamp();
    assert_eq!(s.animation_time_ms, 2000);
}

#[test]
fn acceleration_delta_clamps_to_zero_through_500() {
    let mut s = AppSettings::default();
    s.acceleration_delta_ms = -50;
    s.clamp();
    assert_eq!(s.acceleration_delta_ms, 0);

    s.acceleration_delta_ms = 9_999;
    s.clamp();
    assert_eq!(s.acceleration_delta_ms, 500);
}

#[test]
fn acceleration_max_minimum_is_one() {
    let mut s = AppSettings::default();
    s.acceleration_max = 0;
    s.clamp();
    assert_eq!(s.acceleration_max, 1);

    s.acceleration_max = 1000;
    s.clamp();
    assert_eq!(s.acceleration_max, 20);
}

#[test]
fn tail_to_head_ratio_clamps_to_one_through_twenty() {
    let mut s = AppSettings::default();
    s.tail_to_head_ratio = -3;
    s.clamp();
    assert_eq!(s.tail_to_head_ratio, 1);

    s.tail_to_head_ratio = 1000;
    s.clamp();
    assert_eq!(s.tail_to_head_ratio, 20);
}

#[test]
fn unknown_language_falls_back_to_en() {
    let mut s = AppSettings::default();
    s.language = "klingon".to_string();
    s.clamp();
    assert_eq!(s.language, "en");
}

#[test]
fn known_languages_are_preserved() {
    for lang in ["en", "vi", "zh"] {
        let mut s = AppSettings::default();
        s.language = lang.to_string();
        s.clamp();
        assert_eq!(s.language, lang);
    }
}

#[test]
fn easing_mode_round_trips_through_serde() {
    let modes = [
        EasingMode::Linear,
        EasingMode::CubicOut,
        EasingMode::QuinticOut,
        EasingMode::ExponentialOut,
    ];
    for m in modes {
        let mut s = AppSettings::default();
        s.easing_mode = m;
        let json = serde_json::to_string(&s).unwrap();
        let parsed: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.easing_mode, m);
    }
}

#[test]
fn missing_fields_in_json_use_defaults() {
    let json = r#"{ "step_size_px": 200 }"#;
    let s: AppSettings = serde_json::from_str(json).unwrap();
    assert_eq!(s.step_size_px, 200);
    assert_eq!(s.animation_time_ms, 360);
    assert!(s.enabled);
}

#[test]
fn is_excluded_is_case_insensitive() {
    let mut s = AppSettings::default();
    s.excluded_apps.push("notepad".to_string());
    assert!(s.is_excluded("Notepad"));
    assert!(s.is_excluded("NOTEPAD"));
    assert!(!s.is_excluded("vscode"));
    assert!(!s.is_excluded(""));
}
