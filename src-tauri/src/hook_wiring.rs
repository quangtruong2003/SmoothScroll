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
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{EffectiveSettings, ShiftWheelBehavior, WheelOutputMode};
use smoothscroll_core::wheel::{
    DeltaTransform, SmoothingStrategy, WheelSemantic, WheelSequence, WheelTransport,
};
use smoothscroll_platform::traits::HookEventSink;
use smoothscroll_platform::types::{HookDecision, ModifierKeys, WheelAxis, WheelInputEvent};
use std::sync::atomic::Ordering;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

/// Callback signature invoked when the input-source classifier transitions
/// between Wheel/HighResWheel/Touchpad. Installed once at startup by
/// `lib.rs::setup()` to bridge to `AppHandle::emit("input-source-changed")`.
type InputSourceEmitter = Box<dyn Fn(&'static str) + Send + Sync>;

const PROCESS_CACHE_TTL: Duration = Duration::from_millis(50);

#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq)]
enum ResolvedWheelAction {
    RawPass {
        axis: WheelAxis,
        cancel_active: bool,
    },
    Smooth {
        event: WheelInputEvent,
        sequence: WheelSequence,
    },
}

#[cfg_attr(not(test), allow(dead_code))]
fn resolve_wheel_action(
    event: WheelInputEvent,
    settings: &EffectiveSettings,
    detected_discrete: bool,
) -> ResolvedWheelAction {
    let raw = |cancel_active| ResolvedWheelAction::RawPass {
        axis: event.semantic.axis,
        cancel_active,
    };

    if (event.semantic.modifiers.ctrl && settings.modifier_ctrl_passthrough)
        || (event.semantic.modifiers.alt && settings.modifier_alt_passthrough)
    {
        return raw(true);
    }
    if event.source == InputSource::Touchpad && !settings.touchpad_smoothing_enabled {
        return raw(true);
    }
    if settings.wheel_output_mode == WheelOutputMode::Raw || detected_discrete {
        return raw(true);
    }

    let mut output = event;
    let (transport, delta_transform) = if event.semantic.axis == WheelAxis::Vertical
        && event.semantic.modifiers.shift
        && settings.shift_wheel_behavior == ShiftWheelBehavior::ConvertToHorizontal
    {
        output.semantic.axis = WheelAxis::Horizontal;
        let inverted = settings.reverse_wheel_direction ^ settings.horizontal_invert;
        (
            WheelTransport::CompatibilityHorizontal,
            DeltaTransform::Generic {
                sign: if inverted { -1 } else { 1 },
            },
        )
    } else if event.semantic.axis == WheelAxis::Horizontal && !settings.horizontal_smoothness {
        return raw(true);
    } else if event.semantic.axis == WheelAxis::Vertical
        && event.semantic.modifiers.is_ctrl_only()
        && settings.smooth_zoom
    {
        (
            WheelTransport::Native,
            DeltaTransform::CtrlZoom {
                sensitivity: settings.zoom_sensitivity,
                sign: if settings.zoom_invert { -1 } else { 1 },
            },
        )
    } else {
        let horizontal = output.semantic.axis == WheelAxis::Horizontal;
        let inverted =
            settings.reverse_wheel_direction ^ (horizontal && settings.horizontal_invert);
        (
            WheelTransport::Native,
            DeltaTransform::Generic {
                sign: if inverted { -1 } else { 1 },
            },
        )
    };

    let strategy = match settings.wheel_output_mode {
        WheelOutputMode::PreserveWholeNotches
            if matches!(event.source, InputSource::Wheel | InputSource::HighResWheel) =>
        {
            // The safe scheduler does not land until Task 10. Until then the
            // persisted mode is intentionally a raw escape hatch.
            return raw(true);
        }
        WheelOutputMode::PreserveWholeNotches => return raw(true),
        WheelOutputMode::SmoothPulses | WheelOutputMode::Raw => SmoothingStrategy::Continuous,
    };

    ResolvedWheelAction::Smooth {
        event: output,
        sequence: WheelSequence {
            semantic: output.semantic,
            transport,
            strategy,
            delta_transform,
        },
    }
}

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

    /// Game Mode is maintained by a low-frequency poll thread, so its published
    /// state can be stale for up to one second after leaving fullscreen or
    /// switching away from a game. On Windows, revalidate only while the packed
    /// hook snapshot is active so the normal wheel hot path stays unchanged.
    fn should_bypass_for_game_mode(&self) -> bool {
        #[cfg(target_os = "windows")]
        {
            let (active, known_game_pid) = self.state.game_mode_hook_snapshot();
            if !active {
                return false;
            }
            if !self.state.settings.read().game_mode_enabled {
                return false;
            }

            if let Some(known_game_pid) = known_game_pid {
                if self.state.processes.foreground_process_id() == Some(known_game_pid) {
                    return true;
                }
            }

            return self.state.fullscreen_detector.is_foreground_fullscreen();
        }

        #[cfg(not(target_os = "windows"))]
        {
            self.state.game_mode_active.load(Ordering::Acquire)
        }
    }

    /// Returns `None` if the app under the cursor/foreground is disabled.
    /// Otherwise returns the active `EffectiveSettings` (per-profile or global).
    fn resolve_active(&self) -> Option<Arc<EffectiveSettings>> {
        // Bypass the engine only when the target is elevated AND SmoothScroll
        // itself is not elevated. UIPI blocks SendInput/PostMessageW from a
        // medium-IL sender to a high-IL target, so swallowing the event would
        // silently lose scroll there — forwarding the raw event preserves
        // native scroll instead. But an elevated SmoothScroll can inject into
        // elevated targets (elevated→elevated is legal under UIPI), so
        // smoothing must keep working in that case.
        // Caveat: System-IL windows (0x4000) also fold into High but UIPI
        // blocks elevated→System injection; they only exist on the secure
        // desktop (lock screen / UAC consent), which WH_MOUSE_LL never sees.
        // This check must run regardless of excluded_apps / app_profiles config.
        #[cfg(windows)]
        if self.state.processes.is_target_elevated() && !self.state.processes.self_is_elevated() {
            if tracing::enabled!(tracing::Level::DEBUG) {
                tracing::debug!("bypassing engine for elevated target (self not elevated)");
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
        if self.should_bypass_for_game_mode() {
            return HookDecision::Pass;
        }

        let eff = match self.resolve_active() {
            Some(e) => e,
            None => return HookDecision::Pass,
        };

        // Discrete controls (spinbox, slider, combo box, list) consume wheel
        // input in whole-notch steps; the engine's sub-notch pulse train makes
        // them skip values or ignore the input entirely. Pass the raw event
        // through so one physical notch stays one native wheel message.
        if self.state.window_geom.cursor_over_discrete_control() {
            return HookDecision::Pass;
        }

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

        #[cfg(not(target_os = "macos"))]
        let ctrl_pressed = mods.ctrl;
        #[cfg(target_os = "macos")]
        let ctrl_pressed = mods.cmd;

        if ctrl_pressed && !eff.smooth_zoom {
            return HookDecision::Pass;
        }

        #[cfg(target_os = "windows")]
        if !ctrl_pressed
            && mods.shift
            && eff.horizontal_smoothness
            && source == smoothscroll_core::input_source::InputSource::Wheel
            && !self.is_browser_target()
        {
            let h_delta = if eff.horizontal_invert { -delta } else { delta };
            if let Err(error) = self.state.emitter.emit_horizontal_immediate(h_delta) {
                tracing::warn!(%error, "failed to queue immediate horizontal scroll");
                return HookDecision::Pass;
            }
            self.state.stats.record_notch();
            return HookDecision::Swallow;
        }

        if !ctrl_pressed && mods.shift && !eff.horizontal_smoothness {
            return HookDecision::Pass;
        }

        #[cfg(windows)]
        let current_root = if eff.instant_mode {
            None
        } else {
            self.state.window_geom.root_window_under_cursor()
        };

        // ONE lock acquisition for events routed through the smooth engine.
        let mut engine = self.state.engine.lock();

        #[cfg(windows)]
        reconcile_animation_owner(
            &self.state.animation_owner,
            &mut engine,
            eff.instant_mode,
            current_root,
        );

        if ctrl_pressed {
            let semantic = WheelSemantic {
                axis: WheelAxis::Vertical,
                modifiers: mods,
            };
            engine.register(
                WheelInputEvent {
                    delta,
                    semantic,
                    source,
                },
                WheelSequence {
                    semantic,
                    transport: WheelTransport::Native,
                    strategy: SmoothingStrategy::Continuous,
                    delta_transform: if eff.smooth_zoom && zoom_modifier_isolated(&mods) {
                        DeltaTransform::CtrlZoom {
                            sensitivity: eff.zoom_sensitivity,
                            sign: if eff.zoom_invert { -1 } else { 1 },
                        }
                    } else {
                        DeltaTransform::Generic {
                            sign: if eff.reverse_wheel_direction { -1 } else { 1 },
                        }
                    },
                },
                now,
                &eff,
            );
        } else if mods.shift && eff.horizontal_smoothness {
            let h_delta = if eff.horizontal_invert { -delta } else { delta };
            engine.on_hwheel_with_source(h_delta, now, source, &eff);
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
        if self.should_bypass_for_game_mode() {
            return HookDecision::Pass;
        }

        let eff = match self.resolve_active() {
            Some(e) => e,
            None => return HookDecision::Pass,
        };

        if !eff.horizontal_smoothness {
            return HookDecision::Pass;
        }

        // Same whole-notch contract as the vertical path: discrete controls
        // must receive the raw horizontal wheel event.
        if self.state.window_geom.cursor_over_discrete_control() {
            return HookDecision::Pass;
        }

        // Precision-modifier passthrough — note: native horizontal wheel
        // events don't carry modifier state through this path on Windows
        // (the hook signature has no `mods`); on macOS we'd need to extend
        // the trait. For now we leave this path as-is; passthrough applies
        // to the vertical path which is where Ctrl/Alt+Wheel actually fire.

        self.update_last_source(source);
        let now = self.now_ms();

        #[cfg(windows)]
        let current_root = if eff.instant_mode {
            None
        } else {
            self.state.window_geom.root_window_under_cursor()
        };

        let mut engine = self.state.engine.lock();

        #[cfg(windows)]
        reconcile_animation_owner(
            &self.state.animation_owner,
            &mut engine,
            eff.instant_mode,
            current_root,
        );

        let h_delta = if eff.horizontal_invert { -delta } else { delta };
        engine.on_hwheel_with_source(h_delta, now, source, &eff);
        drop(engine);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }

    #[cfg(target_os = "windows")]
    fn is_browser_target(&self) -> bool {
        let (under_cursor, foreground) = {
            let mut cache = self.process_cache.lock();
            cache.get(|| {
                (
                    self.state.processes.process_name_under_cursor(),
                    self.state.processes.foreground_process_name(),
                )
            })
        };

        under_cursor
            .as_deref()
            .map(is_browser_process)
            .unwrap_or_else(|| foreground.as_deref().is_some_and(is_browser_process))
    }
}

/// True when the wheel semantic carries exactly the platform's zoom modifier
/// (Ctrl on Windows/Linux, Cmd on macOS) with no other modifier held.
#[cfg_attr(not(test), allow(dead_code))]
fn zoom_modifier_isolated(mods: &ModifierKeys) -> bool {
    #[cfg(target_os = "macos")]
    {
        mods.cmd && !mods.ctrl && !mods.shift && !mods.alt
    }
    #[cfg(not(target_os = "macos"))]
    {
        mods.is_ctrl_only()
    }
}

#[cfg(target_os = "windows")]
fn reconcile_animation_owner(
    owner: &crate::state::AnimationOwner,
    engine: &mut smoothscroll_core::engine::SmoothScrollEngine,
    instant_mode: bool,
    current_root: Option<isize>,
) {
    if instant_mode {
        owner.clear();
        return;
    }

    let Some(current_root) = current_root else {
        return;
    };

    match owner.get() {
        None => owner.set(Some(current_root)),
        Some(existing) if existing != current_root => {
            engine.reset_sequence();
            owner.set(Some(current_root));
        }
        Some(_) => {}
    }
}

#[cfg(target_os = "windows")]
fn is_browser_process(process_name: &str) -> bool {
    let file_name = process_name
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(process_name);
    let stem = file_name
        .strip_suffix(".exe")
        .or_else(|| file_name.strip_suffix(".EXE"))
        .unwrap_or(file_name)
        .to_ascii_lowercase();

    matches!(
        stem.as_str(),
        "arc"
            | "brave"
            | "chrome"
            | "chromium"
            | "firefox"
            | "floorp"
            | "librewolf"
            | "msedge"
            | "opera"
            | "thorium"
            | "tor"
            | "vivaldi"
            | "waterfox"
            | "zen"
    )
}

impl HookEventSink for EngineSink {
    fn on_wheel_event(&self, event: WheelInputEvent) -> HookDecision {
        match event.semantic.axis {
            WheelAxis::Vertical => {
                self.route_vertical_with_source(event.delta, event.semantic.modifiers, event.source)
            }
            WheelAxis::Horizontal => self.route_horizontal_with_source(event.delta, event.source),
        }
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
    use smoothscroll_core::input_source::InputSource;
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings, ScrollProfile};
    use smoothscroll_platform::icon::IconCache;
    use smoothscroll_platform::traits::{
        Autostart, FullscreenDetector, HookEventSink, HookHandle, Hotkey, HotkeyHandle,
        MonitorEnumeration, MouseHook, ProcessInfo, ProcessQuery, WheelEmitter, WindowGeometry,
        ZoomEmitter,
    };
    use smoothscroll_platform::types::{Accelerator, PlatformError, Point, Result, WindowRect};
    use std::collections::HashMap;
    use std::sync::atomic::AtomicBool;
    #[cfg(windows)]
    use std::sync::atomic::AtomicIsize;
    use std::sync::Arc;

    #[cfg(windows)]
    #[test]
    fn animated_owner_establishes_and_same_root_keeps_sequence() {
        let owner = crate::state::AnimationOwner::default();
        let mut engine = SmoothScrollEngine::new();
        let settings = EffectiveSettings::from_settings(&AppSettings::default());

        reconcile_animation_owner(&owner, &mut engine, false, Some(0x1000));
        assert_eq!(owner.get(), Some(0x1000));

        engine.on_wheel_with_source(120, 1_000, InputSource::Wheel, &settings);
        reconcile_animation_owner(&owner, &mut engine, false, Some(0x1000));

        assert_eq!(owner.get(), Some(0x1000));
        assert!(engine.has_pending_work());
    }

    #[cfg(windows)]
    #[test]
    fn animated_owner_mismatch_resets_old_sequence_before_new_window() {
        let owner = crate::state::AnimationOwner::default();
        let mut engine = SmoothScrollEngine::new();
        let settings = EffectiveSettings::from_settings(&AppSettings::default());

        owner.set(Some(0x1000));
        engine.on_wheel_with_source(120, 1_000, InputSource::Wheel, &settings);
        engine.on_wheel_with_source(120, 1_050, InputSource::Wheel, &settings);
        assert!(engine.last_velocity() > 0.0);

        reconcile_animation_owner(&owner, &mut engine, false, Some(0x2000));

        assert_eq!(owner.get(), Some(0x2000));
        assert!(!engine.has_pending_work());
        assert_eq!(engine.last_velocity(), 0.0);

        engine.on_wheel_with_source(120, 1_100, InputSource::Wheel, &settings);
        assert_eq!(
            engine.last_velocity(),
            0.0,
            "B's first notch must not inherit A's cadence"
        );
    }

    #[cfg(windows)]
    #[test]
    fn transient_unknown_root_does_not_cancel_owned_animation() {
        let owner = crate::state::AnimationOwner::default();
        let mut engine = SmoothScrollEngine::new();
        let settings = EffectiveSettings::from_settings(&AppSettings::default());

        owner.set(Some(0x1000));
        engine.on_wheel_with_source(120, 1_000, InputSource::Wheel, &settings);
        reconcile_animation_owner(&owner, &mut engine, false, None);

        assert_eq!(owner.get(), Some(0x1000));
        assert!(engine.has_pending_work());
    }

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
    #[derive(Default)]
    struct RecordingEmitter {
        generic_calls: Mutex<Vec<(i32, i32)>>,
        immediate_calls: Mutex<Vec<i32>>,
    }
    impl WheelEmitter for RecordingEmitter {
        fn emit(&self, vertical: i32, horizontal: i32) -> Result<()> {
            self.generic_calls.lock().push((vertical, horizontal));
            Ok(())
        }

        fn emit_horizontal_immediate(&self, units: i32) -> Result<()> {
            self.immediate_calls.lock().push(units);
            Ok(())
        }
    }
    struct FailingImmediateEmitter;
    impl WheelEmitter for FailingImmediateEmitter {
        fn emit(&self, _vertical: i32, _horizontal: i32) -> Result<()> {
            Ok(())
        }

        fn emit_horizontal_immediate(&self, _units: i32) -> Result<()> {
            Err(PlatformError::Os("immediate queue unavailable".into()))
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
    #[cfg(target_os = "windows")]
    struct TrueFullscreen;
    #[cfg(target_os = "windows")]
    impl FullscreenDetector for TrueFullscreen {
        fn is_foreground_fullscreen(&self) -> bool {
            true
        }
    }
    #[cfg(target_os = "windows")]
    struct StaticForegroundPid(u32);
    #[cfg(target_os = "windows")]
    impl ProcessQuery for StaticForegroundPid {
        fn process_name_under_cursor(&self) -> Option<String> {
            None
        }
        fn foreground_process_id(&self) -> Option<u32> {
            Some(self.0)
        }
        fn list_visible_processes(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
    }
    struct StubWindowGeom;
    impl WindowGeometry for StubWindowGeom {
        fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
            None
        }
    }
    #[cfg(windows)]
    struct CountingRootWindowGeom {
        root: isize,
        calls: std::sync::atomic::AtomicUsize,
    }
    #[cfg(windows)]
    impl CountingRootWindowGeom {
        fn new(root: isize) -> Self {
            Self {
                root,
                calls: std::sync::atomic::AtomicUsize::new(0),
            }
        }
    }
    #[cfg(windows)]
    impl WindowGeometry for CountingRootWindowGeom {
        fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
            None
        }

        fn root_window_under_cursor(&self) -> Option<isize> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            Some(self.root)
        }
    }
    #[cfg(windows)]
    struct MutableRootWindowGeom {
        root: AtomicIsize,
        hit_child: AtomicIsize,
    }
    #[cfg(windows)]
    impl MutableRootWindowGeom {
        fn new(root: isize, hit_child: isize) -> Self {
            Self {
                root: AtomicIsize::new(root),
                hit_child: AtomicIsize::new(hit_child),
            }
        }
    }
    #[cfg(windows)]
    impl WindowGeometry for MutableRootWindowGeom {
        fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
            None
        }

        fn root_window_under_cursor(&self) -> Option<isize> {
            let _ = self.hit_child.load(Ordering::Relaxed);
            Some(self.root.load(Ordering::Relaxed))
        }
    }
    struct DiscreteControlWindowGeom;
    impl WindowGeometry for DiscreteControlWindowGeom {
        fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
            None
        }
        fn cursor_over_discrete_control(&self) -> bool {
            true
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
        make_state_with_emitter(settings, Arc::new(StubEmitter))
    }

    fn make_state_with_window_geom(
        settings: AppSettings,
        window_geom: Arc<dyn WindowGeometry>,
    ) -> Arc<AppState> {
        let mut state = make_state(settings);
        Arc::get_mut(&mut state).unwrap().window_geom = window_geom;
        state
    }

    fn make_state_with_emitter(
        settings: AppSettings,
        emitter: Arc<dyn WheelEmitter>,
    ) -> Arc<AppState> {
        let eff = EffectiveSettings::from_settings(&settings);
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
            animation_owner: Arc::new(crate::state::AnimationOwner::default()),
            settings: Arc::new(RwLock::new(settings.clone())),
            effective: Arc::new(ArcSwap::from_pointee(eff)),
            effective_per_profile: Arc::new(RwLock::new(HashMap::new())),
            mouse_hook: Arc::new(StubHook),
            emitter,
            zoom_emitter: Arc::new(StubEmitter),
            processes: Arc::new(StubProcessQuery),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            game_mode_hook_state: Arc::new(std::sync::atomic::AtomicU64::new(0)),
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
        self_elevated: bool,
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
        fn self_is_elevated(&self) -> bool {
            self.self_elevated
        }
    }

    fn make_state_with_elevation(
        settings: AppSettings,
        under_cursor: Option<&str>,
        elevated: bool,
        self_elevated: bool,
    ) -> Arc<AppState> {
        let eff = EffectiveSettings::from_settings(&settings);
        Arc::new(AppState {
            engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
            animation_owner: Arc::new(crate::state::AnimationOwner::default()),
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
                self_elevated,
            }),
            autostart: Arc::new(StubAutostart),
            hotkey: Arc::new(StubHotkey),
            hotkey_handle: Arc::new(Mutex::new(None)),
            engine_signal: Arc::new(EngineSignal::default()),
            enabled: Arc::new(AtomicBool::new(settings.enabled)),
            game_mode_active: Arc::new(AtomicBool::new(false)),
            game_mode_hook_state: Arc::new(std::sync::atomic::AtomicU64::new(0)),
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
            animation_owner: Arc::new(crate::state::AnimationOwner::default()),
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
            game_mode_hook_state: Arc::new(std::sync::atomic::AtomicU64::new(0)),
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

    fn ctrl_shift() -> ModifierKeys {
        ModifierKeys {
            ctrl: true,
            shift: true,
            ..ModifierKeys::default()
        }
    }

    fn vertical(delta: i32, modifiers: ModifierKeys, source: InputSource) -> WheelInputEvent {
        WheelInputEvent {
            delta,
            semantic: WheelSemantic {
                axis: WheelAxis::Vertical,
                modifiers,
            },
            source,
        }
    }

    fn horizontal(delta: i32, modifiers: ModifierKeys, source: InputSource) -> WheelInputEvent {
        WheelInputEvent {
            delta,
            semantic: WheelSemantic {
                axis: WheelAxis::Horizontal,
                modifiers,
            },
            source,
        }
    }

    fn eff() -> EffectiveSettings {
        EffectiveSettings::from_settings(&AppSettings::default())
    }

    #[test]
    fn default_policy_preserves_shift_vertical() {
        let action = resolve_wheel_action(
            vertical(120, shift_only(), InputSource::Wheel),
            &eff(),
            false,
        );
        let ResolvedWheelAction::Smooth { event, sequence } = action else {
            panic!("expected smoothing");
        };
        assert_eq!(event.semantic.axis, WheelAxis::Vertical);
        assert!(event.semantic.modifiers.shift);
        assert_eq!(sequence.transport, WheelTransport::Native);
    }

    #[test]
    fn ctrl_shift_is_not_ctrl_only_zoom() {
        let action = resolve_wheel_action(
            vertical(120, ctrl_shift(), InputSource::Wheel),
            &eff(),
            false,
        );
        let ResolvedWheelAction::Smooth { sequence, .. } = action else {
            panic!("expected smoothing");
        };
        assert_eq!(
            sequence.delta_transform,
            DeltaTransform::Generic { sign: 1 }
        );
        assert!(sequence.semantic.modifiers.ctrl);
        assert!(sequence.semantic.modifiers.shift);
    }

    #[test]
    fn touchpad_off_passes_original_event() {
        let mut settings = eff();
        settings.touchpad_smoothing_enabled = false;
        assert_eq!(
            resolve_wheel_action(
                vertical(10, no_mods(), InputSource::Touchpad),
                &settings,
                false
            ),
            ResolvedWheelAction::RawPass {
                axis: WheelAxis::Vertical,
                cancel_active: true,
            }
        );
    }

    #[test]
    fn policy_preserves_plain_ctrl_alt_and_ctrl_alt_vertical_semantics() {
        for modifiers in [
            no_mods(),
            ModifierKeys {
                ctrl: true,
                ..ModifierKeys::default()
            },
            ModifierKeys {
                alt: true,
                ..ModifierKeys::default()
            },
            ModifierKeys {
                ctrl: true,
                alt: true,
                ..ModifierKeys::default()
            },
        ] {
            let action =
                resolve_wheel_action(vertical(120, modifiers, InputSource::Wheel), &eff(), false);
            let ResolvedWheelAction::Smooth { event, sequence } = action else {
                panic!("expected smoothing");
            };
            assert_eq!(
                event.semantic,
                WheelSemantic {
                    axis: WheelAxis::Vertical,
                    modifiers
                }
            );
            assert_eq!(sequence.semantic, event.semantic);
        }
    }

    #[test]
    fn policy_applies_ctrl_zoom_only_to_ctrl_only_vertical() {
        let mut settings = eff();
        settings.zoom_invert = true;
        settings.zoom_sensitivity = 2.5;
        let action = resolve_wheel_action(
            vertical(
                120,
                ModifierKeys {
                    ctrl: true,
                    ..ModifierKeys::default()
                },
                InputSource::Wheel,
            ),
            &settings,
            false,
        );
        let ResolvedWheelAction::Smooth { sequence, .. } = action else {
            panic!("expected smoothing");
        };
        assert_eq!(
            sequence.delta_transform,
            DeltaTransform::CtrlZoom {
                sensitivity: 2.5,
                sign: -1,
            }
        );
    }

    #[test]
    fn policy_preserves_native_horizontal_modifiers() {
        let modifiers = ModifierKeys {
            ctrl: true,
            alt: true,
            ..ModifierKeys::default()
        };
        let mut settings = eff();
        settings.horizontal_smoothness = true;
        let action = resolve_wheel_action(
            horizontal(120, modifiers, InputSource::Wheel),
            &settings,
            false,
        );
        let ResolvedWheelAction::Smooth { event, sequence } = action else {
            panic!("expected smoothing");
        };
        assert_eq!(event.semantic.axis, WheelAxis::Horizontal);
        assert_eq!(event.semantic.modifiers, modifiers);
        assert_eq!(sequence.transport, WheelTransport::Native);
    }

    #[test]
    fn policy_converts_shift_only_when_explicitly_enabled() {
        let mut settings = eff();
        settings.shift_wheel_behavior = ShiftWheelBehavior::ConvertToHorizontal;
        settings.reverse_wheel_direction = true;
        settings.horizontal_invert = true;
        let action = resolve_wheel_action(
            vertical(120, shift_only(), InputSource::Wheel),
            &settings,
            false,
        );
        let ResolvedWheelAction::Smooth { event, sequence } = action else {
            panic!("expected smoothing");
        };
        assert_eq!(event.semantic.axis, WheelAxis::Horizontal);
        assert!(event.semantic.modifiers.shift);
        assert_eq!(sequence.transport, WheelTransport::CompatibilityHorizontal);
        assert_eq!(
            sequence.delta_transform,
            DeltaTransform::Generic { sign: 1 }
        );
    }

    #[test]
    fn policy_raw_passes_for_passthrough_and_discrete_targets() {
        let mut settings = eff();
        settings.modifier_alt_passthrough = true;
        let alt_event = vertical(
            120,
            ModifierKeys {
                alt: true,
                ..ModifierKeys::default()
            },
            InputSource::Wheel,
        );
        assert!(matches!(
            resolve_wheel_action(alt_event, &settings, false),
            ResolvedWheelAction::RawPass {
                cancel_active: true,
                ..
            }
        ));
        assert!(matches!(
            resolve_wheel_action(vertical(120, no_mods(), InputSource::Wheel), &eff(), true),
            ResolvedWheelAction::RawPass {
                cancel_active: true,
                ..
            }
        ));
    }

    #[test]
    fn policy_raw_and_disabled_horizontal_cancel_active_axis() {
        let mut raw_settings = eff();
        raw_settings.wheel_output_mode = WheelOutputMode::Raw;
        assert_eq!(
            resolve_wheel_action(
                vertical(120, no_mods(), InputSource::Wheel),
                &raw_settings,
                false
            ),
            ResolvedWheelAction::RawPass {
                axis: WheelAxis::Vertical,
                cancel_active: true,
            }
        );

        let disabled_horizontal = resolve_wheel_action(
            horizontal(120, no_mods(), InputSource::Wheel),
            &eff(),
            false,
        );
        assert_eq!(
            disabled_horizontal,
            ResolvedWheelAction::RawPass {
                axis: WheelAxis::Horizontal,
                cancel_active: true,
            }
        );
    }

    #[test]
    fn policy_stages_whole_notches_as_raw_until_scheduler_exists() {
        let mut settings = eff();
        settings.wheel_output_mode = WheelOutputMode::PreserveWholeNotches;
        assert!(matches!(
            resolve_wheel_action(
                vertical(120, no_mods(), InputSource::Wheel),
                &settings,
                false
            ),
            ResolvedWheelAction::RawPass {
                cancel_active: true,
                ..
            }
        ));
    }

    fn drain_engine(state: &Arc<AppState>) -> (i32, i32) {
        let eff = state.effective.load_full();
        let mut v = 0;
        let mut h = 0;
        for _ in 0..500 {
            let out = state.engine.lock().step(1000.0 / 120.0, &eff);
            if let Some(pulse) = out.vertical {
                v += pulse.units;
                state
                    .engine
                    .lock()
                    .finish_axis_pulse(WheelAxis::Vertical, pulse.sequence);
            }
            if let Some(pulse) = out.horizontal {
                h += pulse.units;
                state
                    .engine
                    .lock()
                    .finish_axis_pulse(WheelAxis::Horizontal, pulse.sequence);
            }
            if !state.engine.lock().has_pending_work() {
                break;
            }
        }
        (v, h)
    }

    #[cfg(windows)]
    #[test]
    fn effective_instant_mode_clears_owner_without_root_lookup() {
        use smoothscroll_core::settings::RespectReduceMotion;

        let mut settings = AppSettings::default();
        settings.animation_time_enabled = false;
        settings.respect_reduce_motion = RespectReduceMotion::Never;
        settings.auto_disable_windows_apps = false;

        let geom = Arc::new(CountingRootWindowGeom::new(0x2000));
        let state = make_state_with_window_geom(settings.clone(), geom.clone());
        state.animation_owner.set(Some(0x1000));
        state.commit_settings(settings);
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert_eq!(geom.calls.load(Ordering::Relaxed), 0);
        assert_eq!(state.animation_owner.get(), None);
    }

    #[cfg(windows)]
    #[test]
    fn reduce_motion_forced_instant_mode_skips_root_lookup() {
        use smoothscroll_core::settings::RespectReduceMotion;

        let mut settings = AppSettings::default();
        settings.animation_time_enabled = true;
        settings.respect_reduce_motion = RespectReduceMotion::Auto;
        settings.auto_disable_windows_apps = false;

        let geom = Arc::new(CountingRootWindowGeom::new(0x2000));
        let state = make_state_with_window_geom(settings.clone(), geom.clone());
        state.reduce_motion.store(true, Ordering::Relaxed);
        state.commit_settings(settings);
        assert!(state.effective.load_full().instant_mode);

        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert_eq!(geom.calls.load(Ordering::Relaxed), 0);
        assert_eq!(state.animation_owner.get(), None);
    }

    #[cfg(windows)]
    #[test]
    fn new_root_input_replaces_owner_and_registers_immediately() {
        const A: isize = 0x1000;
        const B: isize = 0x2000;

        let mut settings = AppSettings::default();
        settings.auto_disable_windows_apps = false;
        let geom = Arc::new(MutableRootWindowGeom::new(A, 0x1001));
        let state = make_state_with_window_geom(settings, geom.clone());
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert_eq!(state.animation_owner.get(), Some(A));

        geom.root.store(B, Ordering::Relaxed);
        geom.hit_child.store(0x2001, Ordering::Relaxed);
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);

        assert_eq!(state.animation_owner.get(), Some(B));
        assert!(state.engine.lock().has_pending_work());
    }

    #[cfg(windows)]
    #[test]
    fn child_window_change_keeps_root_owner_and_pending_sequence() {
        const ROOT: isize = 0x1000;

        let mut settings = AppSettings::default();
        settings.auto_disable_windows_apps = false;
        let geom = Arc::new(MutableRootWindowGeom::new(ROOT, 0x1001));
        let state = make_state_with_window_geom(settings, geom.clone());
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert_eq!(state.animation_owner.get(), Some(ROOT));
        assert!(state.engine.lock().has_pending_work());

        geom.hit_child.store(0x1002, Ordering::Relaxed);
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);

        assert_eq!(state.animation_owner.get(), Some(ROOT));
        assert!(state.engine.lock().has_pending_work());
    }

    #[cfg(windows)]
    #[test]
    fn instant_native_horizontal_clears_owner_without_root_lookup() {
        use smoothscroll_core::settings::RespectReduceMotion;

        let mut settings = AppSettings::default();
        settings.animation_time_enabled = false;
        settings.respect_reduce_motion = RespectReduceMotion::Never;
        settings.auto_disable_windows_apps = false;
        settings.horizontal_smoothness = true;

        let geom = Arc::new(CountingRootWindowGeom::new(0x2000));
        let state = make_state_with_window_geom(settings.clone(), geom.clone());
        state.animation_owner.set(Some(0x1000));
        state.commit_settings(settings);
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_hwheel(120), HookDecision::Swallow);
        assert_eq!(geom.calls.load(Ordering::Relaxed), 0);
        assert_eq!(state.animation_owner.get(), None);
    }

    #[cfg(windows)]
    #[test]
    fn native_horizontal_input_replaces_animation_owner() {
        const A: isize = 0x1000;
        const B: isize = 0x2000;

        let mut settings = AppSettings::default();
        settings.auto_disable_windows_apps = false;
        settings.horizontal_smoothness = true;
        let geom = Arc::new(MutableRootWindowGeom::new(A, 0x1001));
        let state = make_state_with_window_geom(settings, geom.clone());
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_hwheel(120), HookDecision::Swallow);
        assert_eq!(state.animation_owner.get(), Some(A));

        geom.root.store(B, Ordering::Relaxed);
        assert_eq!(sink.on_hwheel(120), HookDecision::Swallow);

        assert_eq!(state.animation_owner.get(), Some(B));
        assert!(state.engine.lock().has_pending_work());
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
    fn shift_wheel_dispatches_immediately_without_engine_inertia() {
        let recorder = Arc::new(RecordingEmitter::default());
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = true;
        let state = make_state_with_emitter(settings, recorder.clone());
        let sink = EngineSink::new(state.clone());

        let decision = sink.on_wheel(120, shift_only());

        assert_eq!(decision, HookDecision::Swallow);
        assert_eq!(recorder.immediate_calls.lock().as_slice(), &[120]);
        assert!(recorder.generic_calls.lock().is_empty());
        assert!(
            !state.engine.lock().has_pending_work(),
            "held Shift must not wait for the animation queue"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn browser_shift_wheel_keeps_engine_smoothing_path() {
        let recorder = Arc::new(RecordingEmitter::default());
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = true;
        let mut state = make_state_with_process(settings, Some("chrome.exe"));
        Arc::get_mut(&mut state).unwrap().emitter = recorder.clone();
        let sink = EngineSink::new(state.clone());

        let decision = sink.on_wheel(120, shift_only());

        assert_eq!(decision, HookDecision::Swallow);
        assert!(recorder.immediate_calls.lock().is_empty());
        assert!(
            state.engine.lock().has_pending_work(),
            "browser Shift+Wheel must keep the smooth engine path"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn office_under_cursor_takes_precedence_over_browser_foreground() {
        for process_name in ["WINWORD.EXE", "EXCEL.EXE", "explorer.exe"] {
            let recorder = Arc::new(RecordingEmitter::default());
            let mut settings = AppSettings::default();
            settings.horizontal_smoothness = true;
            let mut state =
                make_state_with_processes(settings, Some(process_name), Some("chrome.exe"));
            Arc::get_mut(&mut state).unwrap().emitter = recorder.clone();
            let sink = EngineSink::new(state.clone());

            let decision = sink.on_wheel(120, shift_only());

            assert_eq!(decision, HookDecision::Swallow, "{process_name}");
            assert_eq!(
                *recorder.immediate_calls.lock(),
                vec![120],
                "{process_name}"
            );
            assert!(!state.engine.lock().has_pending_work(), "{process_name}");
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn browser_foreground_is_used_when_cursor_target_is_unknown() {
        let recorder = Arc::new(RecordingEmitter::default());
        let mut settings = AppSettings::default();
        settings.auto_disable_windows_apps = false;
        settings.horizontal_smoothness = true;
        let mut state = make_state_with_processes(settings, None, Some("msedge.exe"));
        Arc::get_mut(&mut state).unwrap().emitter = recorder.clone();
        let sink = EngineSink::new(state.clone());

        let decision = sink.on_wheel(120, shift_only());

        assert_eq!(decision, HookDecision::Swallow);
        assert!(recorder.immediate_calls.lock().is_empty());
        assert!(state.engine.lock().has_pending_work());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn thorium_shift_wheel_keeps_engine_smoothing_path() {
        let recorder = Arc::new(RecordingEmitter::default());
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = true;
        let mut state = make_state_with_process(settings, Some("thorium.exe"));
        Arc::get_mut(&mut state).unwrap().emitter = recorder.clone();
        let sink = EngineSink::new(state.clone());

        let decision = sink.on_wheel(120, shift_only());

        assert_eq!(decision, HookDecision::Swallow);
        assert!(recorder.immediate_calls.lock().is_empty());
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    fn shift_wheel_passes_through_when_immediate_dispatch_fails() {
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = true;
        let state = make_state_with_emitter(settings, Arc::new(FailingImmediateEmitter));
        let sink = EngineSink::new(state.clone());

        let decision = sink.on_wheel(120, shift_only());

        assert_eq!(decision, HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn high_resolution_shift_wheel_keeps_existing_engine_path() {
        let recorder = Arc::new(RecordingEmitter::default());
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = true;
        let state = make_state_with_emitter(settings, recorder.clone());
        let sink = EngineSink::new(state.clone());

        let decision = sink.route_vertical_with_source(
            40,
            shift_only(),
            smoothscroll_core::input_source::InputSource::HighResWheel,
        );

        assert_eq!(decision, HookDecision::Swallow);
        assert!(recorder.immediate_calls.lock().is_empty());
        assert!(recorder.generic_calls.lock().is_empty());
        assert!(
            state.engine.lock().has_pending_work(),
            "high-resolution deltas must preserve the existing smoothing path"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn native_hwheel_preserves_configured_step_size_across_targets() {
        let mut s = AppSettings::default();
        s.step_size_px = 40;
        s.horizontal_smoothness = true;
        let office_state = make_state_with_process(s.clone(), Some("EXCEL"));
        let office_sink = EngineSink::new(office_state.clone());
        let generic_state = make_state_with_process(s, Some("notepad"));
        let generic_sink = EngineSink::new(generic_state.clone());

        assert_eq!(office_sink.on_hwheel(120), HookDecision::Swallow);
        assert_eq!(generic_sink.on_hwheel(120), HookDecision::Swallow);
        let (office_v, office_h) = drain_engine(&office_state);
        let (generic_v, generic_h) = drain_engine(&generic_state);

        assert_eq!(office_v, 0);
        assert_eq!(generic_v, 0);
        assert_eq!(office_h, generic_h);
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
        s.horizontal_smoothness = true;
        s.horizontal_invert = true;
        let recorder = Arc::new(RecordingEmitter::default());
        let state = make_state_with_emitter(s, recorder.clone());
        let sink = EngineSink::new(state.clone());
        sink.on_wheel(100, shift_only());

        assert_eq!(recorder.immediate_calls.lock().as_slice(), &[-100]);
        assert!(recorder.generic_calls.lock().is_empty());
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn horizontal_invert_affects_native_hwheel() {
        let mut s = AppSettings::default();
        s.horizontal_smoothness = true;
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
        let mut s = AppSettings::default();
        s.horizontal_smoothness = true;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let decision = sink.on_hwheel(120);
        assert_eq!(decision, HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    fn wheel_over_discrete_control_passes_through_raw() {
        let recorder = Arc::new(RecordingEmitter::default());
        let mut state = make_state_with_emitter(AppSettings::default(), recorder.clone());
        Arc::get_mut(&mut state).unwrap().window_geom = Arc::new(DiscreteControlWindowGeom);
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
        assert!(recorder.generic_calls.lock().is_empty());
        assert!(recorder.immediate_calls.lock().is_empty());
    }

    #[test]
    fn shift_wheel_over_discrete_control_passes_through_raw() {
        let recorder = Arc::new(RecordingEmitter::default());
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = true;
        let mut state = make_state_with_emitter(settings, recorder.clone());
        Arc::get_mut(&mut state).unwrap().window_geom = Arc::new(DiscreteControlWindowGeom);
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, shift_only()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
        assert!(recorder.immediate_calls.lock().is_empty());
    }

    #[test]
    fn hwheel_over_discrete_control_passes_through_raw() {
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = true;
        let mut state = make_state(settings);
        Arc::get_mut(&mut state).unwrap().window_geom = Arc::new(DiscreteControlWindowGeom);
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
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
    fn per_app_profile_duration_honored() {
        let mut settings = AppSettings::default();
        settings.animation_time_ms = 1500;
        settings.easing_mode = smoothscroll_core::easing::EasingMode::Linear;
        let mut profile = ScrollProfile::new("blender", "Blender");
        profile.animation_time_ms = 50;
        profile.easing_mode = smoothscroll_core::easing::EasingMode::Linear;
        settings.profiles.push(profile.clone());
        settings.assign_profile("blender.exe".to_string(), Some(profile.id.clone()));

        let profile_eff = EffectiveSettings::with_profile(&settings, &profile);
        let state = make_state_with_processes(settings, Some("blender.exe"), None);
        state
            .effective_per_profile
            .write()
            .insert(profile.id, Arc::new(profile_eff.clone()));
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);

        let global = state.effective.load_full();
        let mut frames = 0;
        while state.engine.lock().has_pending_work() && frames < 200 {
            state.engine.lock().step(1000.0 / 120.0, &global);
            frames += 1;
        }
        assert!(frames < 45, "captured 50ms profile took {frames} frames");
    }

    #[test]
    fn profile_enables_immediate_horizontal_when_global_smoothing_is_disabled() {
        let mut settings = AppSettings::default();
        settings.horizontal_smoothness = false;
        let mut profile = ScrollProfile::new("blender", "Blender");
        profile.horizontal_smoothness = true;
        settings.profiles.push(profile.clone());
        settings.assign_profile("blender.exe".to_string(), Some(profile.id.clone()));

        let profile_eff = EffectiveSettings::with_profile(&settings, &profile);
        let recorder = Arc::new(RecordingEmitter::default());
        let mut state = make_state_with_processes(settings, Some("blender.exe"), None);
        Arc::get_mut(&mut state).unwrap().emitter = recorder.clone();
        state
            .effective_per_profile
            .write()
            .insert(profile.id, Arc::new(profile_eff));
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, shift_only()), HookDecision::Swallow);

        assert_eq!(recorder.immediate_calls.lock().as_slice(), &[120]);
        assert!(recorder.generic_calls.lock().is_empty());
        assert!(
            !state.engine.lock().has_pending_work(),
            "profile horizontal scroll must not wait for global frame settings"
        );
    }

    #[test]
    fn per_app_profile_easing_mode_honored() {
        let mut settings = AppSettings::default();
        settings.animation_time_ms = 50;
        settings.easing_mode = smoothscroll_core::easing::EasingMode::QuinticOut;
        let mut profile = ScrollProfile::new("blender", "Blender");
        profile.animation_time_ms = 50;
        profile.easing_mode = smoothscroll_core::easing::EasingMode::Linear;
        settings.profiles.push(profile.clone());
        settings.assign_profile("blender.exe".to_string(), Some(profile.id.clone()));

        let profile_eff = EffectiveSettings::with_profile(&settings, &profile);
        let state = make_state_with_processes(settings, Some("blender.exe"), None);
        state
            .effective_per_profile
            .write()
            .insert(profile.id, Arc::new(profile_eff.clone()));
        let sink = EngineSink::new(state.clone());
        let global = state.effective.load_full();
        let mut profile_control = SmoothScrollEngine::new();
        profile_control.on_wheel_with_source(
            120,
            0,
            smoothscroll_core::input_source::InputSource::Wheel,
            &profile_eff,
        );
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);

        let mut expected = Vec::new();
        let mut actual = Vec::new();
        for _ in 0..8 {
            expected.push(profile_control.step(1000.0 / 120.0, &profile_eff).vertical);
            actual.push(state.engine.lock().step(1000.0 / 120.0, &global).vertical);
        }
        assert_eq!(
            actual, expected,
            "Sink must register the assigned profile easing mode"
        );
    }
    #[cfg(not(target_os = "windows"))]
    #[test]
    fn game_mode_active_passes_through() {
        let s = AppSettings::default();
        let state = make_state(s);
        state.game_mode_active.store(true, Ordering::Release);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn stale_fullscreen_game_mode_state_resumes_smoothing_immediately() {
        let s = AppSettings::default();
        let state = make_state(s);
        state.publish_game_mode_state(true, None);
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert!(
            state.engine.lock().has_pending_work(),
            "stale fullscreen Game Mode must not block the first wheel event"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn current_fullscreen_game_mode_still_passes_through() {
        let s = AppSettings::default();
        let mut state = make_state(s);
        Arc::get_mut(&mut state).unwrap().fullscreen_detector = Arc::new(TrueFullscreen);
        state.publish_game_mode_state(true, None);
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windowed_known_game_still_passes_through() {
        const GAME_PID: u32 = 4242;
        let s = AppSettings::default();
        let mut state = make_state(s);
        Arc::get_mut(&mut state).unwrap().processes = Arc::new(StaticForegroundPid(GAME_PID));
        state.publish_game_mode_state(true, Some(GAME_PID));
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn stale_known_game_state_resumes_after_foreground_switch() {
        const OLD_GAME_PID: u32 = 4242;
        const NEW_FOREGROUND_PID: u32 = 9001;
        let s = AppSettings::default();
        let mut state = make_state(s);
        Arc::get_mut(&mut state).unwrap().processes =
            Arc::new(StaticForegroundPid(NEW_FOREGROUND_PID));
        state.publish_game_mode_state(true, Some(OLD_GAME_PID));
        let sink = EngineSink::new(state.clone());

        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    fn commit_settings_animation_time_off_forces_instant_mode() {
        use smoothscroll_core::settings::RespectReduceMotion;
        let s: AppSettings = serde_json::from_value(serde_json::json!({
            "animation_time_enabled": false,
            "respect_reduce_motion": RespectReduceMotion::Never,
        }))
        .unwrap();
        let state = make_state(s.clone());
        state.reduce_motion.store(false, Ordering::Relaxed);

        state.commit_settings(s);

        assert!(state.effective.load_full().instant_mode);
    }

    #[test]
    fn commit_settings_auto_follows_os_reduce_motion() {
        use smoothscroll_core::settings::RespectReduceMotion;
        let mut s = AppSettings::default();
        s.animation_time_enabled = true;
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
        s.animation_time_enabled = true;
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
        s.animation_time_enabled = true;
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
    fn ctrl_wheel_smooths_with_captured_ctrl_semantic() {
        let mut s = AppSettings::default();
        s.modifier_passthrough.ctrl = false;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let mods = ModifierKeys {
            ctrl: true,
            ..ModifierKeys::default()
        };
        assert_eq!(sink.on_wheel(120, mods), HookDecision::Swallow);

        let eff = state.effective.load_full();
        let pulse = loop {
            if let Some(pulse) = state.engine.lock().step(1000.0 / 120.0, &eff).vertical {
                break pulse;
            }
        };
        assert!(pulse.sequence.semantic.modifiers.ctrl);
        state
            .engine
            .lock()
            .reset_axis_if_sequence(WheelAxis::Vertical, pulse.sequence);
    }

    #[test]
    fn ctrl_shift_wheel_uses_generic_vertical_semantic() {
        let mut s = AppSettings::default();
        s.modifier_passthrough.ctrl = false;
        s.zoom_invert = true;
        let state = make_state(s);
        let sink = EngineSink::new(state.clone());
        let mods = ModifierKeys {
            ctrl: true,
            shift: true,
            ..ModifierKeys::default()
        };
        assert_eq!(sink.on_wheel(120, mods), HookDecision::Swallow);

        let eff = state.effective.load_full();
        let pulse = loop {
            if let Some(pulse) = state.engine.lock().step(1000.0 / 120.0, &eff).vertical {
                break pulse;
            }
        };
        assert_eq!(
            pulse.sequence.delta_transform,
            DeltaTransform::Generic { sign: 1 }
        );
        assert!(pulse.sequence.semantic.modifiers.ctrl);
        assert!(pulse.sequence.semantic.modifiers.shift);
    }

    #[test]
    fn per_app_profile_zoom_settings_override_global_settings() {
        let mut settings = AppSettings::default();
        settings.smooth_zoom = true;
        settings.zoom_invert = false;
        settings.zoom_sensitivity = 0.5;
        let mut profile = ScrollProfile::new("blender", "Blender");
        profile.smooth_zoom = false;
        profile.zoom_invert = true;
        profile.zoom_sensitivity = 2.5;
        settings.profiles.push(profile.clone());
        settings.assign_profile("blender.exe".to_string(), Some(profile.id.clone()));

        let profile_eff = EffectiveSettings::with_profile(&settings, &profile);
        let state = make_state_with_processes(settings, Some("blender.exe"), None);
        state
            .effective_per_profile
            .write()
            .insert(profile.id, Arc::new(profile_eff));
        let sink = EngineSink::new(state.clone());
        let mods = ModifierKeys {
            ctrl: true,
            ..ModifierKeys::default()
        };

        assert_eq!(sink.on_wheel(120, mods), HookDecision::Pass);
        let profile_eff = state
            .effective_per_profile
            .read()
            .values()
            .next()
            .unwrap()
            .clone();
        assert!(profile_eff.zoom_invert);
        assert_eq!(profile_eff.zoom_sensitivity, 2.5);
        assert!(!state.engine.lock().has_pending_work());
    }

    #[test]
    fn active_profile_enables_and_scales_ctrl_semantic() {
        let mut settings = AppSettings::default();
        settings.smooth_zoom = false;
        settings.zoom_invert = false;
        settings.zoom_sensitivity = 0.5;
        let mut profile = ScrollProfile::new("blender", "Blender");
        profile.smooth_zoom = true;
        profile.zoom_invert = true;
        profile.zoom_sensitivity = 2.0;
        settings.profiles.push(profile.clone());
        settings.assign_profile("blender.exe".to_string(), Some(profile.id.clone()));

        let profile_eff = EffectiveSettings::with_profile(&settings, &profile);
        let state = make_state_with_processes(settings, Some("blender.exe"), None);
        state
            .effective_per_profile
            .write()
            .insert(profile.id, Arc::new(profile_eff));
        let sink = EngineSink::new(state.clone());
        let mods = ModifierKeys {
            ctrl: true,
            ..ModifierKeys::default()
        };

        assert_eq!(sink.on_wheel(120, mods), HookDecision::Swallow);
        let eff = state.effective.load_full();
        let pulse = loop {
            if let Some(pulse) = state.engine.lock().step(1000.0 / 120.0, &eff).vertical {
                break pulse;
            }
        };
        assert_eq!(
            pulse.sequence.delta_transform,
            DeltaTransform::CtrlZoom {
                sensitivity: 2.0,
                sign: -1,
            }
        );
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
        let state = make_state_with_elevation(s, Some("Code"), true, false);
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
        let state = make_state_with_elevation(s, Some("Code"), false, false);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    #[cfg(windows)]
    fn elevated_self_processes_normally() {
        // When SmoothScroll itself is elevated, elevated→elevated injection is
        // legal under UIPI — the engine must process the event instead of
        // passing it through. Regression check for the bug where running
        // SmoothScroll from an elevated session disabled smoothing everywhere.
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), true, true);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_wheel(120, no_mods()), HookDecision::Swallow);
        assert!(state.engine.lock().has_pending_work());
    }

    #[test]
    #[cfg(windows)]
    fn elevated_horizontal_wheel_passes_through() {
        let s = AppSettings::default();
        let state = make_state_with_elevation(s, Some("Code"), true, false);
        let sink = EngineSink::new(state.clone());
        assert_eq!(sink.on_hwheel(120), HookDecision::Pass);
        assert!(!state.engine.lock().has_pending_work());
    }
}
