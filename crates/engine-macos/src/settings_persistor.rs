use smoothscroll_core::settings::AppSettings;
use std::sync::mpsc;

pub struct SettingsPersistor {
    tx: mpsc::Sender<AppSettings>,
    _handle: std::thread::JoinHandle<()>,
}

impl SettingsPersistor {
    pub fn spawn() -> Self {
        let (tx, rx) = mpsc::channel();
        let handle = std::thread::spawn(move || {
            while let Ok(settings) = rx.recv() {
                if let Err(e) = smoothscroll_core::settings::save(&settings) {
                    tracing::warn!(error = %e, "failed to save settings");
                }
            }
        });
        Self { tx, _handle: handle }
    }

    pub fn submit(&self, settings: AppSettings) {
        let _ = self.tx.send(settings);
    }
}
