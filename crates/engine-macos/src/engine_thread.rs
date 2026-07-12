use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const IDLE_TIMEOUT: Duration = Duration::from_secs(2);
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

fn worker(state: Arc<AppState>, frame_ms: f64) {
    let mut last_frame = Instant::now();
    let mut last_work = Instant::now();

    loop {
        if !state.enabled.load(Ordering::Relaxed) {
            let mut flag = state.engine_signal.mutex.lock();
            if !*flag {
                state.engine_signal.cv.wait_for(&mut flag, IDLE_TIMEOUT);
            }
            if !state.enabled.load(Ordering::Relaxed) {
                continue;
            }
            *flag = false;
            last_frame = Instant::now();
            last_work = Instant::now();
        }

        let now = Instant::now();
        let elapsed = now.duration_since(last_frame).as_secs_f64() * 1000.0;

        if elapsed >= frame_ms {
            let eff = state.effective.load();
            let has_work = {
                let mut engine = state.engine.lock();
                let output = engine.step(elapsed, &eff);

                // Route output to platform wheel emitter
                if output.vertical != 0 || output.horizontal != 0 {
                    let _ = state.emitter.emit(output.vertical, output.horizontal);
                }
                if output.zoom != 0 {
                    let _ = state.zoom_emitter.emit_zoom(output.zoom);
                }

                engine.has_pending_work()
            };

            if has_work {
                last_work = now;
            }

            if now.duration_since(last_work) > IDLE_TIMEOUT {
                state.enabled.store(false, Ordering::Relaxed);
                continue;
            }

            last_frame = now;
        }

        let sleep_ms = if state.enabled.load(Ordering::Relaxed) {
            (frame_ms - (Instant::now().duration_since(last_frame).as_secs_f64() * 1000.0)).max(0.1)
        } else {
            WAIT_TIMEOUT.as_secs_f64() * 1000.0
        };
        thread::sleep(Duration::from_secs_f64(sleep_ms / 1000.0));
    }
}
