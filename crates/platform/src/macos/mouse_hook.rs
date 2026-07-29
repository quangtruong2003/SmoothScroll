//! macOS CGEventTap-based mouse hook for scroll event interception.

#![cfg(target_os = "macos")]

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;

use super::event_tap::{install_on_current_thread, run_event_loop_current_thread};

pub struct MacosMouseHook {
    stop_flag: Arc<AtomicBool>,
}

impl MacosMouseHook {
    pub fn new() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Default for MacosMouseHook {
    fn default() -> Self {
        Self::new()
    }
}

struct InstalledHook {
    #[allow(dead_code)]
    join: Option<thread::JoinHandle<()>>,
    stop_flag: Arc<AtomicBool>,
}

impl Drop for InstalledHook {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        if let Some(h) = self.join.take() {
            let _ = h.join();
        }
    }
}

impl MouseHook for MacosMouseHook {
    /// Install the tap on a dedicated thread-owned Core Foundation run loop.
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        self.stop_flag.store(false, Ordering::SeqCst);
        let stop = self.stop_flag.clone();
        let (ready_tx, ready_rx) = mpsc::sync_channel::<std::result::Result<(), String>>(1);

        let join = thread::Builder::new()
            .name("ss-macos-wheel-hook".into())
            .spawn(move || {
                let installed = match unsafe { install_on_current_thread(sink) } {
                    Ok(installed) => installed,
                    Err(error) => {
                        let _ = ready_tx.send(Err(error.to_string()));
                        return;
                    }
                };
                let _ = ready_tx.send(Ok(()));
                if let Err(e) = run_event_loop_current_thread(installed, stop) {
                    eprintln!("ss-macos-wheel-hook: event loop exited: {e}");
                }
            })
            .map_err(|e| PlatformError::Os(format!("failed to spawn hook thread: {e}")))?;

        if let Err(error) = ready_rx
            .recv()
            .map_err(|e| PlatformError::Os(format!("event tap setup failed: {e}")))?
        {
            self.stop_flag.store(true, Ordering::SeqCst);
            let _ = join.join();
            return Err(if error.contains("permission") {
                PlatformError::PermissionDenied
            } else {
                PlatformError::Os(error)
            });
        }

        Ok(HookHandle::new(Box::new(InstalledHook {
            join: Some(join),
            stop_flag: self.stop_flag.clone(),
        })))
    }
}
