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
fn max_velocity_clamps_to_5_through_50() {
    let mut s = AppSettings::default();
    s.max_velocity = 0.0;
    s.clamp();
    assert_eq!(s.max_velocity, 5.0);

    s.max_velocity = 99.0;
    s.clamp();
    assert_eq!(s.max_velocity, 50.0);
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
    for lang in [
        "en", "vi", "zh", "fr", "de", "hi", "id", "it", "ja", "ko", "pt-BR", "es", "tr", "ru",
    ] {
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
fn auto_disable_windows_apps_defaults_to_on() {
    let s = AppSettings::default();
    assert!(s.auto_disable_windows_apps);
}

#[test]
fn auto_disable_windows_apps_round_trips_via_json() {
    let mut s = AppSettings::default();
    s.auto_disable_windows_apps = false;
    let json = serde_json::to_string(&s).unwrap();
    let parsed: AppSettings = serde_json::from_str(&json).unwrap();
    assert!(!parsed.auto_disable_windows_apps);
}

#[test]
fn missing_fields_in_json_use_defaults() {
    let json = r#"{ "step_size_px": 200 }"#;
    let s: AppSettings = serde_json::from_str(json).unwrap();
    assert_eq!(s.step_size_px, 200);
    assert_eq!(s.animation_time_ms, 220);
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

#[test]
fn game_mode_defaults() {
    let s = AppSettings::default();
    assert!(s.game_mode_enabled);
    assert!(s
        .game_mode_known_apps
        .iter()
        .any(|g| g.eq_ignore_ascii_case("VALORANT.exe")));
    assert!(s.game_mode_known_apps.len() >= 20);
}

#[test]
fn edge_scroll_defaults_to_off() {
    let s = AppSettings::default();
    assert!(!s.edge_scroll_enabled);
    assert_eq!(s.edge_scroll_zone_px, 40);
    assert_eq!(s.edge_scroll_max_notches_per_sec, 5.0);
    assert!(!s.edge_scroll_modifier_required);
}

#[test]
fn edge_scroll_clamp_bounds_zone() {
    let mut s = AppSettings::default();
    s.edge_scroll_zone_px = 5;
    s.clamp();
    assert!(s.edge_scroll_zone_px >= 10);
    s.edge_scroll_zone_px = 9999;
    s.clamp();
    assert!(s.edge_scroll_zone_px <= 200);
}

#[test]
fn touchpad_defaults() {
    let s = AppSettings::default();
    assert!(s.touchpad_smoothing_enabled);
    assert_eq!(s.touchpad_pixel_multiplier, 1.0);
    assert_eq!(s.touchpad_acceleration_factor, 1.0);
}

#[test]
fn touchpad_clamp_bounds() {
    let mut s = AppSettings::default();
    s.touchpad_pixel_multiplier = 0.0;
    s.touchpad_acceleration_factor = -5.0;
    s.clamp();
    assert!(s.touchpad_pixel_multiplier >= 0.1);
    assert!(s.touchpad_acceleration_factor >= 0.0);
}

// EffectiveSettings tests

use smoothscroll_core::settings::{EffectiveSettings, ScrollProfile};

#[test]
fn effective_settings_from_settings_copies_all_fields() {
    let mut s = AppSettings::default();
    s.step_size_px = 240;
    s.animation_time_ms = 500;
    s.max_velocity = 15.0;
    s.acceleration_max = 10;
    s.tail_to_head_ratio = 5;
    s.animation_easing = false;
    s.easing_mode = EasingMode::CubicOut;
    s.reverse_wheel_direction = true;
    s.horizontal_smoothness = false;
    s.touchpad_smoothing_enabled = false;
    s.touchpad_pixel_multiplier = 1.5;
    s.touchpad_acceleration_factor = 2.0;

    let eff = EffectiveSettings::from_settings(&s);

    assert_eq!(eff.step_size_px, 240);
    assert_eq!(eff.animation_time_ms, 500);
    assert_eq!(eff.max_velocity, 15.0);
    assert_eq!(eff.acceleration_max, 10);
    assert_eq!(eff.tail_to_head_ratio, 5);
    assert!(!eff.animation_easing);
    assert_eq!(eff.easing_mode, EasingMode::CubicOut);
    assert!(eff.reverse_wheel_direction);
    assert!(!eff.horizontal_smoothness);
    assert!(!eff.touchpad_smoothing_enabled);
    assert_eq!(eff.touchpad_pixel_multiplier, 1.5);
    assert_eq!(eff.touchpad_acceleration_factor, 2.0);
}

#[test]
fn effective_settings_with_profile_uses_profile_overrides() {
    let s = AppSettings::default();
    let mut profile = ScrollProfile::new("test", "Test");
    profile.step_size_px = 300;
    profile.animation_time_ms = 800;
    profile.easing_mode = EasingMode::Linear;

    let eff = EffectiveSettings::with_profile(&s, &profile);

    assert_eq!(eff.step_size_px, 300);
    assert_eq!(eff.animation_time_ms, 800);
    assert_eq!(eff.easing_mode, EasingMode::Linear);
    assert_eq!(eff.touchpad_smoothing_enabled, s.touchpad_smoothing_enabled);
}

#[test]
fn effective_settings_is_copy() {
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    let eff2 = eff;
    assert_eq!(eff, eff2);
}

// QoL Gap #5 — Respect system Reduce Motion

#[test]
fn respect_reduce_motion_defaults_to_auto() {
    let s = smoothscroll_core::settings::AppSettings::default();
    assert_eq!(
        s.respect_reduce_motion,
        smoothscroll_core::settings::RespectReduceMotion::Auto
    );
}

#[test]
fn respect_reduce_motion_round_trips_via_json() {
    use smoothscroll_core::settings::{AppSettings, RespectReduceMotion};
    let mut s = AppSettings::default();
    s.respect_reduce_motion = RespectReduceMotion::Always;
    let json = serde_json::to_string(&s).unwrap();
    let back: AppSettings = serde_json::from_str(&json).unwrap();
    assert_eq!(back.respect_reduce_motion, RespectReduceMotion::Always);
}

#[test]
fn old_settings_without_respect_field_load_with_auto_default() {
    let json = r#"{"enabled": true}"#;
    let s: smoothscroll_core::settings::AppSettings = serde_json::from_str(json).unwrap();
    assert_eq!(
        s.respect_reduce_motion,
        smoothscroll_core::settings::RespectReduceMotion::Auto
    );
}

#[test]
fn effective_settings_default_instant_mode_false() {
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    assert!(!eff.instant_mode);
}

#[test]
fn default_has_horizontal_invert_false() {
    let s = AppSettings::default();
    assert!(!s.horizontal_invert);
}

#[test]
fn old_settings_without_horizontal_invert_default_to_false() {
    let json = r#"{"enabled": true}"#;
    let s: AppSettings = serde_json::from_str(json).unwrap();
    assert!(!s.horizontal_invert);
}

#[test]
fn horizontal_invert_round_trips_through_serde() {
    let mut s = AppSettings::default();
    s.horizontal_invert = true;
    let json = serde_json::to_string(&s).unwrap();
    let back: AppSettings = serde_json::from_str(&json).unwrap();
    assert!(back.horizontal_invert);
}

// --- Task 1: ScrollProfile.max_velocity ---

#[test]
fn scroll_profile_default_max_velocity() {
    let p = ScrollProfile::new("test-id", "Test");
    assert_eq!(p.max_velocity, 20);
}

#[test]
fn scroll_profile_clamp_clamps_max_velocity() {
    let mut p = ScrollProfile::new("a", "A");
    p.max_velocity = 10;
    p.clamp();
    assert_eq!(p.max_velocity, 10);

    p.max_velocity = 60;
    p.clamp();
    assert_eq!(p.max_velocity, 50);

    p.max_velocity = 1;
    p.clamp();
    assert_eq!(p.max_velocity, 5);
}

// --- Task 2: canonicalize_process_name ---

#[test]
fn canonicalize_process_name_strips_exe() {
    assert_eq!(AppSettings::canonicalize_process_name("Blender.EXE"), "blender");
}

#[test]
fn canonicalize_process_name_lowercases() {
    assert_eq!(AppSettings::canonicalize_process_name("BLENDER"), "blender");
}

#[test]
fn canonicalize_process_name_trims_whitespace() {
    assert_eq!(AppSettings::canonicalize_process_name(" blender "), "blender");
}

#[test]
fn canonicalize_process_name_collapses_whitespace() {
    assert_eq!(AppSettings::canonicalize_process_name("Foo Bar.exe"), "foo bar");
}

#[test]
fn canonicalize_process_name_preserves_unicode_lower() {
    assert_eq!(AppSettings::canonicalize_process_name("ỨngDụng"), "ứngdụng");
}

#[test]
fn canonicalize_process_name_empty_returns_empty() {
    assert_eq!(AppSettings::canonicalize_process_name(""), "");
}

// --- Task 3: app_profiles_lookup ---

#[test]
fn app_profiles_lookup_case_insensitive() {
    let mut s = AppSettings::default();
    // Insert canonical key (mimics post-migration or post-assign state)
    s.app_profiles.insert("blender".into(), "fast".into());
    assert_eq!(s.app_profiles_lookup("BLENDER"), Some("fast"));
    assert_eq!(s.app_profiles_lookup("blender.exe"), Some("fast"));
    assert_eq!(s.app_profiles_lookup(" Blender "), Some("fast"));
}

#[test]
fn app_profiles_lookup_missing() {
    let s = AppSettings::default();
    assert_eq!(s.app_profiles_lookup("chrome"), None);
}

#[test]
fn is_excluded_case_insensitive() {
    let mut s = AppSettings::default();
    s.app_profiles
        .insert("bad".into(), AppSettings::DISABLED_PROFILE_ID.to_string());
    assert!(s.is_excluded("bad"));
    assert!(s.is_excluded("BAD"));
    assert!(s.is_excluded("bad.exe"));
}
