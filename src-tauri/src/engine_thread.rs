//! Dedicated 120fps engine thread. Sleeps on a Condvar when idle and is
//! woken whenever the hook registers a new notch.

use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const IDLE_TIMEOUT: Duration = Duration::from_secs(2);
const IDLE_FRAME_MS: f64 = 1000.0 / 60.0;
const WAIT_TIMEOUT: Duration = Duration::from_millis(100);

pub struct EngineThread {
    handle: Option<JoinHandle<()>>,
    state: Arc<AppState>,
}

impl EngineThread {
    pub fn spawn(state: Arc<AppState>, frame_ms: f64) -> Self {
        let s = state.clone();
        let handle = thread::Builder::new()
            .name("ss-engine".into())
            .spawn(move || worker(s, frame_ms))
            .expect("spawn engine thread");
        Self {
            handle: Some(handle),
            state,
        }
    }
}

impl Drop for EngineThread {
    fn drop(&mut self) {
        self.state.enabled.store(false, Ordering::Relaxed);
        self.state.engine_signal.signal();
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

#[allow(unused_assignments)]
fn worker(state: Arc<AppState>, frame_ms: f64) {
    let mut last_frame = Instant::now();
    let mut last_work = Instant::now();

    loop {
        // Fast idle: disabled AND no pending work.
        if !state.enabled.load(Ordering::Relaxed) {
            // Only lock once in this idle branch.
            if !state.engine.lock().has_pending_work() {
                let mut flag = state.engine_signal.mutex.lock();
                if !*flag {
                    state.engine_signal.cv.wait_for(&mut flag, WAIT_TIMEOUT);
                }
                *flag = false;
                // Re-check after wake.
                if !state.enabled.load(Ordering::Relaxed)
                    && !state.engine.lock().has_pending_work()
                {
                    continue;
                }
            }
        }

        // Idle while enabled but no work: wait for signal instead of spinning.
        if !state.engine.lock().has_pending_work() {
            let mut flag = state.engine_signal.mutex.lock();
            if !*flag {
                state.engine_signal.cv.wait_for(&mut flag, WAIT_TIMEOUT);
            }
            *flag = false;
            last_frame = Instant::now();
            continue;
        }

        last_work = Instant::now();
        let now = Instant::now();
        let dt_ms = now.saturating_duration_since(last_frame).as_secs_f64() * 1000.0;
        let dt_ms = dt_ms.max(1.0);
        last_frame = now;

        let frame_ms = adaptive_frame_ms(last_work, frame_ms);

        let eff = state.effective.load_full();
        let output = state.engine.lock().step(dt_ms, &eff);
        if output.vertical != 0 || output.horizontal != 0 {
            if let Err(e) = state.emitter.emit(output.vertical, output.horizontal) {
                tracing::warn!(error = %e, "wheel emit failed");
            }
        }
        if output.zoom != 0 {
            if let Err(e) = state.zoom_emitter.emit_zoom(output.zoom) {
                tracing::warn!(error = %e, "zoom emit failed");
            }
        }

        let elapsed = now.elapsed().as_secs_f64() * 1000.0;
        let sleep_ms = frame_ms - elapsed;
        if sleep_ms > 0.5 {
            thread::sleep(Duration::from_micros((sleep_ms * 1000.0) as u64));
        } else {
            thread::yield_now();
        }
    }
}

fn adaptive_frame_ms(last_work: Instant, frame_ms: f64) -> f64 {
    if last_work.elapsed() >= IDLE_TIMEOUT {
        IDLE_FRAME_MS
    } else {
        frame_ms
    }
}
