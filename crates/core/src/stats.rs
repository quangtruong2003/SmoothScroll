use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyStats {
    pub date: String,
    pub total_scroll_distance_px: f64,
    pub total_notches: u64,
    pub active_time_ms: u64,
    pub app_distances: HashMap<String, f64>,
    pub profile_switches: u32,
    pub peak_velocity: f64,
}

pub struct StatsCollector {
    today: Mutex<DailyStats>,
    save_path: PathBuf,
}

impl StatsCollector {
    pub fn new(save_path: PathBuf) -> Self {
        let stats = if save_path.exists() {
            std::fs::read_to_string(&save_path)
                .ok()
                .and_then(|json| serde_json::from_str(&json).ok())
                .unwrap_or_default()
        } else {
            DailyStats::default()
        };
        Self {
            today: Mutex::new(stats),
            save_path,
        }
    }

    pub fn record_distance(&self, px: f64, process_name: &str) {
        let mut s = self.today.lock().unwrap();
        s.total_scroll_distance_px += px.abs();
        *s.app_distances.entry(process_name.to_string()).or_default() += px.abs();
    }

    pub fn record_active_time(&self, dt_ms: u64) {
        self.today.lock().unwrap().active_time_ms += dt_ms;
    }

    pub fn record_notch(&self) {
        self.today.lock().unwrap().total_notches += 1;
    }

    pub fn record_profile_switch(&self) {
        self.today.lock().unwrap().profile_switches += 1;
    }

    pub fn record_velocity(&self, velocity: f64) {
        let mut s = self.today.lock().unwrap();
        if velocity > s.peak_velocity {
            s.peak_velocity = velocity;
        }
    }

    pub fn snapshot(&self) -> DailyStats {
        self.today.lock().unwrap().clone()
    }

    pub fn periodic_save(&self) {
        let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
        {
            let mut s = self.today.lock().unwrap();
            if s.date != today_str {
                *s = DailyStats {
                    date: today_str,
                    ..Default::default()
                };
            }
        }
        let s = self.today.lock().unwrap();
        if let Ok(json) = serde_json::to_string_pretty(&*s) {
            let tmp = self.save_path.with_extension("tmp");
            if std::fs::write(&tmp, &json).is_ok() {
                let _ = std::fs::rename(&tmp, &self.save_path);
            }
        }
    }
}
