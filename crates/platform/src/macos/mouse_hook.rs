//! macOS CGEventTap-based mouse hook for scroll event interception.

#![cfg(target_os = "macos")]

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use super::event_tap::{install_on_main_thread, run_event_loop, InstalledTap};

pub struct MacosMouseHook {
    stop_flag: Arc<AtomicBool>,
    installed: parking_lot::Mutex<Option<InstalledTap>>,
}

impl MacosMouseHook {
    pub fn new() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
            installed: parking_lot::Mutex::new(None),
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
    /// Install the macOS event tap.
    ///
    /// `install` is invoked from Tauri's `setup` callback, which runs on
    /// the **main thread** before NSApp's event loop starts pumping. We
    /// exploit that to install the tap synchronously on the main thread
    /// (a hard requirement for `kCGHIDEventTap`) and then spawn a small
    /// background thread that blocks on the `stop` flag.
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let installed = unsafe { install_on_main_thread(sink) }?;
        // Send the source's address across the thread boundary; the raw
        // pointer itself is `!Send` but the integer address is `Send`.
        let source_addr = installed.source as usize;
        let running = installed.running.clone();
        let stop = self.stop_flag.clone();

        // Persist for explicit teardown if needed.
        *self.installed.lock() = Some(installed);

        let join = thread::Builder::new()
            .name("ss-macos-wheel-hook".into())
            .spawn(move || {
                if let Err(e) = run_event_loop(source_addr, running, stop) {
                    eprintln!("ss-macos-wheel-hook: event loop exited: {e}");
                }
            })
            .map_err(|e| PlatformError::Os(format!("failed to spawn hook thread: {e}")))?;

        Ok(HookHandle::new(Box::new(InstalledHook {
            join: Some(join),
            stop_flag: self.stop_flag.clone(),
        })))
    }
}
