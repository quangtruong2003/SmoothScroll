//! Shared mutable state for the Tauri app.

use arc_swap::ArcSwap;
use parking_lot::{Condvar, Mutex, RwLock};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
use smoothscroll_platform::traits::{
    Autostart, FullscreenDetector, HookHandle, Hotkey, HotkeyHandle, KeyboardScrollHook, MouseHook,
    ProcessQuery, WheelEmitter, WindowGeometry,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU8};
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

#[allow(dead_code)]
pub struct AppState {
    pub engine: Arc<Mutex<SmoothScrollEngine>>,
    /// Authoritative store — written by commands, persisted to disk.
    pub settings: Arc<RwLock<AppSettings>>,
    /// Hot-path snapshot. Updated whenever `settings` changes or active profile changes.
    /// Readers are lock-free (one atomic load + Arc clone).
    pub effective: Arc<ArcSwap<EffectiveSettings>>,
    /// Pre-built EffectiveSettings per profile ID. Rebuilt on profile CRUD.
    pub effective_per_profile: Arc<RwLock<HashMap<String, Arc<EffectiveSettings>>>>,
    pub mouse_hook: Arc<dyn MouseHook>,
    pub emitter: Arc<dyn WheelEmitter>,
    pub processes: Arc<dyn ProcessQuery>,
    pub autostart: Arc<dyn Autostart>,
    pub hotkey: Arc<dyn Hotkey>,
    pub hotkey_handle: Arc<Mutex<Option<HotkeyHandle>>>,
    pub keyboard_hook: Arc<dyn KeyboardScrollHook>,
    pub keyboard_handle: Arc<Mutex<Option<HookHandle>>>,
    pub engine_signal: Arc<EngineSignal>,
    pub enabled: Arc<AtomicBool>,
    pub game_mode_active: Arc<AtomicBool>,
    pub fullscreen_detector: Arc<dyn FullscreenDetector>,
    pub window_geom: Arc<dyn WindowGeometry>,
    pub last_input_source: Arc<AtomicU8>,
    pub persistor: Arc<crate::settings_persistor::SettingsPersistor>,
}

impl AppState {
    /// Atomically replace the authoritative settings, rebuild the hot-path
    /// effective snapshot, rebuild the per-profile cache, and queue a debounced
    /// disk write. This is the ONLY path that should mutate settings.
    pub fn commit_settings(&self, new: AppSettings) {
        let new_eff = EffectiveSettings::from_settings(&new);
        let new_per_profile: HashMap<String, Arc<EffectiveSettings>> = new
            .profiles
            .iter()
            .map(|p| {
                (
                    p.id.clone(),
                    Arc::new(EffectiveSettings::with_profile(&new, p)),
                )
            })
            .collect();
        {
            let mut w = self.settings.write();
            *w = new.clone();
        }
        self.effective.store(Arc::new(new_eff));
        *self.effective_per_profile.write() = new_per_profile;
        self.persistor.submit(new);
    }
}
