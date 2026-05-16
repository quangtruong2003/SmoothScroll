//! Application settings. Mirror C# `AppSettings.cs` subset for v1.

use crate::easing::EasingMode;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// User-selectable theme mode for the settings UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ThemeMode {
    Light,
    Dark,
    #[default]
    System,
}

/// Persisted user settings.
///
/// Field defaults are produced via `Default::default()` and apply when
/// the JSON file is missing keys (forward-compatible with future fields).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub enabled: bool,

    // Scroll
    pub step_size_px: i32,
    pub animation_time_ms: i32,
    pub acceleration_delta_ms: i32,
    pub acceleration_max: i32,
    pub tail_to_head_ratio: i32,
    pub animation_easing: bool,
    pub easing_mode: EasingMode,

    // Direction & horizontal
    pub shift_key_horizontal: bool,
    pub horizontal_smoothness: bool,
    pub reverse_wheel_direction: bool,

    // Startup & UI
    pub start_with_os: bool,
    pub start_minimized: bool,
    pub language: String,
    pub theme: ThemeMode,

    // Quick toggle
    pub enable_global_hotkey: bool,
    pub hotkey_accelerator: String,
    pub show_tray_icon_state: bool,

    // App management
    pub excluded_apps: Vec<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            step_size_px: 120,
            animation_time_ms: 360,
            acceleration_delta_ms: 70,
            acceleration_max: 7,
            tail_to_head_ratio: 3,
            animation_easing: true,
            easing_mode: EasingMode::ExponentialOut,
            shift_key_horizontal: true,
            horizontal_smoothness: true,
            reverse_wheel_direction: false,
            start_with_os: false,
            start_minimized: true,
            language: "en".to_string(),
            theme: ThemeMode::System,
            enable_global_hotkey: true,
            hotkey_accelerator: "Ctrl+Alt+S".to_string(),
            show_tray_icon_state: true,
            excluded_apps: Vec::new(),
        }
    }
}

impl AppSettings {
    pub fn clamp(&mut self) {
        self.step_size_px = self.step_size_px.clamp(10, 500);
        self.animation_time_ms = self.animation_time_ms.clamp(10, 2000);
        self.acceleration_delta_ms = self.acceleration_delta_ms.clamp(0, 500);
        self.acceleration_max = self.acceleration_max.clamp(1, 20);
        self.tail_to_head_ratio = self.tail_to_head_ratio.clamp(1, 20);

        const KNOWN_LANGS: [&str; 3] = ["en", "vi", "zh"];
        if !KNOWN_LANGS.contains(&self.language.as_str()) {
            self.language = "en".to_string();
        }

        if !is_valid_accelerator(&self.hotkey_accelerator) {
            self.hotkey_accelerator = "Ctrl+Alt+S".to_string();
        }
    }

    /// Case-insensitive exact-match check against the excluded list.
    pub fn is_excluded(&self, process_name: &str) -> bool {
        if process_name.is_empty() {
            return false;
        }
        self.excluded_apps
            .iter()
            .any(|app| app.eq_ignore_ascii_case(process_name))
    }
}

/// Validates an accelerator string of the form `Mod[+Mod...]+Key`.
///
/// Rules:
/// - At least one modifier (Ctrl, Alt, Shift, Win) is required.
/// - Exactly one non-modifier key is required.
/// - Whitespace is trimmed; comparison is case-insensitive.
/// - Recognised non-modifier keys: A-Z, 0-9, F1-F24.
pub fn is_valid_accelerator(s: &str) -> bool {
    let mut has_modifier = false;
    let mut key_count = 0;
    for raw in s.split('+') {
        let part = raw.trim();
        if part.is_empty() {
            return false;
        }
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" | "alt" | "option" | "shift" | "win" | "cmd" | "command"
            | "super" | "meta" | "commandorcontrol" => {
                has_modifier = true;
            }
            other => {
                if !is_valid_key_token(other) {
                    return false;
                }
                key_count += 1;
            }
        }
    }
    has_modifier && key_count == 1
}

fn is_valid_key_token(token: &str) -> bool {
    if token.len() == 1 {
        let c = token.chars().next().unwrap();
        return c.is_ascii_alphanumeric();
    }
    // F1..F24
    if let Some(rest) = token.strip_prefix('f') {
        if let Ok(n) = rest.parse::<u32>() {
            return (1..=24).contains(&n);
        }
    }
    false
}

/// Errors loading/saving settings to disk.
#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("config directory unavailable")]
    NoConfigDir,
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

/// Resolve the v1 settings file path.
pub fn settings_path() -> Result<PathBuf, SettingsError> {
    let dirs = directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")
        .ok_or(SettingsError::NoConfigDir)?;
    let dir = dirs.config_dir();
    std::fs::create_dir_all(dir)?;
    Ok(dir.join("settings.json"))
}

/// Load settings from disk, returning defaults if the file is missing or corrupt.
pub fn load() -> AppSettings {
    match try_load() {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(error = %e, "failed to load settings, using defaults");
            AppSettings::default()
        }
    }
}

fn try_load() -> Result<AppSettings, SettingsError> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let bytes = std::fs::read(&path)?;
    let mut settings: AppSettings = serde_json::from_slice(&bytes)?;
    settings.clamp();
    Ok(settings)
}

/// Save settings atomically (write to temp, then rename).
pub fn save(settings: &AppSettings) -> Result<(), SettingsError> {
    let path = settings_path()?;
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(settings)?;
    std::fs::write(&tmp, &json)?;
    std::fs::rename(&tmp, &path)?;
    Ok(())
}
