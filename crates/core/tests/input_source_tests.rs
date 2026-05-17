use smoothscroll_core::input_source::{InputClassifier, InputSource};

#[test]
fn standard_wheel_event_is_wheel() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(120, 1000), InputSource::Wheel);
    assert_eq!(c.classify(-120, 1100), InputSource::Wheel);
}

#[test]
fn small_delta_alone_is_high_res_wheel() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(30, 1000), InputSource::HighResWheel);
}

#[test]
fn high_frequency_small_delta_is_touchpad() {
    let mut c = InputClassifier::new();
    for i in 0..7 {
        c.classify(20, 1000 + i * 20);
    }
    assert_eq!(c.classify(20, 1140), InputSource::Touchpad);
}

#[test]
fn old_events_drop_out_of_window() {
    let mut c = InputClassifier::new();
    for i in 0..6 {
        c.classify(20, 1000 + i * 20);
    }
    assert_eq!(c.classify(20, 2000), InputSource::HighResWheel);
}

#[test]
fn zero_delta_is_wheel_default() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(0, 1000), InputSource::Wheel);
}
