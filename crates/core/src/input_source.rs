//! Classifies wheel events as Wheel / HighResWheel / Touchpad based on
//! delta magnitude, event frequency, and inter-event timing patterns.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputSource {
    Wheel,
    HighResWheel,
    Touchpad,
}

const HISTORY_WINDOW_MS: u64 = 300;
const TOUCHPAD_EVENT_THRESHOLD: usize = 4;
const TOUCHPAD_MAX_INTERVAL_MS: u64 = 50;
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

        if abs_delta == STANDARD_NOTCH_DELTA {
            return InputSource::Wheel;
        }

        if event_count >= 2 {
            let first_time = self.recent.front().map(|(t, _)| *t).unwrap_or(now_ms);
            let window_duration = now_ms.saturating_sub(first_time);

            if window_duration > 0 {
                let events_per_second = (event_count as f64) * 1000.0 / (window_duration as f64);
                let avg_interval_ms = window_duration as f64 / (event_count.saturating_sub(1) as f64);

                if event_count >= TOUCHPAD_EVENT_THRESHOLD
                    && abs_delta < STANDARD_NOTCH_DELTA
                    && avg_interval_ms <= TOUCHPAD_MAX_INTERVAL_MS as f64
                    && events_per_second >= 30.0
                {
                    return InputSource::Touchpad;
                }
            }
        }

        if abs_delta < STANDARD_NOTCH_DELTA {
            return InputSource::HighResWheel;
        }
        InputSource::Wheel
    }
}
