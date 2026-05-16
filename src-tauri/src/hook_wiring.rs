//! Glue between the platform hook and our engine. Reads
//! `settings.shift_key_horizontal` to decide whether Shift+wheel becomes
//! a horizontal scroll.
//!
//! Lifecycle: the sink holds an `Arc<AppState>` to keep settings accessible.

use crate::state::AppState;
use smoothscroll_platform::traits::HookEventSink;
use smoothscroll_platform::types::{HookDecision, ModifierKeys};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Instant;

pub struct EngineSink {
    pub state: Arc<AppState>,
    pub epoch: Instant,
}

impl EngineSink {
    pub fn new(state: Arc<AppState>) -> Arc<Self> {
        Arc::new(Self {
            state,
            epoch: Instant::now(),
        })
    }

    fn now_ms(&self) -> u64 {
        self.epoch.elapsed().as_millis() as u64
    }

    fn is_excluded(&self) -> bool {
        let process_name = match self.state.processes.process_name_under_cursor() {
            Some(n) => n,
            None => return false,
        };
        self.state.settings.read().is_excluded(&process_name)
    }

    fn route_vertical(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        if self.is_excluded() {
            return HookDecision::Pass;
        }
        let (shift_to_horizontal, horizontal_smoothness) = {
            let s = self.state.settings.read();
            (s.shift_key_horizontal, s.horizontal_smoothness)
        };

        let now = self.now_ms();

        if mods.shift && shift_to_horizontal {
            if horizontal_smoothness {
                self.state.engine.lock().on_hwheel(delta, now);
                self.state.engine_signal.signal();
                HookDecision::Swallow
            } else {
                HookDecision::Pass
            }
        } else {
            self.state.engine.lock().on_wheel(delta, now);
            self.state.engine_signal.signal();
            HookDecision::Swallow
        }
    }

    fn route_horizontal(&self, delta: i32) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        if self.is_excluded() {
            return HookDecision::Pass;
        }
        let horizontal_smoothness = self.state.settings.read().horizontal_smoothness;
        if !horizontal_smoothness {
            return HookDecision::Pass;
        }
        let now = self.now_ms();
        self.state.engine.lock().on_hwheel(delta, now);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }
}

impl HookEventSink for EngineSink {
    fn on_wheel(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        self.route_vertical(delta, mods)
    }

