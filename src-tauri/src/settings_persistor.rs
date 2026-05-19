//! Background worker that debounces settings disk writes.

use crossbeam_channel::{self as channel, Receiver, Sender};
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

impl SettingsPersistor {
    /// Spawn the background worker thread.
    pub fn spawn() -> Self {
        let (tx, rx) = channel::bounded(8);
        let handle = thread::Builder::new()
            .name("ss-settings-persistor".into())
            .spawn(move || worker(rx))
            .expect("spawn settings persistor thread");
        Self {
            tx,
            handle: parking_lot::Mutex::new(Some(handle)),
        }
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

impl Drop for SettingsPersistor {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn worker(rx: Receiver<Message>) {
    let deadline = std::time::Duration::from_millis(DEBOUNCE_MS);
    let mut pending: Option<smoothscroll_core::settings::AppSettings> = None;

    loop {
        let first = match rx.recv() {
            Ok(Message::Save(s)) => s,
            Ok(Message::Shutdown) | Err(_) => {
                if let Some(s) = pending.take() {
                    if let Err(e) = smoothscroll_core::settings::save(&s) {
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
                        if let Err(e) = smoothscroll_core::settings::save(&s) {
                            tracing::warn!(error = %e, "settings save failed on shutdown");
                        }
                    }
                    return;
                }
                Err(channel::RecvTimeoutError::Timeout) => break,
                Err(channel::RecvTimeoutError::Disconnected) => {
                    if let Some(s) = pending.take() {
                        let _ = smoothscroll_core::settings::save(&s);
                    }
                    return;
                }
            }
        }

        if let Some(s) = pending.take() {
            if let Err(e) = smoothscroll_core::settings::save(&s) {
                tracing::warn!(error = %e, "settings save failed");
            }
        }
    }
}
