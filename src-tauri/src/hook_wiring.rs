//! Glue between the platform hook and our engine. Reads
//! `settings.shift_key_horizontal` to decide whether Shift+wheel becomes
//! a horizontal scroll.
//!
//! Lifecycle: the sink holds an `Arc<AppState>` to keep settings accessible.

use crate::state::AppState;
use parking_lot::Mutex;
use smoothscroll_core::settings::AppSettings;
use smoothscroll_platform::traits::HookEventSink;
use smoothscroll_platform::types::{HookDecision, ModifierKeys};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Instant;

pub struct EngineSink {
    pub state: Arc<AppState>,
    pub epoch: Instant,
    /// Tracks the last applied profile ID to avoid redundant engine updates.
    /// None = global settings active, Some(id) = a specific profile is active.
    last_applied_profile: Mutex<Option<String>>,
}

impl EngineSink {
    pub fn new(state: Arc<AppState>) -> Arc<Self> {
        Arc::new(Self {
            state,
            epoch: Instant::now(),
            last_applied_profile: Mutex::new(None),
        })
    }

    fn now_ms(&self) -> u64 {
        self.epoch.elapsed().as_millis() as u64
    }

    /// Resolves the active state for the current cursor position:
    /// - `None` = pass-through (excluded/disabled)
    /// - `Some(())` = process with smooth scrolling active (engine settings already applied)
    fn resolve_active(&self) -> Option<()> {
        let (has_excluded, has_profiles) = {
            let s = self.state.settings.read();
            (!s.excluded_apps.is_empty(), !s.app_profiles.is_empty())
        };

        // Fast path: no exclusions and no app profiles configured.
        // Reset to global settings if a profile was previously active.
        if !has_excluded && !has_profiles {
            self.reset_to_global_if_needed();
            return Some(());
        }

        let start = Instant::now();
        let process_name = match self.state.processes.process_name_under_cursor() {
            Some(n) => n,
            None => {
                self.reset_to_global_if_needed();
                return Some(());
            }
        };

        // Build merged settings while holding the read lock briefly, then drop
        // it before mutating the engine to avoid blocking writers.
        enum Action {
            PassThrough,
            ApplyProfile {
                id: String,
                name: String,
                merged: Box<AppSettings>,
            },
            ResetGlobal,
        }

        let action = {
            let s = self.state.settings.read();
            if s.is_excluded(&process_name) {
                Action::PassThrough
            } else if let Some(profile) = s.get_profile_for_process(&process_name) {
                let mut merged = s.clone();
                merged.step_size_px = profile.step_size_px;
                merged.animation_time_ms = profile.animation_time_ms;
                merged.acceleration_delta_ms = profile.acceleration_delta_ms;
                merged.acceleration_max = profile.acceleration_max;
                merged.tail_to_head_ratio = profile.tail_to_head_ratio;
                merged.animation_easing = profile.animation_easing;
                merged.easing_mode = profile.easing_mode;
                merged.reverse_wheel_direction = profile.reverse_wheel_direction;
                merged.horizontal_smoothness = profile.horizontal_smoothness;
                Action::ApplyProfile {
                    id: profile.id.clone(),
                    name: profile.name.clone(),
                    merged: Box::new(merged),
                }
            } else {
                Action::ResetGlobal
            }
        };

        match action {
            Action::PassThrough => {
                let elapsed = start.elapsed();
                if elapsed > std::time::Duration::from_millis(2) {
                    tracing::debug!(?elapsed, process = %process_name, "resolve_active disabled");
                }
                None
            }
            Action::ApplyProfile { id, name, merged } => {
                self.apply_profile_if_changed(id, name, *merged);
                let elapsed = start.elapsed();
                if elapsed > std::time::Duration::from_millis(2) {
                    tracing::debug!(?elapsed, process = %process_name, "resolve_active slow path");
                }
                Some(())
            }
            Action::ResetGlobal => {
                self.reset_to_global_if_needed();
                let elapsed = start.elapsed();
                if elapsed > std::time::Duration::from_millis(2) {
                    tracing::debug!(?elapsed, process = %process_name, "resolve_active slow path");
                }
                Some(())
            }
        }
    }

    fn apply_profile_if_changed(&self, profile_id: String, profile_name: String, merged: AppSettings) {
        let mut last = self.last_applied_profile.lock();
        if last.as_deref() == Some(profile_id.as_str()) {
            return;
        }
        self.state.engine.lock().apply_settings(merged);
        tracing::debug!(profile_id = %profile_id, profile_name = %profile_name, "applied profile");
        *last = Some(profile_id);
    }

    fn reset_to_global_if_needed(&self) {
        let mut last = self.last_applied_profile.lock();
        if last.is_none() {
            return;
        }
        let global = self.state.settings.read().clone();
        self.state.engine.lock().apply_settings(global);
        *last = None;
        tracing::debug!("reset to global settings");
    }

    fn route_vertical(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        if self.resolve_active().is_none() {
            return HookDecision::Pass;
        }
        let (shift_to_horizontal, horizontal_smoothness) = {
            let s = self.state.engine.lock().settings().clone();
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
        if self.resolve_active().is_none() {
            return HookDecision::Pass;
        }
        let horizontal_smoothness = self.state.engine.lock().settings().horizontal_smoothness;
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
        Autostart, FullscreenDetector, HookEventSink, HookHandle, Hotkey, HotkeyHandle, MouseHook,
        ProcessInfo, ProcessQuery, WheelEmitter,
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
    struct StubFullscreen;
    impl FullscreenDetector for StubFullscreen {
        fn is_foreground_fullscreen(&self) -> bool {
            false
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
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            fullscreen_detector: Arc::new(StubFullscreen),
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
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            fullscreen_detector: Arc::new(StubFullscreen),
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
