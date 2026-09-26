use smoothscroll_core::input_source::{InputClassifier, InputSource};

#[test]
fn whole_notch_is_wheel_and_clears_evidence() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(120, false), InputSource::Wheel);
    assert_eq!(c.classify(-240, false), InputSource::Wheel);
}

#[test]
fn touch_marker_wins_per_message() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(120, true), InputSource::Touchpad);
    // The next unmarked message is judged on its own evidence.
    assert_eq!(c.classify(120, false), InputSource::Wheel);
}

#[test]
fn two_magnitudes_lock_touchpad_for_the_gesture() {
    let mut c = InputClassifier::new();
    for i in 0..3 {
        c.classify(20 + i, false); // 20, 21, 22 → distinct magnitudes
    }
    assert_eq!(c.classify(20, false), InputSource::Touchpad);
    // Even a now-regular value stays touchpad until a whole notch resets.
    assert_eq!(c.classify(20, false), InputSource::Touchpad);
    assert_eq!(c.classify(120, false), InputSource::Wheel);
}

#[test]
fn fixed_magnitude_is_free_spin_and_smooths_like_high_res() {
    let mut c = InputClassifier::new();
    // Fewer than 3 samples: not enough evidence — keep the previous verdict.
    c.classify(15, false);
    c.classify(15, false);
    // One fixed magnitude = flywheel through detents = free-spinning wheel.
    assert_eq!(c.classify(15, false), InputSource::HighResWheel);
    assert_eq!(c.classify(15, false), InputSource::HighResWheel);
}

#[test]
fn too_few_samples_keeps_the_previous_verdict() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(120, false), InputSource::Wheel);
    assert_eq!(c.classify(15, false), InputSource::Wheel); // 1 sub-notch sample
}

#[test]
fn zero_delta_repeats_the_last_verdict() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(0, false), InputSource::Wheel);
    assert_eq!(c.classify(120, true), InputSource::Touchpad);
    assert_eq!(c.classify(0, false), InputSource::Touchpad);
}
