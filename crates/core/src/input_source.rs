//! Classifies wheel events as Wheel / HighResWheel / Touchpad based on
//! delta magnitude and event frequency.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputSource {
    Wheel,
    HighResWheel,
    Touchpad,
}

const HISTORY_WINDOW_MS: u64 = 200;
const TOUCHPAD_EVENT_THRESHOLD: usize = 5;
const STANDARD_NOTCH_DELTA: i32 = 120;

pub struct InputClassifier {
    recent: VecDeque<(u64, i32)>,
}

impl Default for InputClassifier {
    fn default() -> Self {
        Self::new()
    }
}

impl InputClassifier {
    pub fn new() -> Self {
        Self {
            recent: VecDeque::with_capacity(32),
        }
    }

    pub fn classify(&mut self, delta: i32, now_ms: u64) -> InputSource {
        while let Some(&(t, _)) = self.recent.front() {
            if now_ms.saturating_sub(t) > HISTORY_WINDOW_MS {
                self.recent.pop_front();
            } else {
                break;
            }
        }
        self.recent.push_back((now_ms, delta));

        let abs_delta = delta.unsigned_abs() as i32;
        let event_count = self.recent.len();

        if abs_delta == 0 {
            return InputSource::Wheel;
        }
        if event_count > TOUCHPAD_EVENT_THRESHOLD && abs_delta < STANDARD_NOTCH_DELTA {
            return InputSource::Touchpad;
        }
        if abs_delta < STANDARD_NOTCH_DELTA {
            return InputSource::HighResWheel;
        }
        InputSource::Wheel
    }
}
