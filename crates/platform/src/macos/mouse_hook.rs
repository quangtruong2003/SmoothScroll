//! macOS CGEventTap-based mouse hook for scroll event interception.

#![cfg(target_os = "macos")]

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use super::event_tap::run_event_loop;

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
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let stop = self.stop_flag.clone();

        let join = thread::Builder::new()
            .name("ss-macos-wheel-hook".into())
            .spawn(move || {
                run_event_loop(sink, stop);
            })
            .map_err(|e| PlatformError::Os(format!("failed to spawn hook thread: {e}")))?;

        Ok(HookHandle::new(Box::new(InstalledHook {
            join: Some(join),
            stop_flag: self.stop_flag.clone(),
        })))
    }
}
