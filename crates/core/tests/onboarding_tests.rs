use smoothscroll_core::onboarding::{apply_preset, Feel, UseCase};
use smoothscroll_core::settings::AppSettings;

#[test]
fn coder_balanced_keeps_modifier_passthrough_on() {
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::Coder, Feel::Balanced);
    assert!(s.modifier_passthrough.ctrl);
    assert!(s.modifier_passthrough.alt);
}

#[test]
fn designer_glide_uses_smaller_step_and_enables_passthrough() {
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::Designer, Feel::Glide);
    assert_eq!(s.step_size_px, 80);
    assert!(s.modifier_passthrough.ctrl);
    assert!(s.modifier_passthrough.alt);
}

#[test]
fn reader_snappy_increases_step_and_reduces_time() {
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::Reader, Feel::Snappy);
    assert!(s.step_size_px > 120);
    assert!(s.animation_time_ms < 360);
}

#[test]
fn general_balanced_matches_default_baseline() {
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::General, Feel::Balanced);
    assert_eq!(s.step_size_px, 144);
    assert_eq!(s.animation_time_ms, 220);
    assert_eq!(s.acceleration_max, 10);
}

#[test]
fn apply_preset_does_not_set_completed_timestamp() {
    // Stamping is the caller's responsibility (the IPC command).
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::General, Feel::Balanced);
    assert!(s.onboarding_completed_at.is_none());
}

#[test]
fn all_twelve_combinations_produce_clamp_safe_settings() {
    let cases = [
        (UseCase::Reader, Feel::Glide),
        (UseCase::Reader, Feel::Balanced),
        (UseCase::Reader, Feel::Snappy),
        (UseCase::Coder, Feel::Glide),
        (UseCase::Coder, Feel::Balanced),
        (UseCase::Coder, Feel::Snappy),
        (UseCase::Designer, Feel::Glide),
        (UseCase::Designer, Feel::Balanced),
        (UseCase::Designer, Feel::Snappy),
        (UseCase::General, Feel::Glide),
        (UseCase::General, Feel::Balanced),
        (UseCase::General, Feel::Snappy),
    ];
    for (uc, feel) in cases {
        let mut s = AppSettings::default();
        apply_preset(&mut s, uc, feel);
        let before = s.clone();
        s.clamp();
        // After clamp, key fields shouldn't have changed — preset values are
        // already inside legal ranges.
        assert_eq!(
            s.step_size_px, before.step_size_px,
            "preset {uc:?}/{feel:?} step_size_px out of range"
        );
        assert_eq!(
            s.animation_time_ms, before.animation_time_ms,
            "preset {uc:?}/{feel:?} animation_time_ms out of range"
        );
    }
}
