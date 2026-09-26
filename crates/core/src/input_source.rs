//! Classifies wheel events as Wheel / HighResWheel / Touchpad from the OS
//! touch/pen marker and delta-magnitude evidence.

use crate::constants::WHEEL_DELTA;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputSource {
    Wheel,
    HighResWheel,
    Touchpad,
}

/// Evidence window: recent sub-notch magnitudes. A free-spinning wheel counts
/// a flywheel through hardware detents, so it reports exactly ONE magnitude;
/// any variation means the value follows a finger (touchpad). Once a gesture
/// has varied it stays touchpad until a whole notch starts a new gesture —
/// the safe direction (over-missing smoothing never breaks scrolling).
const MAG_WINDOW: usize = 8;
const MIN_SAMPLES: usize = 3;

pub struct InputClassifier {
    mags: [i32; MAG_WINDOW],
    n: usize,
    varied: bool,
    last: InputSource,
}

impl Default for InputClassifier {
    fn default() -> Self {
        Self::new()
    }
}

impl InputClassifier {
    pub fn new() -> Self {
        Self { mags: [0; MAG_WINDOW], n: 0, varied: false, last: InputSource::Wheel }
    }

    /// `touch_injected` is the OS touch/pen marker (MI_WP_SIGNATURE) computed
    /// by the Windows hook; it wins outright for that message.
    pub fn classify(&mut self, delta: i32, touch_injected: bool) -> InputSource {
        if delta == 0 {
            return self.last;
        }
        if touch_injected {
            self.last = InputSource::Touchpad;
            return self.last;
        }
        let mag = delta.abs();
        if mag % WHEEL_DELTA == 0 {
            self.n = 0;
            self.varied = false;
            self.last = InputSource::Wheel;
            return self.last;
        }

        self.mags.copy_within(1.., 0);
        self.mags[MAG_WINDOW - 1] = mag;
        if self.n < MAG_WINDOW {
            self.n += 1;
        }
        if self.n >= MIN_SAMPLES && self.distinct_magnitudes() >= 2 {
            self.varied = true;
        }

        self.last = if self.n < MIN_SAMPLES {
            self.last // not enough evidence yet — keep the previous verdict
        } else if self.varied {
            InputSource::Touchpad
        } else {
            // One fixed magnitude = flywheel through detents = free-spinning
            // wheel; smooth it like any high-resolution wheel.
            InputSource::HighResWheel
        };
        self.last
    }

    fn distinct_magnitudes(&self) -> usize {
        let start = MAG_WINDOW - self.n;
        let mut levels = 0;
        for i in start..MAG_WINDOW {
            let mut seen = false;
            for j in start..i {
                if self.mags[j] == self.mags[i] {
                    seen = true;
                    break;
                }
            }
            if !seen {
                levels += 1;
            }
        }
        levels
    }
}
