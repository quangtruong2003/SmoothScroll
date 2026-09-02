//! Shared mutable state for the Tauri app.

use arc_swap::ArcSwap;
use parking_lot::{Condvar, Mutex, RwLock};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
use smoothscroll_core::wheel::WheelAxis;
use smoothscroll_platform::icon::IconCache;
use smoothscroll_platform::traits::{
    Autostart, FullscreenDetector, Hotkey, HotkeyHandle, MonitorEnumeration, MouseHook,
    ProcessQuery, SemanticWheelEmitter, WindowGeometry,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;

#[derive(Default)]
pub struct EngineSignal {
    pub mutex: Mutex<bool>,
    pub cv: Condvar,
}

impl EngineSignal {
    pub fn signal(&self) {
        let mut flag = self.mutex.lock();
        *flag = true;
        self.cv.notify_all();
    }
}

#[derive(Default)]
pub struct AnimationOwner {
    hwnd: AtomicIsize,
}

impl AnimationOwner {
    pub fn get(&self) -> Option<isize> {
        let hwnd = self.hwnd.load(Ordering::Acquire);
        (hwnd != 0).then_some(hwnd)
    }

    pub fn set(&self, hwnd: Option<isize>) {
        self.hwnd.store(hwnd.unwrap_or(0), Ordering::Release);
    }

    pub fn clear(&self) {
        self.set(None);
    }
}

/// Per-axis generation tokens for the semantic wheel pipeline. A semantic,
/// raw, or root transition on one axis invalidates only that axis's queued
/// work; a root-window change invalidates both axes. The `Arc<AtomicU64>`
/// handles are shared with the platform emitters via `EmissionContext` so
/// queued work validates against the exact counter it was planned under.
#[derive(Debug, Default)]
pub struct WheelAxisGenerations {
    vertical: Arc<AtomicU64>,
    horizontal: Arc<AtomicU64>,
}

impl WheelAxisGenerations {
    pub fn get(&self, axis: WheelAxis) -> u64 {
        self.token(axis).load(Ordering::Acquire)
    }

    pub fn invalidate(&self, axis: WheelAxis) {
        self.token(axis).fetch_add(1, Ordering::Release);
    }

    pub fn invalidate_all(&self) {
        self.invalidate(WheelAxis::Vertical);
        self.invalidate(WheelAxis::Horizontal);
    }

    /// The shared token for one axis; passed to the emitter in
    /// `EmissionContext` so the platform validates against this store.
    pub fn token(&self, axis: WheelAxis) -> Arc<AtomicU64> {
        match axis {
            WheelAxis::Vertical => self.vertical.clone(),
            WheelAxis::Horizontal => self.horizontal.clone(),
        }
    }
}

#[allow(dead_code)]
pub struct AppState {
    pub engine: Arc<Mutex<SmoothScrollEngine>>,
    /// Ephemeral owner of the current Windows animated sequence.
    /// `None` outside an owned sequence; never persisted.
    pub animation_owner: Arc<AnimationOwner>,
    /// Authoritative store — written by commands, persisted to disk.
    pub settings: Arc<RwLock<AppSettings>>,
    /// Hot-path snapshot. Updated whenever `settings` changes or active profile changes.
    /// Readers are lock-free (one atomic load + Arc clone).
    pub effective: Arc<ArcSwap<EffectiveSettings>>,
    /// Pre-built EffectiveSettings per profile ID. Rebuilt on profile CRUD.
    pub effective_per_profile: Arc<RwLock<HashMap<String, Arc<EffectiveSettings>>>>,
    pub mouse_hook: Arc<dyn MouseHook>,
    pub semantic_emitter: Arc<dyn SemanticWheelEmitter>,
    /// Per-axis semantic generation tokens; see `WheelAxisGenerations`.
    pub wheel_generations: Arc<WheelAxisGenerations>,
    pub processes: Arc<dyn ProcessQuery>,
    pub autostart: Arc<dyn Autostart>,
    pub hotkey: Arc<dyn Hotkey>,
    pub hotkey_handle: Arc<Mutex<Option<HotkeyHandle>>>,
    pub engine_signal: Arc<EngineSignal>,
    pub enabled: Arc<AtomicBool>,
    /// UI/non-Windows mirror of Game Mode activity. The Windows hook uses the
    /// packed `game_mode_hook_state` below so active + known-game PID are read
    /// as one coherent snapshot instead of two independently published atomics.
    pub game_mode_active: Arc<AtomicBool>,
    /// Packed Windows hook snapshot: bit 32 = active; low 32 bits = known-game
    /// foreground PID (0 when inactive).
    pub game_mode_hook_state: Arc<AtomicU64>,
    pub fullscreen_detector: Arc<dyn FullscreenDetector>,
    pub window_geom: Arc<dyn WindowGeometry>,
    pub monitor_enum: Arc<dyn MonitorEnumeration>,
    pub last_input_source: Arc<AtomicU8>,
    pub persistor: Arc<crate::settings_persistor::SettingsPersistor>,
    // Accessibility
    pub reduce_motion: Arc<AtomicBool>,
    pub accessibility: Arc<dyn smoothscroll_platform::traits::AccessibilitySignals>,
    pub rm_watch_handle: Arc<parking_lot::Mutex<Option<smoothscroll_platform::traits::HookHandle>>>,
    /// Foreground process snapshot taken right before the tray panel is shown,
    /// so the panel itself does not register as the foreground window. Consumed
    /// (taken) by `get_foreground_app_context` so a stale value does not leak
    /// between tray opens.
    pub last_foreground_at_tray_open: Arc<Mutex<Option<String>>>,
    /// In-memory cache mapping foreground process pid → base64-encoded PNG
    /// of that app's icon. Used by `get_foreground_app_context` to populate
    /// the tray panel row with a real app icon.
    pub app_icon_cache: Arc<Mutex<IconCache>>,
    pub stats: smoothscroll_core::stats::StatsCollector,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn animation_owner_round_trips_and_clears() {
        let owner = AnimationOwner::default();
        assert_eq!(owner.get(), None);

        owner.set(Some(0x1234));
        assert_eq!(owner.get(), Some(0x1234));

        owner.clear();
        assert_eq!(owner.get(), None);
    }

    #[test]
    fn wheel_generations_are_monotonic_and_axis_independent() {
        let generations = WheelAxisGenerations::default();
        let v0 = generations.get(WheelAxis::Vertical);
        let h0 = generations.get(WheelAxis::Horizontal);

        generations.invalidate(WheelAxis::Vertical);
        assert_eq!(generations.get(WheelAxis::Vertical), v0 + 1);
        assert_eq!(generations.get(WheelAxis::Horizontal), h0);

        generations.invalidate(WheelAxis::Vertical);
        assert_eq!(generations.get(WheelAxis::Vertical), v0 + 2);

        generations.invalidate(WheelAxis::Horizontal);
        assert_eq!(generations.get(WheelAxis::Vertical), v0 + 2);
        assert_eq!(generations.get(WheelAxis::Horizontal), h0 + 1);
    }

    #[test]
    fn wheel_generations_invalidate_all_bumps_both_axes() {
        let generations = WheelAxisGenerations::default();
        let v0 = generations.get(WheelAxis::Vertical);
        let h0 = generations.get(WheelAxis::Horizontal);

        generations.invalidate_all();

        assert_eq!(generations.get(WheelAxis::Vertical), v0 + 1);
        assert_eq!(generations.get(WheelAxis::Horizontal), h0 + 1);
    }
}

const GAME_MODE_ACTIVE_BIT: u64 = 1 << 32;
const GAME_MODE_PID_MASK: u64 = u32::MAX as u64;

impl AppState {
    /// Publish one coherent Game Mode snapshot for the Windows hook. The packed
    /// atomic is authoritative for hook decisions; `game_mode_active` is only a
    /// status mirror, so no hook logic depends on cross-atomic publication order.
    pub fn publish_game_mode_state(&self, active: bool, known_game_pid: Option<u32>) {
        let known_game_pid = if active {
            known_game_pid.unwrap_or(0)
        } else {
            0
        };
        let hook_state = if active {
            GAME_MODE_ACTIVE_BIT | u64::from(known_game_pid)
        } else {
            0
        };

        self.game_mode_hook_state
            .store(hook_state, Ordering::Release);
        self.game_mode_active.store(active, Ordering::Release);
    }

    /// Acquire the coherent Game Mode snapshot published by the poll thread.
    pub fn game_mode_hook_snapshot(&self) -> (bool, Option<u32>) {
        let hook_state = self.game_mode_hook_state.load(Ordering::Acquire);
        let active = hook_state & GAME_MODE_ACTIVE_BIT != 0;
        let pid = (hook_state & GAME_MODE_PID_MASK) as u32;
        let known_game_pid = (active && pid != 0).then_some(pid);
        (active, known_game_pid)
    }

    /// Apply one settings snapshot and rebuild all hot-path views. Startup loads
    /// use `persist = false` because path-aware schema migration has already
    /// persisted when necessary; user mutations use `commit_settings`.
    fn apply_settings(&self, new: AppSettings, persist: bool) {
        use smoothscroll_core::settings::RespectReduceMotion;
        let os_rm = self.reduce_motion.load(Ordering::Relaxed);
        let reduce_motion_instant = match new.respect_reduce_motion {
            RespectReduceMotion::Always => true,
            RespectReduceMotion::Never => false,
            RespectReduceMotion::Auto => os_rm,
        };
        let instant = !new.animation_time_enabled || reduce_motion_instant;

        let mut new_eff = EffectiveSettings::from_settings(&new);
        new_eff.instant_mode = instant;

        let new_per_profile: HashMap<String, Arc<EffectiveSettings>> = new
            .profiles
            .iter()
            .map(|p| {
                let mut eff = EffectiveSettings::with_profile(&new, p);
                eff.instant_mode = instant;
                (p.id.clone(), Arc::new(eff))
            })
            .collect();
        {
            let mut w = self.settings.write();
            *w = new.clone();
        }
        self.effective.store(Arc::new(new_eff));
        *self.effective_per_profile.write() = new_per_profile;
        if persist {
            self.persistor.submit(new);
        }
    }

    /// Apply settings loaded from disk without scheduling an unconditional
    /// startup rewrite.
    pub fn apply_loaded_settings(&self, new: AppSettings) {
        self.apply_settings(new, false);
    }

    /// Commit a runtime/user settings change and queue the debounced disk write.
    pub fn commit_settings(&self, new: AppSettings) {
        self.apply_settings(new, true);
    }
}
