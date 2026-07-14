//! Glue between the platform hook and our engine.
//!
//! Lifecycle: the sink holds an `Arc<AppState>` to keep settings accessible.
//!
//! Performance notes:
//! - The engine lock is taken exactly once per wheel event.
//! - Process-name lookups under the cursor are throttled to 50 ms intervals.
//! - Debug tracing is lazy (guarded by `tracing::enabled!`).

use crate::state::AppState;
use parking_lot::Mutex;
use smoothscroll_core::settings::EffectiveSettings;
use smoothscroll_platform::traits::HookEventSink;
use smoothscroll_platform::types::{HookDecision, ModifierKeys};
use std::sync::atomic::Ordering;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

/// Callback signature invoked when the input-source classifier transitions
/// between Wheel/HighResWheel/Touchpad. Installed once at startup by
/// `lib.rs::setup()` to bridge to `AppHandle::emit("input-source-changed")`.
type InputSourceEmitter = Box<dyn Fn(&'static str) + Send + Sync>;

const PROCESS_CACHE_TTL: Duration = Duration::from_millis(50);

/// Throttled process-name cache — caps Win32 syscall rate at ~20 Hz.
struct ProcessNameCache {
    last_call_at: Instant,
    last_under_cursor: Option<String>,
    last_foreground: Option<String>,
    initialized: bool,
}

impl ProcessNameCache {
    fn new() -> Self {
        Self {
            last_call_at: Instant::now(),
            last_under_cursor: None,
            last_foreground: None,
            initialized: false,
        }
    }

    fn get<F>(&mut self, fetch: F) -> (Option<String>, Option<String>)
    where
        F: FnOnce() -> (Option<String>, Option<String>),
    {
        if self.initialized && self.last_call_at.elapsed() < PROCESS_CACHE_TTL {
            return (self.last_under_cursor.clone(), self.last_foreground.clone());
        }
        let (under_cursor, foreground) = fetch();
        self.last_under_cursor = under_cursor;
        self.last_foreground = foreground;
        self.last_call_at = Instant::now();
        self.initialized = true;
        (self.last_under_cursor.clone(), self.last_foreground.clone())
    }
}

pub struct EngineSink {
    pub state: Arc<AppState>,
    pub epoch: Instant,
    /// Set once during setup (after `AppHandle` becomes available).
    input_source_emitter: OnceLock<InputSourceEmitter>,
    /// Throttled process-name cache to keep Win32 syscall rate bounded.
    process_cache: Mutex<ProcessNameCache>,
}

impl EngineSink {
    pub fn new(state: Arc<AppState>) -> Arc<Self> {
        Arc::new(Self {
            state,
            epoch: Instant::now(),
            input_source_emitter: OnceLock::new(),
            process_cache: Mutex::new(ProcessNameCache::new()),
        })
    }

    /// Install the bridge to the Tauri event system. Idempotent — only the
    /// first call wins. Called from `lib.rs::setup()` once `AppHandle` exists.
    pub fn install_input_source_emitter<F>(&self, f: F)
    where
        F: Fn(&'static str) + Send + Sync + 'static,
    {
        let _ = self.input_source_emitter.set(Box::new(f));
    }

    fn now_ms(&self) -> u64 {
        self.epoch.elapsed().as_millis() as u64
    }

    /// Returns `None` if the app under the cursor/foreground is disabled.
    /// Otherwise returns the active `EffectiveSettings` (per-profile or global).
    fn resolve_active(&self) -> Option<Arc<EffectiveSettings>> {
        // Bypass engine for elevated (admin) target windows unconditionally.
        // UIPI blocks SendInput/PostMessageW from a medium-IL sender to a
        // high-IL target, so swallowing the event would silently lose scroll.
        // Forwarding the raw event preserves native scroll instead.
        // This check must run regardless of excluded_apps / app_profiles config.
        #[cfg(windows)]
        if self.state.processes.is_target_elevated() {
            if tracing::enabled!(tracing::Level::DEBUG) {
                tracing::debug!("bypassing engine for elevated target");
            }
            return None;
        }

        let should_lookup_processes = {
            let s = self.state.settings.read();
            !s.excluded_apps.is_empty()
                || !s.app_profiles.is_empty()
                || s.auto_disable_windows_apps
                || !s.monitor_profiles.is_empty()
                || s.force_enable_all_apps
        };

        if !should_lookup_processes {
            return Some(self.state.effective.load_full());
        }

        let (under_cursor, foreground) = {
            let mut cache = self.process_cache.lock();
            cache.get(|| {
                (
                    self.state.processes.process_name_under_cursor(),
                    self.state.processes.foreground_process_name(),
                )
            })
        };

        let start = Instant::now();
        let s = self.state.settings.read();

        if let Some(process_name) = under_cursor.as_deref() {
            if s.is_excluded(process_name) {
                if tracing::enabled!(tracing::Level::DEBUG) {
                    let elapsed = start.elapsed();
                    if elapsed > Duration::from_millis(2) {
                        tracing::debug!(?elapsed, process = %process_name, "resolve_active excluded pass-through");
                    }
                }
                return None;
            }

            if s.should_auto_disable_windows_app(process_name) && !s.force_enable_all_apps {
                if tracing::enabled!(tracing::Level::DEBUG) {
                    let elapsed = start.elapsed();
                    if elapsed > Duration::from_millis(2) {
                        tracing::debug!(?elapsed, process = %process_name, "resolve_active pass-through");
                    }
                }
                return None;
            }

            if let Some(profile_id) = s.app_profiles_lookup(process_name) {
                if profile_id != smoothscroll_core::settings::AppSettings::DISABLED_PROFILE_ID {
                    let per_profile = self.state.effective_per_profile.read();
                    if let Some(eff) = per_profile.get(profile_id) {
                        let result = eff.clone();
                        drop(per_profile);
                        drop(s);
                        if tracing::enabled!(tracing::Level::DEBUG) {
                            let elapsed = start.elapsed();
                            if elapsed > Duration::from_millis(2) {
                                tracing::debug!(?elapsed, process = %process_name, "resolve_active profile");
                            }
                        }
                        return Some(result);
                    }
                }
            }
        }

        if let Some(process_name) = foreground.as_deref() {
            if s.should_auto_disable_windows_app(process_name) && !s.force_enable_all_apps {
                if tracing::enabled!(tracing::Level::DEBUG) {
                    let elapsed = start.elapsed();
                    if elapsed > Duration::from_millis(2) {
                        tracing::debug!(?elapsed, process = %process_name, "resolve_active foreground pass-through");
                    }
                }
                return None;
            }
        }

        // Per-monitor profile resolution (priority: per-app > per-monitor > global)
        if !s.monitor_profiles.is_empty() {
            #[cfg(windows)]
            {
                use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
                let fg_hwnd = unsafe { GetForegroundWindow() };
                if !fg_hwnd.is_null() {
                    if let Some(monitor_name) =
                        self.state.window_geom.monitor_for_hwnd(fg_hwnd as isize)
                    {
                        if let Some(mp) = s
                            .monitor_profiles
                            .iter()
                            .find(|mp| mp.device_name == monitor_name)
                        {
                            if mp.profile_id == "__default__" {
                                drop(s);
                                return Some(self.state.effective.load_full());
                            }
                            if let Some(profile) = s.profiles.iter().find(|p| p.id == mp.profile_id)
                            {
                                let eff =
                                    smoothscroll_core::settings::EffectiveSettings::with_profile(
                                        &s, profile,
                                    );
                                drop(s);
                                return Some(Arc::new(eff));
                            }
                        }
                    }
                }
            }
        }

        drop(s);
        if tracing::enabled!(tracing::Level::DEBUG) {
            let elapsed = start.elapsed();
            if elapsed > Duration::from_millis(2) {
                tracing::debug!(?elapsed, "resolve_active global");
            }
        }
        Some(self.state.effective.load_full())
    }

    fn update_last_source(&self, source: smoothscroll_core::input_source::InputSource) {
        use smoothscroll_core::input_source::InputSource;
        let code: u8 = match source {
            InputSource::Wheel => 0,
            InputSource::HighResWheel => 1,
            InputSource::Touchpad => 2,
        };
        let old = self.state.last_input_source.swap(code, Ordering::Relaxed);
        if old != code {
            if let Some(emit) = self.input_source_emitter.get() {
                let label: &'static str = match code {
                    1 => "HighResWheel",
                    2 => "Touchpad",
                    _ => "Wheel",
                };
                emit(label);
            }
        }
    }

    fn route_vertical_with_source(
        &self,
        delta: i32,
        mods: ModifierKeys,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        if self.state.game_mode_active.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }

        let eff = match self.resolve_active() {
            Some(e) => e,
            None => return HookDecision::Pass,
        };

        // Shift+Wheel always routes through engine when smoothness is enabled.
        // Native horizontal wheel (no modifiers) always smooths.

        // Precision-modifier passthrough (Ctrl/Alt+Wheel for zoom etc.)
        #[cfg(target_os = "macos")]
        let precision = (mods.cmd && eff.modifier_ctrl_passthrough)
            || (mods.alt && eff.modifier_alt_passthrough);
        #[cfg(not(target_os = "macos"))]
        let precision = (mods.ctrl && eff.modifier_ctrl_passthrough)
            || (mods.alt && eff.modifier_alt_passthrough);

        if precision {
            if eff.modifier_clear_inertia {
                self.state.engine.lock().reset_axes();
            }
            return HookDecision::Pass;
        }

        self.update_last_source(source);
        let now = self.now_ms();

        // ONE lock acquisition per event.
        let mut engine = self.state.engine.lock();

        #[cfg(not(target_os = "macos"))]
        let ctrl_pressed = mods.ctrl;
        #[cfg(target_os = "macos")]
        let ctrl_pressed = mods.cmd;

        if ctrl_pressed && eff.smooth_zoom {
            // Ctrl+Wheel → zoom axis
            engine.on_wheel_zoom(delta, now, source, &eff);
        } else if mods.shift && eff.horizontal_smoothness {
            let h_delta = if eff.horizontal_invert { -delta } else { delta };
            engine.on_hwheel_with_source(h_delta, now, source, &eff);
        } else if mods.shift {
            return HookDecision::Pass;
        } else {
            engine.on_wheel_with_source(delta, now, source, &eff);
        }
        drop(engine);
        self.state.stats.record_notch();
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }

    fn route_horizontal_with_source(
        &self,
        delta: i32,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        if self.state.game_mode_active.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }

        let eff = match self.resolve_active() {
            Some(e) => e,
            None => return HookDecision::Pass,
        };

        if !eff.horizontal_smoothness {
            return HookDecision::Pass;
        }

        // Precision-modifier passthrough — note: native horizontal wheel
        // events don't carry modifier state through this path on Windows
        // (the hook signature has no `mods`); on macOS we'd need to extend
        // the trait. For now we leave this path as-is; passthrough applies
        // to the vertical path which is where Ctrl/Alt+Wheel actually fire.

        self.update_last_source(source);
        let now = self.now_ms();

        let mut engine = self.state.engine.lock();
        let h_delta = if eff.horizontal_invert { -delta } else { delta };
        engine.on_hwheel_with_source(h_delta, now, source, &eff);
        drop(engine);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }
}

