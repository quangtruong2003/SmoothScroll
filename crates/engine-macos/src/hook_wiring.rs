use crate::state::AppState;
use smoothscroll_platform::traits::{HookEventSink, InputSourceLabel};
use std::sync::Arc;

#[derive(Clone)]
pub struct EngineSink {
    state: Arc<AppState>,
}

impl EngineSink {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }
}

impl HookEventSink for EngineSink {
    fn on_wheel(&self, delta: smoothscroll_platform::types::WheelDelta, is_precise: bool) {
        if is_precise {
            return;
        }
        let mut engine = self.state.engine.lock();
        engine.submit_scroll(delta.y);
        self.state.engine_signal.signal();
    }

    fn install_input_source_emitter(&self, _callback: Box<dyn Fn(InputSourceLabel) + Send + Sync>) {}
}
