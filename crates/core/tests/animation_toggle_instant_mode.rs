use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};

#[test]
fn instant_mode_flushes_zoom_without_leaving_pending_work() {
    let settings = AppSettings::default();
    let mut effective = EffectiveSettings::from_settings(&settings);
    effective.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();

    engine.on_wheel_zoom(120, 0, InputSource::Wheel, &effective);
    assert!(engine.has_pending_work());

    let output = engine.step(1000.0 / 120.0, &effective);

    assert_ne!(
        output.zoom, 0,
        "instant mode must emit the queued zoom input"
    );
    assert!(
        !engine.has_pending_work(),
        "instant mode must not leave a zoom animation tail"
    );
}

#[test]
fn instant_mode_flushes_scroll_axes_without_leaving_pending_work() {
    let settings = AppSettings::default();
    let mut effective = EffectiveSettings::from_settings(&settings);
    effective.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();

    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &effective);
    engine.on_hwheel_with_source(120, 0, InputSource::Wheel, &effective);
    assert!(engine.has_pending_work());

    let output = engine.step(1000.0 / 120.0, &effective);

    assert_ne!(output.vertical, 0);
    assert_ne!(output.horizontal, 0);
    assert!(!engine.has_pending_work());
    assert_eq!(
        engine.step(1000.0 / 120.0, &effective),
        smoothscroll_core::engine::EngineOutput::default(),
        "a later timed frame must not be needed to recover instant distance"
    );
}
