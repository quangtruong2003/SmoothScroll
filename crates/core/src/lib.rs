//! Pure scroll engine logic for SmoothScroll.
//!
//! This crate is intentionally OS-agnostic: it has no Win32, no macOS,
//! no Tauri dependencies. All effects (timers, SendInput, file I/O for
//! settings) live above this layer.

pub mod app_categories;
pub mod constants;
pub mod easing;
pub mod edge_scroll;
pub mod engine;
pub mod keyboard_scroll;
pub mod settings;

pub use easing::{compute_easing_fraction, EasingMode};
pub use engine::{EngineOutput, SmoothScrollEngine};
pub use settings::{is_valid_accelerator, AppSettings, ThemeMode};
