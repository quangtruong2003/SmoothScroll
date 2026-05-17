//! Bridges keyboard scroll-key events into the engine's wheel pipeline.
//!
//! Listens for VK_NEXT/VK_PRIOR/VK_SPACE/VK_UP/VK_DOWN events from the
//! platform `KeyboardScrollHook`, maps to wheel notches via
//! `KeyboardScrollKey::to_notches`, and feeds `engine.on_wheel`. Respects
//! `keyboard_smart_text_skip` via `is_focus_in_text_input()` on Windows.

use crate::state::AppState;
use smoothscroll_core::constants::WHEEL_DELTA;
use smoothscroll_platform::traits::KeyboardScrollSink;
use smoothscroll_platform::types::{HookDecision, KeyboardKeyEvent};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Instant;

pub struct KeyboardEngineSink {
    pub state: Arc<AppState>,
    pub epoch: Instant,
}

impl KeyboardEngineSink {
    pub fn new(state: Arc<AppState>) -> Arc<Self> {
        Arc::new(Self {
            state,
            epoch: Instant::now(),
        })
    }
}

impl KeyboardScrollSink for KeyboardEngineSink {
    fn on_key(&self, ev: KeyboardKeyEvent) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        let s = self.state.settings.read();
        if !s.keyboard_scroll_enabled {
            return HookDecision::Pass;
        }
        let key_str = match ev.key {
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::PageDown => "PageDown",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::PageUp => "PageUp",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::Space => "Space",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::ShiftSpace => "ShiftSpace",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::ArrowDown => "ArrowDown",
            smoothscroll_core::keyboard_scroll::KeyboardScrollKey::ArrowUp => "ArrowUp",
        };
        if !s.keyboard_scroll_keys.iter().any(|k| k == key_str) {
            return HookDecision::Pass;
        }
        let smart = s.keyboard_smart_text_skip;
        let pgdn = s.keyboard_pgdn_step_notches;
        let arrow = s.keyboard_arrow_step_notches;
        drop(s);

        #[cfg(windows)]
        if smart && smoothscroll_platform::windows::is_focus_in_text_input() {
            return HookDecision::Pass;
        }
        #[cfg(not(windows))]
        let _ = smart;

        let notches = ev.key.to_notches(pgdn, arrow);
        if notches == 0 {
            return HookDecision::Pass;
        }
        let delta = notches * WHEEL_DELTA;
        let now_ms = self.epoch.elapsed().as_millis() as u64;
        self.state.engine.lock().on_wheel(delta, now_ms);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }
}
