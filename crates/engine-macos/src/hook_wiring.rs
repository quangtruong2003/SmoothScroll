use crate::state::AppState;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_platform::traits::HookEventSink;
use smoothscroll_platform::types::{HookDecision, ModifierKeys};
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

    fn on_wheel_ext(&self, delta: i32, mods: ModifierKeys, source: InputSource) -> HookDecision {
        if !self
            .state
            .enabled
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return HookDecision::Pass;
        }

        let eff = self.state.effective.load();
        let precision = (mods.cmd && eff.modifier_ctrl_passthrough)
            || (mods.alt && eff.modifier_alt_passthrough);
        if precision {
            if eff.modifier_clear_inertia {
                self.state.engine.lock().reset_axes();
            }
            return HookDecision::Pass;
        }

        if mods.cmd && !eff.smooth_zoom {
            return HookDecision::Pass;
        }
        if mods.shift && !eff.horizontal_smoothness {
            return HookDecision::Pass;
        }

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let mut engine = self.state.engine.lock();
        if mods.cmd {
            engine.on_wheel_zoom(delta, now_ms, source, &eff);
        } else if mods.shift {
            let delta = if eff.horizontal_invert { -delta } else { delta };
            engine.on_hwheel_with_source(delta, now_ms, source, &eff);
        } else {
            engine.on_wheel_with_source(delta, now_ms, source, &eff);
        }
        drop(engine);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }

    fn on_hwheel_ext(&self, delta: i32, source: InputSource) -> HookDecision {
        if !self
            .state
            .enabled
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return HookDecision::Pass;
        }
        let eff = self.state.effective.load();
        if !eff.horizontal_smoothness {
            return HookDecision::Pass;
        }
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let mut engine = self.state.engine.lock();
        let delta = if eff.horizontal_invert { -delta } else { delta };
        engine.on_hwheel_with_source(delta, now_ms, source, &eff);
        drop(engine);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }
}
