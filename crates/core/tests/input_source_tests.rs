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
    // Touchpad: 4+ events, 20ms intervals (50 events/sec, avg < 50ms)
    for i in 0..4 {
        c.classify(20, 1000 + i * 20);
    }
    assert_eq!(c.classify(20, 1080), InputSource::Touchpad);
}

#[test]
fn rapid_touchpad_detection() {
    let mut c = InputClassifier::new();
    // Rapid touchpad: 6 events at 15ms intervals
    for i in 0..6 {
        c.classify(30, 1000 + i * 15);
    }
    assert_eq!(c.classify(30, 1075), InputSource::Touchpad);
}

#[test]
fn slow_events_not_touchpad() {
    let mut c = InputClassifier::new();
    // Slow scrolling: 4 events at 100ms intervals (10 events/sec < 30)
    for i in 0..4 {
        c.classify(20, 1000 + i * 100);
    }
    assert_eq!(c.classify(20, 1300), InputSource::HighResWheel);
}

#[test]
fn old_events_drop_out_of_window() {
    let mut c = InputClassifier::new();
    for i in 0..6 {
        c.classify(20, 1000 + i * 20);
    }
    // After 300ms window, events have expired
    assert_eq!(c.classify(20, 2000), InputSource::HighResWheel);
}

#[test]
fn zero_delta_is_wheel_default() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(0, 1000), InputSource::Wheel);
}

#[test]
fn exact_notch_delta_is_wheel() {
    let mut c = InputClassifier::new();
    // Even with many rapid events, exact 120 delta = mouse wheel
    for i in 0..6 {
        c.classify(120, 1000 + i * 20);
    }
    assert_eq!(c.classify(120, 1100), InputSource::Wheel);
}