    fn on_hwheel(&self, delta: i32) -> HookDecision {
        self.route_horizontal(delta)
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::field_reassign_with_default)]
    use super::*;
    use crate::state::EngineSignal;
    use parking_lot::{Mutex, RwLock};
    use smoothscroll_core::engine::SmoothScrollEngine;
    use smoothscroll_core::settings::AppSettings;
    use smoothscroll_platform::traits::{
        Autostart, HookEventSink, HookHandle, Hotkey, HotkeyHandle, MouseHook, ProcessInfo,
        ProcessQuery, WheelEmitter,
    };
    use smoothscroll_platform::types::{Accelerator, PlatformError, Result};
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;

    struct StubHook;
    impl MouseHook for StubHook {
        fn install(&self, _sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
            Ok(HookHandle::new(Box::new(())))
        }
    }
    struct StubEmitter;
    impl WheelEmitter for StubEmitter {
        fn emit(&self, _v: i32, _h: i32) -> Result<()> {
            Ok(())
        }
    }
    struct StubProcessQuery;
    impl ProcessQuery for StubProcessQuery {
        fn process_name_under_cursor(&self) -> Option<String> {
            None
        }
        fn foreground_process_id(&self) -> Option<u32> {
            None
        }
        fn list_visible_processes(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
    }
    struct StubAutostart;
    impl Autostart for StubAutostart {
        fn is_enabled(&self) -> bool {
            false
        }
        fn set(&self, _enabled: bool) -> Result<()> {
            Err(PlatformError::Unsupported)
        }
    }
    struct StubHotkey;
    impl Hotkey for StubHotkey {
        fn register(
            &self,
            _accel: Accelerator,
            _on_pressed: Box<dyn Fn() + Send + Sync>,
        ) -> Result<HotkeyHandle> {
            Ok(HotkeyHandle::new(Box::new(())))
        }
    }

    fn make_state(settings: AppSettings) -> Arc<AppState> {
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new(settings.clone()))),
            settings: Arc::new(RwLock::new(settings.clone())),
            mouse_hook: Arc::new(StubHook),
            emitter: Arc::new(StubEmitter),
            processes: Arc::new(StubProcessQuery),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
        })
    }

    struct StaticProcessQuery {
        name: Option<String>,
    }
    impl ProcessQuery for StaticProcessQuery {
        fn process_name_under_cursor(&self) -> Option<String> {
            self.name.clone()
        }
        fn foreground_process_id(&self) -> Option<u32> {
            None
        }
        fn list_visible_processes(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
    }

    fn make_state_with_process(settings: AppSettings, process_name: Option<&str>) -> Arc<AppState> {
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new(settings.clone()))),
            settings: Arc::new(RwLock::new(settings.clone())),
            mouse_hook: Arc::new(StubHook),
            emitter: Arc::new(StubEmitter),
            processes: Arc::new(StaticProcessQuery {
                name: process_name.map(|s| s.to_string()),
            }),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
        })
    }

    fn shift_only() -> ModifierKeys {
        ModifierKeys {
            shift: true,
            ctrl: false,
            alt: false,
        }
    }

    fn no_mods() -> ModifierKeys {
        ModifierKeys::default()
    }

    #[test]
    fn disabled_passes_everything_through() {
        let s = AppSettings::default();
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        state.enabled.store(false, Ordering::Relaxed);
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert_eq!(sink.on_wheel(120, shift_only()), HookDecision::Pass);
        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
    }

    #[test]
    fn shift_with_setting_on_swallows_and_routes_to_h() {
        let s = AppSettings::default();
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_wheel(120, shift_only());
        assert_eq!(decision, HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
        let mut h_total = 0;
        for _ in 0..500 {
            let out = state.engine.lock().step(1000.0 / 120.0);
            h_total += out.horizontal;
            if !state.engine.lock().has_pending_work() {
                break;
            }
        }
        assert!(h_total != 0, "expected horizontal emission, got 0");
    }

    #[test]
    fn shift_with_setting_off_routes_to_v() {
        let mut s = AppSettings::default();
        s.shift_key_horizontal = false;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_wheel(120, shift_only());
        assert_eq!(decision, HookDecision::Swallow);
        let mut v_total = 0;
        for _ in 0..500 {
            let out = state.engine.lock().step(1000.0 / 120.0);
            v_total += out.vertical;
            if !state.engine.lock().has_pending_work() {
                break;
            }
        }
        assert!(v_total != 0, "expected vertical emission, got 0");
    }

    #[test]
    fn shift_with_horizontal_smoothness_off_passes_through() {
        let mut s = AppSettings::default();
        s.horizontal_smoothness = false;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_wheel(120, shift_only());
        assert_eq!(decision, HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn native_hwheel_with_smoothness_off_passes_through() {
        let mut s = AppSettings::default();
        s.horizontal_smoothness = false;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_hwheel(120);
        assert_eq!(decision, HookDecision::Pass);
    }

    #[test]
    fn native_hwheel_with_smoothness_on_swallows() {
        let s = AppSettings::default();
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_hwheel(120);
        assert_eq!(decision, HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    fn reverse_direction_inverts_engine_output() {
        let mut s = AppSettings::default();
        s.reverse_wheel_direction = true;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        sink.on_wheel(120, no_mods());
        let mut v_total = 0;
        for _ in 0..500 {
            let out = state.engine.lock().step(1000.0 / 120.0);
            v_total += out.vertical;
            if !state.engine.lock().has_pending_work() {
                break;
            }
        }
        assert!(v_total < 0, "reverse direction should flip sign");
    }

    #[test]
    fn excluded_app_passes_through() {
        let mut s = AppSettings::default();
        s.excluded_apps.push("notepad".to_string());
        let state = make_state_with_process(s, Some("notepad"));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn excluded_check_is_case_insensitive() {
        let mut s = AppSettings::default();
        s.excluded_apps.push("Notepad".to_string());
        let state = make_state_with_process(s, Some("NOTEPAD"));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
    }

    #[test]
    fn non_excluded_app_swallows_normally() {
        let mut s = AppSettings::default();
        s.excluded_apps.push("excel".to_string());
        let state = make_state_with_process(s, Some("notepad"));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
    }
}
