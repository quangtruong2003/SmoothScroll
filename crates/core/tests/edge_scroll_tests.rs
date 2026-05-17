use smoothscroll_core::edge_scroll::compute_velocity;

#[test]
fn middle_of_window_returns_zero() {
    let v = compute_velocity(500, 0, 1000, 40, 5.0);
    assert_eq!(v, 0.0);
}

#[test]
fn bottom_edge_returns_positive() {
    let v = compute_velocity(990, 0, 1000, 40, 5.0);
    assert!(v > 0.0);
}

#[test]
fn top_edge_returns_negative() {
    let v = compute_velocity(10, 0, 1000, 40, 5.0);
    assert!(v < 0.0);
}

#[test]
fn at_exact_edge_returns_max_speed() {
    let v = compute_velocity(1000, 0, 1000, 40, 5.0);
    assert!((v - 5.0).abs() < 0.01);
}

#[test]
fn outside_zone_returns_zero() {
    let v = compute_velocity(950, 0, 1000, 40, 5.0);
    assert_eq!(v, 0.0);
}

#[test]
fn velocity_is_quadratic() {
    let v = compute_velocity(980, 0, 1000, 40, 5.0);
    assert!((v - 1.25).abs() < 0.01);
}

#[test]
fn cursor_outside_window_returns_zero() {
    let v = compute_velocity(-10, 0, 1000, 40, 5.0);
    assert_eq!(v, 0.0);
}
