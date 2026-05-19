//! macOS accessibility signal access via `NSWorkspace`.
//!
//! `accessibilityDisplayShouldReduceMotion` returns true when the user has
//! enabled "Reduce Motion" in System Settings > Accessibility > Display.

#![cfg(target_os = "macos")]

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct MacosAccessibilitySignals;

fn query_reduce_motion() -> bool {
    use objc2::msg_send;
    use objc2_app_kit::NSWorkspace;
    // SAFETY: `sharedWorkspace` returns the process-wide singleton.
    // `accessibilityDisplayShouldReduceMotion` is a stable property on
    // NSWorkspace (since macOS 10.12) returning BOOL; we call it via
    // msg_send! because the typed binding is gated behind a feature
    // category that varies across objc2-app-kit 0.2.x patch versions.
    unsafe {
        let workspace = NSWorkspace::sharedWorkspace();
        let result: bool = msg_send![&*workspace, accessibilityDisplayShouldReduceMotion];
        result
    }
}

impl AccessibilitySignals for MacosAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        query_reduce_motion()
    }

    fn watch(&self, on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle> {
        // 1 Hz polling thread mirrors the Windows impl. Avoids wiring an
        // NSDistributedNotificationCenter observer for what is a
        // low-frequency signal.
        let stop = Arc::new(AtomicBool::new(false));
        let stop_clone = stop.clone();
        let last = Arc::new(AtomicBool::new(query_reduce_motion()));
        let last_clone = last.clone();
        std::thread::Builder::new()
            .name("smoothscroll-rm-watch".into())
            .spawn(move || {
                while !stop_clone.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    let cur = query_reduce_motion();
                    let prev = last_clone.swap(cur, Ordering::Relaxed);
                    if cur != prev {
                        on_change(cur);
                    }
                }
            })
            .map_err(|e| PlatformError::Os(e.to_string()))?;

        struct Guard(Arc<AtomicBool>);
        impl Drop for Guard {
            fn drop(&mut self) {
                self.0.store(true, Ordering::Relaxed);
            }
        }
        Ok(HookHandle::new(Box::new(Guard(stop))))
    }
}
