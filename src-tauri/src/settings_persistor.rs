//! Background worker that debounces settings disk writes.

use crossbeam_channel::{self as channel, Receiver, Sender};
use std::path::PathBuf;
use std::thread::{self, JoinHandle};
use std::time::Instant;

const DEBOUNCE_MS: u64 = 300;

/// Message sent from command threads to the persistor worker.
#[derive(Debug)]
#[allow(clippy::large_enum_variant)]
enum Message {
    Save(smoothscroll_core::settings::AppSettings),
    Shutdown,
}

/// SettingsPersistor owns a background thread that receives save requests,
/// debounces them by 300 ms, and writes the latest snapshot to disk.
pub struct SettingsPersistor {
    tx: Sender<Message>,
    handle: parking_lot::Mutex<Option<JoinHandle<()>>>,
}

/// Resolve the default settings path, or fall back to a temp file when the
/// config dir is unavailable so the worker can still drain its queue.
fn resolve_default_path() -> PathBuf {
    smoothscroll_core::settings::settings_path()
        .unwrap_or_else(|e| {
            tracing::warn!(error = ?e, "settings path unavailable; persisting to temp file");
            std::env::temp_dir().join("smoothscroll-settings-fallback.json")
        })
}

impl SettingsPersistor {
    /// Spawn the background worker thread writing to the user's settings path.
    pub fn spawn() -> Self {
        Self::spawn_with_path(resolve_default_path())
    }

    /// Spawn the worker bound to an explicit path. Tests use a temp path so
    /// they never touch the developer's real settings.json.
    pub fn spawn_with_path(path: PathBuf) -> Self {
        spawn_worker(path)
    }

    /// Queue a settings snapshot for debounced disk write.
    /// Multiple calls within 300 ms are collapsed into one write.
    pub fn submit(&self, snapshot: smoothscroll_core::settings::AppSettings) {
        let _ = self.tx.send(Message::Save(snapshot));
    }

    /// Drain the pending write and stop the worker. Blocks until the worker
    /// exits. Safe to call from `Drop` because it only takes `&self`.
    pub fn shutdown(&self) {
        let _ = self.tx.send(Message::Shutdown);
        if let Some(h) = self.handle.lock().take() {
            let _ = h.join();
        }
    }
}

fn spawn_worker(path: PathBuf) -> SettingsPersistor {
    let (tx, rx) = channel::bounded(8);
    let handle = thread::Builder::new()
        .name("ss-settings-persistor".into())
        .spawn(move || worker(rx, path))
        .expect("spawn settings persistor thread");
    SettingsPersistor {
        tx,
        handle: parking_lot::Mutex::new(Some(handle)),
    }
}

impl Drop for SettingsPersistor {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn worker(rx: Receiver<Message>, path: PathBuf) {
    let deadline = std::time::Duration::from_millis(DEBOUNCE_MS);
    let mut pending: Option<smoothscroll_core::settings::AppSettings> = None;

    loop {
        let first = match rx.recv() {
            Ok(Message::Save(s)) => s,
            Ok(Message::Shutdown) | Err(_) => {
                if let Some(s) = pending.take() {
                    if let Err(e) = smoothscroll_core::settings::save_to(&path, &s) {
                        tracing::warn!(error = %e, "settings save failed on shutdown");
                    }
                }
                return;
            }
        };
        pending = Some(first);

        let deadline_instant = Instant::now() + deadline;
        loop {
            match rx.recv_deadline(deadline_instant) {
                Ok(Message::Save(s)) => pending = Some(s),
                Ok(Message::Shutdown) => {
                    if let Some(s) = pending.take() {
                        if let Err(e) = smoothscroll_core::settings::save_to(&path, &s) {
                            tracing::warn!(error = %e, "settings save failed on shutdown");
                        }
                    }
                    return;
                }
                Err(channel::RecvTimeoutError::Timeout) => break,
                Err(channel::RecvTimeoutError::Disconnected) => {
                    if let Some(s) = pending.take() {
                        let _ = smoothscroll_core::settings::save_to(&path, &s);
                    }
                    return;
                }
            }
        }

        if let Some(s) = pending.take() {
            if let Err(e) = smoothscroll_core::settings::save_to(&path, &s) {
                tracing::warn!(error = %e, "settings save failed");
            }
        }
    }
}
