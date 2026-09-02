//! Dedicated 120fps engine thread. Sleeps on a Condvar when idle and is
//! woken whenever the hook registers a new notch.

use crate::state::AppState;
use smoothscroll_core::wheel::WheelAxis;
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
                if !state.enabled.load(Ordering::Relaxed) && !state.engine.lock().has_pending_work()
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
        run_frame(&state, dt_ms, &eff);

        let elapsed = now.elapsed().as_secs_f64() * 1000.0;
        let sleep_ms = frame_ms - elapsed;
        if sleep_ms > 0.5 {
            thread::sleep(Duration::from_micros((sleep_ms * 1000.0) as u64));
        } else {
            thread::yield_now();
        }
    }
}

fn run_frame(state: &AppState, dt_ms: f64, eff: &smoothscroll_core::settings::EffectiveSettings) {
    let (output, vel, frame_owner) = {
        let mut engine = state.engine.lock();

        #[cfg(windows)]
        if eff.instant_mode {
            state.animation_owner.clear();
        }

        #[cfg(windows)]
        let frame_owner = if eff.instant_mode {
            None
        } else {
            state.animation_owner.get()
        };
        #[cfg(not(windows))]
        let frame_owner: Option<isize> = None;

        let output = engine.step(dt_ms, eff);
        let vel = engine.last_velocity();

        (output, vel, frame_owner)
    };

    #[cfg(not(windows))]
    let _ = frame_owner;

    #[cfg(windows)]
    if !eff.instant_mode && output != smoothscroll_core::engine::EngineOutput::default() {
        if let Some(owner) = frame_owner {
            if let Some(current_root) = state.window_geom.root_window_under_cursor() {
                if current_root != owner {
                    let mut engine = state.engine.lock();
                    if state.animation_owner.get() == Some(owner) {
                        engine.reset_sequence();
                        state.animation_owner.clear();
                    }
                    return;
                }
            }
        }
    }

    let vertical = output.vertical.map_or(0, |pulse| pulse.units);
    let horizontal = output.horizontal.map_or(0, |pulse| pulse.units);

    if vel > 0.0 {
        state.stats.record_velocity(vel);
    }
    let distance = (vertical.abs() + horizontal.abs()) as f64;
    if distance > 0.0 {
        let fg_name = state
            .processes
            .foreground_process_name()
            .unwrap_or_default();
        state.stats.record_distance(distance, &fg_name);
        state.stats.record_active_time(dt_ms as u64);
    }

    // Windows dispatches through the semantic emitter with per-axis
    // generation context; other platforms keep the legacy channel split
    // until Task 11.
    let mut emitted_any = false;
    #[cfg(windows)]
    {
        if let Some(pulse) = output.vertical {
            let context = smoothscroll_platform::traits::EmissionContext {
                root_owner: frame_owner,
                axis_generation: state.wheel_generations.get(WheelAxis::Vertical),
                generation: state.wheel_generations.token(WheelAxis::Vertical),
            };
            if let Err(e) = state.semantic_emitter.emit_semantic(pulse, context) {
                tracing::warn!(error = %e, axis = ?WheelAxis::Vertical, "semantic emit failed");
            } else {
                emitted_any = true;
            }
        }
        if let Some(pulse) = output.horizontal {
            let context = smoothscroll_platform::traits::EmissionContext {
                root_owner: frame_owner,
                axis_generation: state.wheel_generations.get(WheelAxis::Horizontal),
                generation: state.wheel_generations.token(WheelAxis::Horizontal),
            };
            if let Err(e) = state.semantic_emitter.emit_semantic(pulse, context) {
                tracing::warn!(error = %e, axis = ?WheelAxis::Horizontal, "semantic emit failed");
            } else {
                emitted_any = true;
            }
        }
    }
    #[cfg(not(windows))]
    {
        let zoom = output
            .vertical
            .filter(|pulse| {
                matches!(
                    pulse.sequence.delta_transform,
                    smoothscroll_core::wheel::DeltaTransform::CtrlZoom { .. }
                )
            })
            .map_or(0, |pulse| pulse.units);
        let scroll_vertical = if zoom != 0 { 0 } else { vertical };
        if scroll_vertical != 0 || horizontal != 0 {
            if let Err(e) = state.emitter.emit(scroll_vertical, horizontal) {
                tracing::warn!(error = %e, "wheel emit failed");
            } else {
                emitted_any = true;
            }
        }
        if zoom != 0 {
            if let Err(e) = state.zoom_emitter.emit_zoom(zoom) {
                tracing::warn!(error = %e, "zoom emit failed");
            } else {
                emitted_any = true;
            }
        }
    }

    if emitted_any {
        let mut engine = state.engine.lock();
        if let Some(pulse) = output.vertical {
            engine.finish_axis_pulse(WheelAxis::Vertical, pulse.sequence);
        }
        if let Some(pulse) = output.horizontal {
            engine.finish_axis_pulse(WheelAxis::Horizontal, pulse.sequence);
        }
        #[cfg(windows)]
        if !engine.has_pending_work() && state.animation_owner.get() == frame_owner {
            state.animation_owner.clear();
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

#[cfg(all(test, windows))]
mod tests {
    #![allow(clippy::field_reassign_with_default)]

    use super::*;
    use crate::settings_persistor::SettingsPersistor;
    use crate::state::EngineSignal;
    use arc_swap::ArcSwap;
    use parking_lot::{Mutex, RwLock};
    use smoothscroll_core::engine::SmoothScrollEngine;
    use smoothscroll_core::input_source::InputSource;
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings, RespectReduceMotion};
    use smoothscroll_platform::icon::IconCache;
    use smoothscroll_platform::traits::{
        AccessibilitySignals, Autostart, FullscreenDetector, HookEventSink, HookHandle, Hotkey,
        HotkeyHandle, MonitorEnumeration, MouseHook, ProcessInfo, ProcessQuery, WheelEmitter,
        WindowGeometry, ZoomEmitter,
    };
    use smoothscroll_platform::types::{Accelerator, PlatformError, Point, Result, WindowRect};
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicUsize, Ordering};

    const A: isize = 0x1000;
    const B: isize = 0x2000;

    #[derive(Default)]
    struct RecordingEmitter {
        wheel_calls: Mutex<Vec<(i32, i32)>>,
        zoom_calls: Mutex<Vec<i32>>,
        semantic_calls: Mutex<Vec<smoothscroll_core::wheel::SemanticPulse>>,
    }

    impl WheelEmitter for RecordingEmitter {
        fn emit(&self, vertical: i32, horizontal: i32) -> Result<()> {
            self.wheel_calls.lock().push((vertical, horizontal));
            Ok(())
        }
    }

    impl ZoomEmitter for RecordingEmitter {
        fn emit_zoom(&self, units: i32) -> Result<()> {
            self.zoom_calls.lock().push(units);
            Ok(())
        }
    }

    impl smoothscroll_platform::traits::SemanticWheelEmitter for RecordingEmitter {
        fn prepare(&self, _sequence: smoothscroll_core::wheel::WheelSequence) -> Result<()> {
            Ok(())
        }

        fn emit_semantic(
            &self,
            pulse: smoothscroll_core::wheel::SemanticPulse,
            _context: smoothscroll_platform::traits::EmissionContext,
        ) -> Result<()> {
            self.semantic_calls.lock().push(pulse);
            Ok(())
        }
    }

    struct RootWindowGeom {
        root: AtomicIsize,
        calls: AtomicUsize,
        on_query: Mutex<Option<Box<dyn FnOnce() + Send>>>,
    }

    impl RootWindowGeom {
        fn new(root: Option<isize>) -> Self {
            Self {
                root: AtomicIsize::new(root.unwrap_or(0)),
                calls: AtomicUsize::new(0),
                on_query: Mutex::new(None),
            }
        }

        fn query_count(&self) -> usize {
            self.calls.load(Ordering::Relaxed)
        }

        fn set_on_query(&self, callback: impl FnOnce() + Send + 'static) {
            *self.on_query.lock() = Some(Box::new(callback));
        }
    }

    impl WindowGeometry for RootWindowGeom {
        fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
            None
        }

        fn root_window_under_cursor(&self) -> Option<isize> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            if let Some(callback) = self.on_query.lock().take() {
                callback();
            }
            let root = self.root.load(Ordering::Relaxed);
            (root != 0).then_some(root)
        }
    }

    struct StubHook;
    impl MouseHook for StubHook {
        fn install(&self, _sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
            Ok(HookHandle::new(Box::new(())))
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

    struct StubMonitorEnum;
    impl MonitorEnumeration for StubMonitorEnum {
        fn list_monitors(&self) -> Vec<smoothscroll_platform::traits::MonitorInfo> {
            Vec::new()
        }
    }

    struct StubAccessibility;
    impl AccessibilitySignals for StubAccessibility {
        fn reduce_motion_enabled(&self) -> bool {
            false
        }
        fn watch(&self, _on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
            Ok(HookHandle::new(Box::new(())))
        }
    }

    fn animated_settings() -> (AppSettings, EffectiveSettings) {
        let mut settings = AppSettings::default();
        settings.animation_time_enabled = true;
        settings.animation_time_ms = 1000;
        settings.step_size_px = 500;
        settings.respect_reduce_motion = RespectReduceMotion::Never;
        settings.auto_disable_windows_apps = false;
        let eff = EffectiveSettings::from_settings(&settings);
        (settings, eff)
    }

    fn make_state(
        settings: AppSettings,
        eff: EffectiveSettings,
        recorder: Arc<RecordingEmitter>,
        geom: Arc<RootWindowGeom>,
    ) -> AppState {
        AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
            animation_owner: Arc::new(crate::state::AnimationOwner::default()),
            settings: Arc::new(RwLock::new(settings)),
            effective: Arc::new(ArcSwap::from_pointee(eff)),
            effective_per_profile: Arc::new(RwLock::new(HashMap::new())),
            mouse_hook: Arc::new(StubHook),
            emitter: recorder.clone(),
            zoom_emitter: recorder.clone(),
            semantic_emitter: recorder,
            wheel_generations: Arc::new(crate::state::WheelAxisGenerations::default()),
            processes: Arc::new(StubProcessQuery),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(true)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            game_mode_hook_state: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            fullscreen_detector: Arc::new(StubFullscreen),
            window_geom: geom,
            monitor_enum: Arc::new(StubMonitorEnum),
            last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
            persistor: Arc::new(SettingsPersistor::spawn()),
            reduce_motion: Arc::new(AtomicBool::new(false)),
            accessibility: Arc::new(StubAccessibility),
            rm_watch_handle: Arc::new(Mutex::new(None)),
            last_foreground_at_tray_open: Arc::new(Mutex::new(None)),
            app_icon_cache: Arc::new(Mutex::new(IconCache::new())),
            stats: smoothscroll_core::stats::StatsCollector::new(
                std::env::temp_dir().join("engine-thread-test-stats.json"),
            ),
        }
    }

    fn queue_wheel(state: &AppState, eff: &EffectiveSettings) {
        state
            .engine
            .lock()
            .on_wheel_with_source(120, 1_000, InputSource::Wheel, eff);
    }

    #[test]
    fn same_window_emits_animated_frame() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(Some(A)));
        let state = make_state(settings, eff, recorder.clone(), geom.clone());
        state.animation_owner.set(Some(A));
        queue_wheel(&state, &eff);

        run_frame(&state, 1000.0 / 120.0, &eff);

        assert!(!recorder.semantic_calls.lock().is_empty());
        assert_eq!(state.animation_owner.get(), Some(A));
        assert!(geom.query_count() >= 1);
    }

    #[test]
    fn changed_window_cancels_before_emission() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(Some(B)));
        let state = make_state(settings, eff, recorder.clone(), geom);
        state.animation_owner.set(Some(A));
        queue_wheel(&state, &eff);

        run_frame(&state, 1000.0 / 120.0, &eff);

        assert!(recorder.semantic_calls.lock().is_empty());
        assert!(recorder.zoom_calls.lock().is_empty());
        assert!(!state.engine.lock().has_pending_work());
        assert_eq!(state.engine.lock().last_velocity(), 0.0);
        assert_eq!(state.animation_owner.get(), None);
    }

    #[test]
    fn owner_change_during_validation_discards_stale_frame_without_resetting_new_sequence() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(Some(B)));
        let state = make_state(settings, eff, recorder.clone(), geom.clone());
        state.animation_owner.set(Some(A));
        queue_wheel(&state, &eff);

        let engine = state.engine.clone();
        let owner = state.animation_owner.clone();
        let eff_for_b = eff.clone();
        geom.set_on_query(move || {
            let mut engine = engine.lock();
            engine.reset_sequence();
            owner.set(Some(B));
            engine.on_wheel_with_source(120, 2_000, InputSource::Wheel, &eff_for_b);
        });

        run_frame(&state, 1000.0 / 120.0, &eff);

        assert!(recorder.semantic_calls.lock().is_empty());
        assert!(recorder.zoom_calls.lock().is_empty());
        assert!(state.engine.lock().has_pending_work());
        assert_eq!(state.animation_owner.get(), Some(B));
        let stats = state.stats.snapshot();
        assert_eq!(stats.total_scroll_distance_px, 0.0);
        assert_eq!(stats.active_time_ms, 0);
        assert_eq!(stats.peak_velocity, 0.0);
    }

    #[test]
    fn unknown_root_does_not_cancel_animated_frame() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(None));
        let state = make_state(settings, eff, recorder.clone(), geom.clone());
        state.animation_owner.set(Some(A));
        queue_wheel(&state, &eff);

        run_frame(&state, 1000.0 / 120.0, &eff);

        assert!(!recorder.semantic_calls.lock().is_empty());
        assert!(state.engine.lock().has_pending_work());
        assert_eq!(state.animation_owner.get(), Some(A));
        assert!(geom.query_count() >= 1);
    }

    #[test]
    fn completed_animated_sequence_clears_owner() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(Some(A)));
        let state = make_state(settings, eff, recorder.clone(), geom);
        state.animation_owner.set(Some(A));
        queue_wheel(&state, &eff);

        run_frame(&state, 1000.0, &eff);

        assert!(!recorder.semantic_calls.lock().is_empty());
        assert!(!state.engine.lock().has_pending_work());
        assert_eq!(state.animation_owner.get(), None);
    }

    #[test]
    fn instant_frame_skips_root_lookup_and_clears_stale_owner() {
        let (settings, mut eff) = animated_settings();
        eff.instant_mode = true;
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(Some(B)));
        let state = make_state(settings, eff, recorder.clone(), geom.clone());
        state.animation_owner.set(Some(A));
        queue_wheel(&state, &eff);

        run_frame(&state, 1000.0 / 120.0, &eff);

        assert!(!recorder.semantic_calls.lock().is_empty());
        assert!(!state.engine.lock().has_pending_work());
        assert_eq!(state.animation_owner.get(), None);
        assert_eq!(geom.query_count(), 0);
    }
}
