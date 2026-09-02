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

#[derive(Debug, Clone)]
struct SteppedFrame {
    output: smoothscroll_core::engine::EngineOutput,
    velocity: f64,
    root_owner: Option<isize>,
    vertical_generation: u64,
    horizontal_generation: u64,
}

fn step_frame(
    state: &AppState,
    dt_ms: f64,
    eff: &smoothscroll_core::settings::EffectiveSettings,
) -> SteppedFrame {
    let mut engine = state.engine.lock();
    #[cfg(windows)]
    if eff.instant_mode {
        state.animation_owner.clear();
    }
    #[cfg(windows)]
    let root_owner = if eff.instant_mode {
        None
    } else {
        state.animation_owner.get()
    };
    #[cfg(not(windows))]
    let root_owner = None;

    let output = engine.step(dt_ms, eff);
    SteppedFrame {
        output,
        velocity: engine.last_velocity(),
        root_owner,
        vertical_generation: state.wheel_generations.get(WheelAxis::Vertical),
        horizontal_generation: state.wheel_generations.get(WheelAxis::Horizontal),
    }
}

fn run_frame(state: &AppState, dt_ms: f64, eff: &smoothscroll_core::settings::EffectiveSettings) {
    let frame = step_frame(state, dt_ms, eff);

    #[cfg(windows)]
    if !eff.instant_mode && frame.output != smoothscroll_core::engine::EngineOutput::default() {
        if let Some(owner) = frame.root_owner {
            if let Some(current_root) = state.window_geom.root_window_under_cursor() {
                if current_root != owner {
                    let mut engine = state.engine.lock();
                    let generation_matches = state.wheel_generations.get(WheelAxis::Vertical)
                        == frame.vertical_generation
                        && state.wheel_generations.get(WheelAxis::Horizontal)
                            == frame.horizontal_generation;
                    if state.animation_owner.get() == Some(owner) && generation_matches {
                        engine.reset_sequence();
                        state.wheel_generations.invalidate_all();
                        state.animation_owner.clear();
                    }
                    return;
                }
            }
        }
    }

    let mut emitted_axes = [false; 2];

    #[cfg(windows)]
    {
        for (index, pulse) in [frame.output.vertical, frame.output.horizontal]
            .into_iter()
            .enumerate()
        {
            let Some(pulse) = pulse else { continue };
            let axis = if index == 0 {
                WheelAxis::Vertical
            } else {
                WheelAxis::Horizontal
            };
            let expected_generation = if index == 0 {
                frame.vertical_generation
            } else {
                frame.horizontal_generation
            };
            let context = smoothscroll_platform::traits::EmissionContext {
                root_owner: frame.root_owner,
                axis_generation: expected_generation,
                generation: state.wheel_generations.token(axis),
            };
            let owner_matches = state.engine.lock().active_sequence(axis) == Some(pulse.sequence);
            if !owner_matches || !context.is_current() {
                continue;
            }
            match state.semantic_emitter.emit_semantic(pulse, context) {
                Ok(()) => emitted_axes[index] = true,
                Err(error) => {
                    let mut engine = state.engine.lock();
                    engine.reset_axis_if_sequence(axis, pulse.sequence);
                    tracing::warn!(
                        error = %error,
                        ?axis,
                        shift = pulse.sequence.semantic.modifiers.shift,
                        ctrl = pulse.sequence.semantic.modifiers.ctrl,
                        alt = pulse.sequence.semantic.modifiers.alt,
                        units = pulse.units,
                        owner = ?frame.root_owner,
                        "semantic wheel emission failed; tail cancelled"
                    );
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        let vertical = frame.output.vertical.map_or(0, |pulse| pulse.units);
        let horizontal = frame.output.horizontal.map_or(0, |pulse| pulse.units);
        let zoom = frame
            .output
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
            if state.emitter.emit(scroll_vertical, horizontal).is_ok() {
                emitted_axes[0] = vertical != 0;
                emitted_axes[1] = horizontal != 0;
            }
        }
        if zoom != 0 && state.zoom_emitter.emit_zoom(zoom).is_ok() {
            emitted_axes[0] = true;
        }
    }

    if frame.velocity > 0.0 {
        state.stats.record_velocity(frame.velocity);
    }
    let distance = [frame.output.vertical, frame.output.horizontal]
        .into_iter()
        .enumerate()
        .filter_map(|(index, pulse)| pulse.filter(|_| emitted_axes[index]))
        .map(|pulse| pulse.units.abs() as f64)
        .sum::<f64>();
    if distance > 0.0 {
        let fg_name = state
            .processes
            .foreground_process_name()
            .unwrap_or_default();
        state.stats.record_distance(distance, &fg_name);
        state.stats.record_active_time(dt_ms as u64);
    }

    let mut engine = state.engine.lock();
    if emitted_axes[0] {
        if let Some(pulse) = frame.output.vertical {
            engine.finish_axis_pulse(WheelAxis::Vertical, pulse.sequence);
        }
    }
    if emitted_axes[1] {
        if let Some(pulse) = frame.output.horizontal {
            engine.finish_axis_pulse(WheelAxis::Horizontal, pulse.sequence);
        }
    }
    #[cfg(windows)]
    if !engine.has_pending_work() && state.animation_owner.get() == frame.root_owner {
        state.animation_owner.clear();
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
        fail_vertical: AtomicBool,
        fail_horizontal: AtomicBool,
    }

    impl RecordingEmitter {
        fn fail_axis(&self, axis: WheelAxis) {
            match axis {
                WheelAxis::Vertical => self.fail_vertical.store(true, Ordering::Relaxed),
                WheelAxis::Horizontal => self.fail_horizontal.store(true, Ordering::Relaxed),
            }
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
            let failing = match pulse.sequence.semantic.axis {
                WheelAxis::Vertical => self.fail_vertical.load(Ordering::Relaxed),
                WheelAxis::Horizontal => self.fail_horizontal.load(Ordering::Relaxed),
            };
            if failing {
                return Err(PlatformError::Os("semantic test emitter failed".into()));
            }
            self.semantic_calls.lock().push(pulse);
            Ok(())
        }
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

    fn queue_ctrl_wheel(state: &AppState, eff: &EffectiveSettings, delta: i32) {
        let semantic = smoothscroll_core::wheel::WheelSemantic {
            axis: WheelAxis::Vertical,
            modifiers: smoothscroll_core::wheel::ModifierKeys {
                ctrl: true,
                ..Default::default()
            },
        };
        let sequence = smoothscroll_core::wheel::WheelSequence {
            semantic,
            transport: smoothscroll_core::wheel::WheelTransport::Native,
            strategy: smoothscroll_core::wheel::SmoothingStrategy::Continuous,
            delta_transform: smoothscroll_core::wheel::DeltaTransform::CtrlZoom {
                sensitivity: 1.0,
                sign: 1,
            },
        };
        state.engine.lock().register(
            smoothscroll_core::wheel::WheelInputEvent {
                delta,
                semantic,
                source: InputSource::Wheel,
            },
            sequence,
            1_000,
            eff,
        );
    }

    fn queue_horizontal(state: &AppState, eff: &EffectiveSettings, delta: i32) {
        let semantic = smoothscroll_core::wheel::WheelSemantic {
            axis: WheelAxis::Horizontal,
            modifiers: Default::default(),
        };
        let sequence = smoothscroll_core::wheel::WheelSequence {
            semantic,
            transport: smoothscroll_core::wheel::WheelTransport::Native,
            strategy: smoothscroll_core::wheel::SmoothingStrategy::Continuous,
            delta_transform: smoothscroll_core::wheel::DeltaTransform::Generic { sign: 1 },
        };
        state.engine.lock().register(
            smoothscroll_core::wheel::WheelInputEvent {
                delta,
                semantic,
                source: InputSource::Wheel,
            },
            sequence,
            1_000,
            eff,
        );
    }

    #[allow(dead_code)]
    fn step_frame_for_ctrl(state: &AppState, eff: &EffectiveSettings) -> SteppedFrame {
        queue_ctrl_wheel(state, eff, 120);
        step_frame(state, 1000.0 / 120.0, eff)
    }

    #[allow(dead_code)]
    fn dispatch_frame(state: &AppState, frame: SteppedFrame, eff: &EffectiveSettings) {
        // Re-run the production dispatcher against a captured frame without
        // stepping a second time. This mirrors the stale-frame gate used by
        // `run_frame` and keeps the regression test allocation-free.
        #[cfg(windows)]
        {
            for (index, pulse) in [frame.output.vertical, frame.output.horizontal]
                .into_iter()
                .enumerate()
            {
                let Some(pulse) = pulse else { continue };
                let axis = if index == 0 {
                    WheelAxis::Vertical
                } else {
                    WheelAxis::Horizontal
                };
                let generation = if index == 0 {
                    frame.vertical_generation
                } else {
                    frame.horizontal_generation
                };
                let context = smoothscroll_platform::traits::EmissionContext {
                    root_owner: frame.root_owner,
                    axis_generation: generation,
                    generation: state.wheel_generations.token(axis),
                };
                if state.engine.lock().active_sequence(axis) != Some(pulse.sequence)
                    || !context.is_current()
                {
                    continue;
                }
                let _ = state.semantic_emitter.emit_semantic(pulse, context);
            }
        }
        let _ = eff;
    }

    #[allow(dead_code)]
    fn queue_plain_wheel(state: &AppState, eff: &EffectiveSettings, delta: i32) {
        queue_wheel(state, eff);
        if delta != 120 {
            state.engine.lock().reset_axis(WheelAxis::Vertical);
            let semantic = smoothscroll_core::wheel::WheelSemantic {
                axis: WheelAxis::Vertical,
                modifiers: Default::default(),
            };
            let sequence = smoothscroll_core::wheel::WheelSequence {
                semantic,
                transport: smoothscroll_core::wheel::WheelTransport::Native,
                strategy: smoothscroll_core::wheel::SmoothingStrategy::Continuous,
                delta_transform: smoothscroll_core::wheel::DeltaTransform::Generic { sign: 1 },
            };
            state.engine.lock().register(
                smoothscroll_core::wheel::WheelInputEvent {
                    delta,
                    semantic,
                    source: InputSource::Wheel,
                },
                sequence,
                1_000,
                eff,
            );
        }
    }

    #[test]
    fn ctrl_tail_emits_with_captured_semantic_after_ctrl_release() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(Some(A)));
        let state = make_state(settings, eff.clone(), recorder.clone(), geom);
        state.animation_owner.set(Some(A));
        queue_ctrl_wheel(&state, &eff, 120);

        run_frame(&state, 1000.0 / 120.0, &eff);

        let calls = recorder.semantic_calls.lock();
        assert_eq!(calls.len(), 1);
        assert!(calls[0].sequence.semantic.modifiers.ctrl);
    }

    #[test]
    fn stale_ctrl_frame_cannot_clear_new_plain_sequence() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        let geom = Arc::new(RootWindowGeom::new(Some(A)));
        let state = make_state(settings, eff.clone(), recorder.clone(), geom);
        state.animation_owner.set(Some(A));
        let frame = step_frame_for_ctrl(&state, &eff);

        state.wheel_generations.invalidate(WheelAxis::Vertical);
        state.engine.lock().reset_axis(WheelAxis::Vertical);
        queue_wheel(&state, &eff);
        dispatch_frame(&state, frame, &eff);

        assert!(!recorder.semantic_calls.lock().iter().any(|pulse| pulse
            .sequence
            .semantic
            .modifiers
            .ctrl));
        assert!(
            !state
                .engine
                .lock()
                .active_sequence(WheelAxis::Vertical)
                .unwrap()
                .semantic
                .modifiers
                .ctrl
        );
    }

    #[test]
    fn semantic_emit_failure_stops_only_matching_axis_tail() {
        let (settings, eff) = animated_settings();
        let recorder = Arc::new(RecordingEmitter::default());
        recorder.fail_axis(WheelAxis::Vertical);
        let geom = Arc::new(RootWindowGeom::new(Some(A)));
        let state = make_state(settings, eff.clone(), recorder.clone(), geom);
        state.animation_owner.set(Some(A));
        queue_wheel(&state, &eff);
        queue_horizontal(&state, &eff, 120);

        run_frame(&state, 1000.0 / 120.0, &eff);

        assert_eq!(
            state.engine.lock().active_sequence(WheelAxis::Vertical),
            None
        );
        assert!(state
            .engine
            .lock()
            .active_sequence(WheelAxis::Horizontal)
            .is_some());
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
        let generations = state.wheel_generations.clone();
        let eff_for_b = eff.clone();
        geom.set_on_query(move || {
            let mut engine = engine.lock();
            engine.reset_sequence();
            generations.invalidate_all();
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
