use crate::state::AppState;
use smoothscroll_platform::traits::{HookDecision, HookEventSink, ModifierKeys};
use smoothscroll_platform::types::InputSource;
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
    fn on_wheel(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        self.on_wheel_ext(delta, mods, InputSource::Wheel)
    }

    fn on_hwheel(&self, delta: i32) -> HookDecision {
        self.on_hwheel_ext(delta, InputSource::Wheel)
    }

    fn on_wheel_ext(
        &self,
        delta: i32,
        _mods: ModifierKeys,
        source: InputSource,
    ) -> HookDecision {
        if !self.state.enabled.load(std::sync::atomic::Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let eff = self.state.effective.load();
        let mut engine = self.state.engine.lock();
        engine.on_wheel_with_source(delta, now_ms, source, &eff);
        self.state.engine_signal.signal();
        HookDecision::Block
    }

    fn on_hwheel_ext(
        &self,
        delta: i32,
        source: InputSource,
    ) -> HookDecision {
        if !self.state.enabled.load(std::sync::atomic::Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let eff = self.state.effective.load();
        let mut engine = self.state.engine.lock();
        engine.on_hwheel_with_source(delta, now_ms, source, &eff);
        self.state.engine_signal.signal();
        HookDecision::Block
    }
}
