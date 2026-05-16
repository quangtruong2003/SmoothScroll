use approx::assert_relative_eq;
use smoothscroll_core::easing::{compute_easing_fraction, EasingMode};

#[test]
fn linear_returns_dt_over_duration_when_easing_disabled() {
    let f = compute_easing_fraction(50.0, 200.0, EasingMode::ExponentialOut, 3.0, false);
    assert_relative_eq!(f, 0.25, epsilon = 1e-9);
}

#[test]
fn linear_clamps_to_one_when_dt_exceeds_duration() {
    let f = compute_easing_fraction(500.0, 200.0, EasingMode::Linear, 3.0, true);
    assert_relative_eq!(f, 1.0, epsilon = 1e-9);
}

#[test]
fn cubic_out_at_zero_returns_zero() {
    let f = compute_easing_fraction(0.0, 200.0, EasingMode::CubicOut, 3.0, true);
    assert_relative_eq!(f, 0.0, epsilon = 1e-9);
}

#[test]
fn cubic_out_at_full_returns_one() {
    let f = compute_easing_fraction(200.0, 200.0, EasingMode::CubicOut, 3.0, true);
    assert_relative_eq!(f, 1.0, epsilon = 1e-9);
}

#[test]
fn cubic_out_midpoint_matches_csharp_formula() {
    let f = compute_easing_fraction(100.0, 200.0, EasingMode::CubicOut, 3.0, true);
    assert_relative_eq!(f, 0.875, epsilon = 1e-9);
}

#[test]
fn quintic_out_midpoint_matches_csharp_formula() {
    let f = compute_easing_fraction(100.0, 200.0, EasingMode::QuinticOut, 3.0, true);
    assert_relative_eq!(f, 0.96875, epsilon = 1e-9);
}

#[test]
fn exponential_out_with_default_ratio_matches_csharp() {
    let f = compute_easing_fraction(100.0, 200.0, EasingMode::ExponentialOut, 3.0, true);
    let expected = 1.0 - (-2.5_f64).exp();
    assert_relative_eq!(f, expected, epsilon = 1e-9);
}

#[test]
fn exponential_out_higher_ratio_decays_faster() {
    let low = compute_easing_fraction(50.0, 200.0, EasingMode::ExponentialOut, 1.0, true);
    let high = compute_easing_fraction(50.0, 200.0, EasingMode::ExponentialOut, 10.0, true);
    assert!(
        high > low,
        "higher ratio should reach further by same dt: low={low}, high={high}"
    );
}

#[test]
fn duration_zero_does_not_panic_and_returns_one() {
    let f = compute_easing_fraction(50.0, 0.0, EasingMode::CubicOut, 3.0, true);
    assert!(f.is_finite());
    assert_relative_eq!(f, 1.0, epsilon = 1e-9);
}
