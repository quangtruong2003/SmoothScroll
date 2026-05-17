//! Edge auto-scroll velocity computation. Pure function, no I/O.

pub fn compute_velocity(
    cursor_y: i32,
    window_top: i32,
    window_bottom: i32,
    zone_size_px: i32,
    max_speed: f64,
) -> f64 {
    if cursor_y < window_top || cursor_y > window_bottom {
        return 0.0;
    }
    if zone_size_px <= 0 || max_speed <= 0.0 {
        return 0.0;
    }
    let from_top = cursor_y - window_top;
    let from_bot = window_bottom - cursor_y;

    if from_top < zone_size_px {
        let intensity = 1.0 - (from_top as f64 / zone_size_px as f64);
        -max_speed * intensity * intensity
    } else if from_bot < zone_size_px {
        let intensity = 1.0 - (from_bot as f64 / zone_size_px as f64);
        max_speed * intensity * intensity
    } else {
        0.0
    }
}
