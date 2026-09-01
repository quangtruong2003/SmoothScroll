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
    stop: Arc<std::sync::atomic::AtomicBool>,
}

impl EngineThread {
    pub fn spawn(state: Arc<AppState>, frame_ms: f64) -> Self {
        let s = state.clone();
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let worker_stop = stop.clone();
        let handle = thread::Builder::new()
            .name("ss-engine".into())
            .spawn(move || worker(s, frame_ms, worker_stop))
            .expect("spawn engine thread");
        Self {
            handle: Some(handle),
            state,
            stop,
        }
    }
}

impl Drop for EngineThread {
    fn drop(&mut self) {
        self.state.enabled.store(false, Ordering::Relaxed);
        self.stop.store(true, Ordering::Release);
        self.state.engine_signal.signal();
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

fn worker(state: Arc<AppState>, frame_ms: f64, stop: Arc<std::sync::atomic::AtomicBool>) {
    let mut last_frame = Instant::now();
    let mut last_work = Instant::now();

    loop {
        if stop.load(Ordering::Acquire) {
            break;
        }
        if !state.enabled.load(Ordering::Relaxed) {
            let mut flag = state.engine_signal.mutex.lock();
            if !*flag {
                state.engine_signal.cv.wait_for(&mut flag, IDLE_TIMEOUT);
            }
            if stop.load(Ordering::Acquire) {
                break;
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

                let vertical = output.vertical.map_or(0, |pulse| pulse.units);
                let horizontal = output.horizontal.map_or(0, |pulse| pulse.units);
                if vertical != 0 || horizontal != 0 {
                    let _ = state.emitter.emit(vertical, horizontal);
                    if let Some(pulse) = output.vertical {
                        engine.finish_axis_pulse(
                            smoothscroll_core::wheel::WheelAxis::Vertical,
                            pulse.sequence,
                        );
                    }
                    if let Some(pulse) = output.horizontal {
                        engine.finish_axis_pulse(
                            smoothscroll_core::wheel::WheelAxis::Horizontal,
                            pulse.sequence,
                        );
                    }
                }

                engine.has_pending_work()
            };

            if has_work {
                last_work = now;
            }

            if now.duration_since(last_work) > IDLE_TIMEOUT {
                let mut flag = state.engine_signal.mutex.lock();
                if !*flag {
                    state.engine_signal.cv.wait_for(&mut flag, WAIT_TIMEOUT);
                }
                *flag = false;
                last_frame = Instant::now();
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
