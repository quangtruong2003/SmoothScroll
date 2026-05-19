//! Polling thread that drives edge auto-scroll. Samples cursor/window
//! geometry at ~60Hz, computes a velocity via the core's pure function, and
//! feeds accumulated notches into the engine.

use crate::state::AppState;
use smoothscroll_core::constants::WHEEL_DELTA;
use smoothscroll_core::edge_scroll::compute_velocity;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

pub fn spawn(state: Arc<AppState>) -> thread::JoinHandle<()> {
    thread::Builder::new()
        .name("ss-edge-scroll".into())
        .spawn(move || run(state))
        .expect("spawn edge-scroll thread")
}

fn run(state: Arc<AppState>) {
    let epoch = Instant::now();
    let mut last_emit = Instant::now();
    let mut accumulated = 0.0f64;

    loop {
        thread::sleep(Duration::from_millis(16));
        let s = state.settings.read();
        if !state.enabled.load(Ordering::Relaxed) || !s.edge_scroll_enabled {
            accumulated = 0.0;
            drop(s);
            thread::sleep(Duration::from_millis(100));
            continue;
        }
        let zone = s.edge_scroll_zone_px;
        let max_speed = s.edge_scroll_max_notches_per_sec;
        drop(s);

        let Some((pt, rect)) = state.window_geom.cursor_in_window() else {
            accumulated = 0.0;
            continue;
        };
        let v = compute_velocity(pt.y, rect.top, rect.bottom, zone, max_speed);
        if v == 0.0 {
            accumulated = 0.0;
            continue;
        }

        let now = Instant::now();
        let dt = now.duration_since(last_emit).as_secs_f64();
        last_emit = now;
        accumulated += v * dt;

        if accumulated.abs() >= 1.0 {
            let notches = accumulated.trunc() as i32;
            accumulated -= notches as f64;
            let delta = notches * WHEEL_DELTA;
            let now_ms = epoch.elapsed().as_millis() as u64;
            let eff = state.effective.load_full();
            state.engine.lock().on_wheel_with_source(
                delta,
                now_ms,
                smoothscroll_core::input_source::InputSource::Wheel,
                &eff,
            );
            state.engine_signal.signal();
        }
    }
}
