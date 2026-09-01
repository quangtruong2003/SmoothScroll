use crate::state::AppState;
use smoothscroll_platform::traits::HookEventSink;
use smoothscroll_platform::types::{HookDecision, WheelAxis, WheelInputEvent};
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
    fn on_wheel_event(&self, event: WheelInputEvent) -> HookDecision {
        if !self
            .state
            .enabled
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return HookDecision::Pass;
        }

        let eff = self.state.effective.load();
        let mods = event.semantic.modifiers;
        let precision = (mods.cmd && eff.modifier_ctrl_passthrough)
            || (mods.alt && eff.modifier_alt_passthrough);
        if precision {
            if eff.modifier_clear_inertia {
                self.state.engine.lock().reset_axes();
            }
            return HookDecision::Pass;
        }

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let mut engine = self.state.engine.lock();
        match event.semantic.axis {
            WheelAxis::Vertical => {
                if mods.cmd && !eff.smooth_zoom {
                    return HookDecision::Pass;
                }
                if mods.shift && !eff.horizontal_smoothness {
                    return HookDecision::Pass;
                }
                if mods.cmd {
                    engine.on_wheel_zoom(event.delta, now_ms, event.source, &eff);
                } else if mods.shift {
                    let delta = if eff.horizontal_invert {
                        -event.delta
                    } else {
                        event.delta
                    };
                    engine.on_hwheel_with_source(delta, now_ms, event.source, &eff);
                } else {
                    engine.on_wheel_with_source(event.delta, now_ms, event.source, &eff);
                }
            }
            WheelAxis::Horizontal => {
                if !eff.horizontal_smoothness {
                    return HookDecision::Pass;
                }
                let delta = if eff.horizontal_invert {
                    -event.delta
                } else {
                    event.delta
                };
                engine.on_hwheel_with_source(delta, now_ms, event.source, &eff);
            }
        }
        drop(engine);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }
}