impl HookEventSink for EngineSink {
    fn on_wheel(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        self.route_vertical_with_source(
            delta,
            mods,
            smoothscroll_core::input_source::InputSource::Wheel,
        )
    }

    fn on_hwheel(&self, delta: i32) -> HookDecision {
        self.route_horizontal_with_source(
            delta,
            smoothscroll_core::input_source::InputSource::Wheel,
        )
    }

    fn on_wheel_ext(
        &self,
        delta: i32,
        mods: ModifierKeys,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        self.route_vertical_with_source(delta, mods, source)
    }

    fn on_hwheel_ext(
        &self,
        delta: i32,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        self.route_horizontal_with_source(delta, source)
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::field_reassign_with_default)]
    use super::*;
    use crate::settings_persistor::SettingsPersistor;
    use crate::state::EngineSignal;
    use arc_swap::ArcSwap;
    use parking_lot::{Mutex, RwLock};
    use smoothscroll_core::engine::SmoothScrollEngine;
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
    use smoothscroll_platform::icon::IconCache;
    use smoothscroll_platform::traits::{
        Autostart, FullscreenDetector, HookEventSink, HookHandle, Hotkey, HotkeyHandle,
        MonitorEnumeration, MouseHook, ProcessInfo, ProcessQuery, WheelEmitter, WindowGeometry,
        ZoomEmitter,
    };
    use smoothscroll_platform::types::{Accelerator, PlatformError, Point, Result, WindowRect};
    use std::collections::HashMap;
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
    impl ZoomEmitter for StubEmitter {
        fn emit_zoom(&self, _units: i32) -> Result<()> {
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
    struct StubWindowGeom;
    impl WindowGeometry for StubWindowGeom {
        fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
            None
        }
    }
    struct StubMonitorEnum;
    impl MonitorEnumeration for StubMonitorEnum {
        fn list_monitors(&self) -> Vec<smoothscroll_platform::traits::MonitorInfo> {
            Vec::new()
        }
    }
    struct StubAccessibility;
    impl smoothscroll_platform::traits::AccessibilitySignals for StubAccessibility {
        fn reduce_motion_enabled(&self) -> bool {
            false
        }
        fn watch(
            &self,
            _on_change: Box<dyn Fn(bool) + Send + Sync>,
        ) -> smoothscroll_platform::types::Result<smoothscroll_platform::traits::HookHandle>
        {
            Ok(smoothscroll_platform::traits::HookHandle::new(Box::new(())))
        }
    }

    fn make_state(settings: AppSettings) -> Arc<AppState> {
        let eff = EffectiveSettings::from_settings(&settings);
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
            settings: Arc::new(RwLock::new(settings.clone())),
            effective: Arc::new(ArcSwap::from_pointee(eff)),
            effective_per_profile: Arc::new(RwLock::new(HashMap::new())),
            mouse_hook: Arc::new(StubHook),
            emitter: Arc::new(StubEmitter),
            zoom_emitter: Arc::new(StubEmitter),
            processes: Arc::new(StubProcessQuery),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            fullscreen_detector: Arc::new(StubFullscreen),
            window_geom: Arc::new(StubWindowGeom),
            monitor_enum: Arc::new(StubMonitorEnum),
            last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
            persistor: Arc::new(SettingsPersistor::spawn()),
            reduce_motion: Arc::new(AtomicBool::new(false)),
            accessibility: Arc::new(StubAccessibility),
            rm_watch_handle: Arc::new(parking_lot::Mutex::new(None)),
            last_foreground_at_tray_open: Arc::new(parking_lot::Mutex::new(None)),
            app_icon_cache: Arc::new(parking_lot::Mutex::new(IconCache::new())),
            stats: smoothscroll_core::stats::StatsCollector::new(
                std::env::temp_dir().join("test-stats.json"),
            ),
        })
    }

    struct StaticProcessQuery {
        under_cursor: Option<String>,
        foreground: Option<String>,
    }
    impl ProcessQuery for StaticProcessQuery {
        fn process_name_under_cursor(&self) -> Option<String> {
            self.under_cursor.clone()
        }
        fn foreground_process_id(&self) -> Option<u32> {
            None
        }
        fn list_visible_processes(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
        fn foreground_process_name(&self) -> Option<String> {
            self.foreground.clone()
        }
    }

    struct ElevatedStaticProcessQuery {
        under_cursor: Option<String>,
        foreground: Option<String>,
        elevated: bool,
    }
    impl ProcessQuery for ElevatedStaticProcessQuery {
        fn process_name_under_cursor(&self) -> Option<String> {
            self.under_cursor.clone()
        }
        fn foreground_process_id(&self) -> Option<u32> {
            None
        }
        fn list_visible_processes(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
        fn foreground_process_name(&self) -> Option<String> {
            self.foreground.clone()
        }
        fn is_target_elevated(&self) -> bool {
            self.elevated
        }
    }

    fn make_state_with_elevation(
        settings: AppSettings,
        under_cursor: Option<&str>,
        elevated: bool,
    ) -> Arc<AppState> {
        let eff = EffectiveSettings::from_settings(&settings);
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
            settings: Arc::new(RwLock::new(settings.clone())),
            effective: Arc::new(ArcSwap::from_pointee(eff)),
            effective_per_profile: Arc::new(RwLock::new(HashMap::new())),
            mouse_hook: Arc::new(StubHook),
            emitter: Arc::new(StubEmitter),
            zoom_emitter: Arc::new(StubEmitter),
            processes: Arc::new(ElevatedStaticProcessQuery {
                under_cursor: under_cursor.map(|s| s.to_string()),
                foreground: None,
                elevated,
            }),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            fullscreen_detector: Arc::new(StubFullscreen),
            window_geom: Arc::new(StubWindowGeom),
            monitor_enum: Arc::new(StubMonitorEnum),
            last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
            persistor: Arc::new(SettingsPersistor::spawn()),
            reduce_motion: Arc::new(AtomicBool::new(false)),
            accessibility: Arc::new(StubAccessibility),
            rm_watch_handle: Arc::new(parking_lot::Mutex::new(None)),
            last_foreground_at_tray_open: Arc::new(parking_lot::Mutex::new(None)),
            app_icon_cache: Arc::new(parking_lot::Mutex::new(IconCache::new())),
            stats: smoothscroll_core::stats::StatsCollector::new(
                std::env::temp_dir().join("test-stats-elevated.json"),
            ),
        })
    }

    fn make_state_with_process(settings: AppSettings, process_name: Option<&str>) -> Arc<AppState> {
        make_state_with_processes(settings, process_name, None)
    }

    fn make_state_with_processes(
        settings: AppSettings,
        under_cursor: Option<&str>,
        foreground: Option<&str>,
    ) -> Arc<AppState> {
        let eff = EffectiveSettings::from_settings(&settings);
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
            settings: Arc::new(RwLock::new(settings.clone())),
            effective: Arc::new(ArcSwap::from_pointee(eff)),
            effective_per_profile: Arc::new(RwLock::new(HashMap::new())),
            mouse_hook: Arc::new(StubHook),
            emitter: Arc::new(StubEmitter),
            zoom_emitter: Arc::new(StubEmitter),
            processes: Arc::new(StaticProcessQuery {
                under_cursor: under_cursor.map(|s| s.to_string()),
                foreground: foreground.map(|s| s.to_string()),
            }),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            fullscreen_detector: Arc::new(StubFullscreen),
            window_geom: Arc::new(StubWindowGeom),
            monitor_enum: Arc::new(StubMonitorEnum),
            last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
            persistor: Arc::new(SettingsPersistor::spawn()),
            reduce_motion: Arc::new(AtomicBool::new(false)),
            accessibility: Arc::new(StubAccessibility),
            rm_watch_handle: Arc::new(parking_lot::Mutex::new(None)),
            last_foreground_at_tray_open: Arc::new(parking_lot::Mutex::new(None)),
            app_icon_cache: Arc::new(parking_lot::Mutex::new(IconCache::new())),
            stats: smoothscroll_core::stats::StatsCollector::new(
                std::env::temp_dir().join("test-stats-processes.json"),
            ),
        })
    }

    fn shift_only() -> ModifierKeys {
        ModifierKeys {
            shift: true,
            ctrl: false,
            alt: false,
            cmd: false,
        }
    }

    fn no_mods() -> ModifierKeys {
        ModifierKeys::default()
    }

    fn drain_engine(state: &Arc<AppState>) -> (i32, i32) {
        let eff = state.effective.load_full();
        let mut v = 0;
        let mut h = 0;
        for _ in 0..500 {
            let out = state.engine.lock().step(1000.0 / 120.0, &eff);
            v += out.vertical;
            h += out.horizontal;
            if !state.engine.lock().has_pending_work() {
                break;
            }
        }
        (v, h)
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
    fn shift_wheel_smooths_horizontal() {
        // Shift+Wheel always routes through engine for smooth horizontal scrolling.
        let s = AppSettings::default();
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_wheel(120, shift_only());

        assert_eq!(decision, HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
        let (_v, h) = drain_engine(&state);
        assert!(h != 0, "expected horizontal emission, got 0");
    }

    #[test]
    fn shift_wheel_passes_through_when_smoothness_disabled() {
        // When horizontal_smoothness is OFF, shift+wheel passes through.
        let mut s = AppSettings::default();
        s.horizontal_smoothness = false;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_wheel(120, shift_only());

        assert_eq!(decision, HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn horizontal_invert_affects_shift_wheel() {
        let mut s = AppSettings::default();
        s.horizontal_invert = true;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        sink.on_wheel(100, shift_only());
        let (_v, h) = drain_engine(&state);
        assert!(h < 0, "horizontal_invert should flip sign");
    }

    #[test]
    fn horizontal_invert_affects_native_hwheel() {
        let mut s = AppSettings::default();
        s.horizontal_invert = true;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        sink.on_hwheel(100);
        let (_v, h) = drain_engine(&state);
        assert!(
            h < 0,
            "horizontal_invert should flip sign for native hwheel"
        );
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
        let (v, _h) = drain_engine(&state);
        assert!(v < 0, "reverse direction should flip sign");
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

    #[test]
    fn auto_disable_windows_app_under_cursor_passes_through_by_default() {
        let s = AppSettings::default();
        let state = make_state_with_process(s, Some("Notepad.exe"));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn auto_disable_windows_app_foreground_passes_through_by_default() {
        let s = AppSettings::default();
        let state = make_state_with_processes(s, Some("Code.exe"), Some("SystemSettings.exe"));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn auto_disable_windows_apps_can_be_disabled() {
        let mut s = AppSettings::default();
        s.auto_disable_windows_apps = false;
        let state = make_state_with_processes(s, Some("Notepad.exe"), Some("SystemSettings.exe"));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    fn manual_disabled_app_still_passes_when_auto_disable_is_off() {
        let mut s = AppSettings::default();
        s.auto_disable_windows_apps = false;
        s.assign_profile(
            "Notepad.exe".to_string(),
            Some(AppSettings::DISABLED_PROFILE_ID.to_string()),
        );
        let state = make_state_with_process(s, Some("Notepad.exe"));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn game_mode_active_passes_through() {
        let s = AppSettings::default();
        let state = make_state(s);
        state.game_mode_active.store(true, Ordering::Relaxed);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn commit_settings_auto_follows_os_reduce_motion() {
        use smoothscroll_core::settings::RespectReduceMotion;
        let mut s = AppSettings::default();
        s.respect_reduce_motion = RespectReduceMotion::Auto;
        let state = make_state(s.clone());
        // OS RM off → instant_mode false
        state.reduce_motion.store(false, Ordering::Relaxed);
        state.commit_settings(s.clone());
        assert!(!state.effective.load_full().instant_mode);
        // OS RM on → instant_mode true
        state.reduce_motion.store(true, Ordering::Relaxed);
        state.commit_settings(s.clone());
        assert!(state.effective.load_full().instant_mode);
    }

    #[test]
    fn commit_settings_always_overrides_os_off() {
        use smoothscroll_core::settings::RespectReduceMotion;
        let mut s = AppSettings::default();
        s.respect_reduce_motion = RespectReduceMotion::Always;
        let state = make_state(s.clone());
        state.reduce_motion.store(false, Ordering::Relaxed);
        state.commit_settings(s);
        assert!(state.effective.load_full().instant_mode);
    }

    #[test]
    fn commit_settings_never_ignores_os_on() {
        use smoothscroll_core::settings::RespectReduceMotion;
        let mut s = AppSettings::default();
        s.respect_reduce_motion = RespectReduceMotion::Never;
        let state = make_state(s.clone());
        state.reduce_motion.store(true, Ordering::Relaxed);
        state.commit_settings(s);
        assert!(!state.effective.load_full().instant_mode);
    }

    #[test]
    fn ctrl_wheel_passes_through_when_passthrough_enabled() {
        let mut s = AppSettings::default();
        s.modifier_passthrough.ctrl = true;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let mods = ModifierKeys {
            shift: false,
            ctrl: true,
            alt: false,
            cmd: false,
        };
        assert_eq!(sink.on_wheel(120, mods), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn ctrl_wheel_smooths_when_passthrough_disabled() {
        let mut s = AppSettings::default();
        s.modifier_passthrough.ctrl = false;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let mods = ModifierKeys {
            shift: false,
            ctrl: true,
            alt: false,
            cmd: false,
        };
        assert_eq!(sink.on_wheel(120, mods), HookDecision::Swallow);

        // Drain engine and verify zoom output (not vertical)
        let eff = state.effective.load_full();
        let mut zoom_total = 0i32;
        for _ in 0..500 {
            let out = state.engine.lock().step(1000.0 / 120.0, &eff);
            zoom_total += out.zoom;
            if !state.engine.lock().has_pending_work() {
                break;
            }
        }
        assert!(zoom_total != 0, "expected zoom emission, got 0");
        assert_eq!(
            state.engine.lock().step(1000.0 / 120.0, &eff).vertical,
            0,
            "zoom should not produce vertical output"
        );
    }

    #[test]
    fn ctrl_shift_wheel_zoom_inverts_when_setting_on() {
        let mut s = AppSettings::default();
        s.modifier_passthrough.ctrl = false;
        s.zoom_invert = true;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let mods = ModifierKeys {
            shift: true,
            ctrl: true,
            alt: false,
            cmd: false,
        };
        sink.on_wheel(120, mods);

        let eff = state.effective.load_full();
        let mut zoom_total = 0i32;
        for _ in 0..500 {
            let out = state.engine.lock().step(1000.0 / 120.0, &eff);
            zoom_total += out.zoom;
            if !state.engine.lock().has_pending_work() {
                break;
            }
        }
        assert!(zoom_total < 0, "zoom_invert=true should make zoom negative");
    }

    #[test]
    fn ctrl_press_clears_inertia_when_passthrough_enabled() {
        // With modifier_passthrough.ctrl=true (explicit), pressing Ctrl clears
        // scroll inertia and passes Ctrl+Wheel through raw.
        let mut s = AppSettings::default();
        s.modifier_passthrough.ctrl = true; // enable passthrough
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        sink.on_wheel(120, no_mods());
        assert!(state.engine.lock().has_pending_work());
        let mods = ModifierKeys {
            shift: false,
            ctrl: true,
            alt: false,
            cmd: false,
        };
        let _ = sink.on_wheel(120, mods);
        assert!(
            !state.engine.lock().has_pending_work(),
            "inertia should clear on ctrl press when passthrough enabled"
        );
    }

    #[test]
    #[cfg(windows)]
    fn elevated_target_passes_through() {
        // When is_target_elevated() returns true, the engine should not
        // process the event — it passes through instead. This prevents
        // scroll from being silently lost when SmoothScroll runs non-elevated
        // and the user scrolls in an elevated (admin) IDE.
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), true);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    #[cfg(windows)]
    fn non_elevated_target_swallows_normally() {
        // When is_target_elevated() returns false, normal scroll swallowing
        // applies (regression check — behavior must not change for non-elevated).
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), false);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    #[cfg(windows)]
    fn elevated_horizontal_wheel_passes_through() {
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), true);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }
}
