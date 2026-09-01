use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
use smoothscroll_core::wheel::{
    DeltaTransform, ModifierKeys, SmoothingStrategy, WheelAxis, WheelInputEvent, WheelSemantic,
    WheelSequence, WheelTransport,
};

fn ctrl_sequence() -> (WheelInputEvent, WheelSequence) {
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
                sensitivity: 1.0,
                sign: 1,
            },
        },
    )
}

#[test]
fn instant_mode_flushes_ctrl_semantic_without_leaving_pending_work() {
    let settings = AppSettings::default();
    let mut effective = EffectiveSettings::from_settings(&settings);
    effective.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();
    let (event, sequence) = ctrl_sequence();
    engine.register(event, sequence, 0, &effective);

    let output = engine.step(1000.0 / 120.0, &effective);
    let pulse = output.vertical.expect("instant mode must emit Ctrl pulse");
    assert_ne!(pulse.units, 0);
    assert!(pulse.sequence.semantic.modifiers.ctrl);
    assert!(!engine.has_pending_work());
    engine.finish_axis_pulse(WheelAxis::Vertical, sequence);
    assert_eq!(engine.active_sequence(WheelAxis::Vertical), None);
}

#[test]
fn instant_mode_flushes_scroll_axes_without_leaving_pending_work() {
    let settings = AppSettings::default();
    let mut effective = EffectiveSettings::from_settings(&settings);
    effective.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();

    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &effective);
    engine.on_hwheel_with_source(120, 0, InputSource::Wheel, &effective);

    let output = engine.step(1000.0 / 120.0, &effective);
    assert_ne!(output.vertical.expect("vertical pulse").units, 0);
    assert_ne!(output.horizontal.expect("horizontal pulse").units, 0);
    assert!(!engine.has_pending_work());
    assert_eq!(
        engine.step(1000.0 / 120.0, &effective),
        smoothscroll_core::engine::EngineOutput::default(),
        "a later timed frame must not be needed to recover instant distance"
    );
}
