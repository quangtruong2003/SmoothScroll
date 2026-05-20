//! Onboarding preset matrix. Pure: takes settings, mutates fields. The
//! caller is responsible for stamping `onboarding_completed_at` and
//! persisting the result.

use crate::easing::EasingMode;
use crate::settings::{AppSettings, ModifierPassthrough};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UseCase {
    Reader,
    Coder,
    Designer,
    General,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Feel {
    Glide,
    Balanced,
    Snappy,
}

pub fn apply_preset(s: &mut AppSettings, use_case: UseCase, feel: Feel) {
    match (use_case, feel) {
        (UseCase::Reader, Feel::Glide) => mac_like(s),
        (UseCase::Reader, Feel::Balanced) => {
            default_baseline(s);
            s.step_size_px = 100;
        }
        (UseCase::Reader, Feel::Snappy) => fast(s),

        (UseCase::Coder, Feel::Glide) => {
            default_baseline(s);
            s.animation_time_ms = 300;
            enable_mp(s);
        }
        (UseCase::Coder, Feel::Balanced) => {
            default_baseline(s);
            enable_mp(s);
        }
        (UseCase::Coder, Feel::Snappy) => {
            snappy(s);
            enable_mp(s);
        }

        (UseCase::Designer, Feel::Glide) => {
            mac_like(s);
            s.step_size_px = 80;
            enable_mp(s);
        }
        (UseCase::Designer, Feel::Balanced) => {
            default_baseline(s);
            enable_mp(s);
        }
        (UseCase::Designer, Feel::Snappy) => {
            fast(s);
            enable_mp(s);
        }

        (UseCase::General, Feel::Glide) => mac_like(s),
        (UseCase::General, Feel::Balanced) => default_baseline(s),
        (UseCase::General, Feel::Snappy) => snappy(s),
    }
}

fn default_baseline(s: &mut AppSettings) {
    s.step_size_px = 144;
    s.animation_time_ms = 220;
    s.acceleration_delta_ms = 70;
    s.acceleration_max = 10;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn mac_like(s: &mut AppSettings) {
    s.step_size_px = 100;
    s.animation_time_ms = 500;
    s.acceleration_delta_ms = 80;
    s.acceleration_max = 6;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn fast(s: &mut AppSettings) {
    s.step_size_px = 160;
    s.animation_time_ms = 220;
    s.acceleration_delta_ms = 50;
    s.acceleration_max = 10;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn snappy(s: &mut AppSettings) {
    s.step_size_px = 200;
    s.animation_time_ms = 200;
    s.acceleration_delta_ms = 30;
    s.acceleration_max = 14;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn enable_mp(s: &mut AppSettings) {
    s.modifier_passthrough = ModifierPassthrough {
        ctrl: true,
        alt: true,
        clear_inertia_on_press: true,
    };
}
