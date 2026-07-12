use arc_swap::ArcSwap;
use parking_lot::{Condvar, Mutex, RwLock};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
use smoothscroll_platform::traits::{
    FullscreenDetector, MonitorEnumeration, MouseHook, ProcessQuery, WheelEmitter, WindowGeometry, ZoomEmitter,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
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

pub struct AppState {
    pub engine: Arc<Mutex<SmoothScrollEngine>>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub effective: Arc<ArcSwap<EffectiveSettings>>,
    pub effective_per_profile: Arc<RwLock<HashMap<String, Arc<EffectiveSettings>>>>,
    pub mouse_hook: Arc<dyn MouseHook>,
    pub emitter: Arc<dyn WheelEmitter>,
    pub zoom_emitter: Arc<dyn ZoomEmitter>,
    pub processes: Arc<dyn ProcessQuery>,
    pub engine_signal: Arc<EngineSignal>,
    pub enabled: Arc<AtomicBool>,
    pub fullscreen_detector: Arc<dyn FullscreenDetector>,
    pub window_geom: Arc<dyn WindowGeometry>,
    pub monitor_enum: Arc<dyn MonitorEnumeration>,
    pub persistor: Arc<crate::settings_persistor::SettingsPersistor>,
    pub reduce_motion: Arc<AtomicBool>,
    pub accessibility: Arc<dyn smoothscroll_platform::traits::AccessibilitySignals>,
}

impl AppState {
    pub fn commit_settings(&self, new: AppSettings) {
        use smoothscroll_core::settings::RespectReduceMotion;
        let os_rm = self.reduce_motion.load(Ordering::Relaxed);
        let instant = match new.respect_reduce_motion {
            RespectReduceMotion::Always => true,
            RespectReduceMotion::Never => false,
            RespectReduceMotion::Auto => os_rm,
        };

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
        self.persistor.submit(new);
    }
}
