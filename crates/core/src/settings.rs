//! Application settings.

use crate::easing::EasingMode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// User-selectable theme mode for the settings UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ThemeMode {
    Light,
    Dark,
    #[default]
    System,
}

fn default_games_list() -> Vec<String> {
    [
        "LeagueOfLegends.exe", "VALORANT.exe", "csgo.exe", "cs2.exe",
        "dota2.exe", "ApexLegends.exe", "RainbowSix.exe",
        "FortniteClient-Win64-Shipping.exe", "PUBG.exe",
        "GTA5.exe", "RDR2.exe", "eldenring.exe", "Cyberpunk2077.exe",
        "witcher3.exe", "MinecraftLauncher.exe", "javaw.exe",
        "RocketLeague.exe", "Overwatch.exe", "Overwatch2.exe",
        "WoW.exe", "ffxiv_dx11.exe", "warframe.exe",
        "factorio.exe", "Terraria.exe", "StardewValley.exe",
        "ETS2.exe", "ats.exe", "dishonored2.exe",
    ].iter().map(|s| s.to_string()).collect()
}

/// A named scroll profile with customizable settings.
/// Can be assigned to specific applications for per-app scrolling behavior.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScrollProfile {
    pub id: String,
    pub name: String,
    pub step_size_px: i32,
    pub animation_time_ms: i32,
    pub acceleration_delta_ms: i32,
    pub acceleration_max: i32,
    pub tail_to_head_ratio: i32,
    pub animation_easing: bool,
    pub easing_mode: EasingMode,
    pub reverse_wheel_direction: bool,
    pub horizontal_smoothness: bool,
}

impl ScrollProfile {
    /// Create a new profile with the given ID and name, using default scroll settings.
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            step_size_px: 120,
            animation_time_ms: 360,
            acceleration_delta_ms: 70,
            acceleration_max: 7,
            tail_to_head_ratio: 3,
            animation_easing: true,
            easing_mode: EasingMode::ExponentialOut,
            reverse_wheel_direction: false,
            horizontal_smoothness: true,
        }
    }

    /// Clamp all numeric fields to valid ranges.
    pub fn clamp(&mut self) {
        self.step_size_px = self.step_size_px.clamp(10, 500);
        self.animation_time_ms = self.animation_time_ms.clamp(10, 2000);
        self.acceleration_delta_ms = self.acceleration_delta_ms.clamp(0, 500);
        self.acceleration_max = self.acceleration_max.clamp(1, 20);
        self.tail_to_head_ratio = self.tail_to_head_ratio.clamp(1, 20);
    }
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

    // Per-app profiles
    pub profiles: Vec<ScrollProfile>,
    pub app_profiles: HashMap<String, String>,  // process_name -> profile_id

    // Game mode
    pub game_mode_enabled: bool,
    pub game_mode_known_apps: Vec<String>,
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
            profiles: Vec::new(),
            app_profiles: HashMap::new(),
            game_mode_enabled: true,
            game_mode_known_apps: default_games_list(),
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

        // Clamp all profiles
        for profile in &mut self.profiles {
            profile.clamp();
        }

        const KNOWN_LANGS: [&str; 3] = ["en", "vi", "zh"];
        if !KNOWN_LANGS.contains(&self.language.as_str()) {
            self.language = "en".to_string();
        }

        if !is_valid_accelerator(&self.hotkey_accelerator) {
            self.hotkey_accelerator = "Ctrl+Alt+S".to_string();
        }
    }

    /// Migrate from v1 (excluded_apps) to v2 (app_profiles).
    /// Should be called after loading settings.
    pub fn migrate_from_v1(&mut self) {
        if !self.excluded_apps.is_empty() && self.app_profiles.is_empty() {
            for app in self.excluded_apps.drain(..) {
                self.app_profiles.insert(app, Self::DISABLED_PROFILE_ID.to_string());
            }
        }
    }

    /// Special profile ID for disabled (pass-through) apps.
    pub const DISABLED_PROFILE_ID: &'static str = "__disabled__";

    /// Case-insensitive exact-match check against the excluded list.
    /// Also checks app_profiles for "__disabled__" assignment.
    pub fn is_excluded(&self, process_name: &str) -> bool {
        if process_name.is_empty() {
            return false;
        }
        // Check new system first
        if let Some(profile_id) = self.app_profiles.get(process_name) {
            if profile_id == Self::DISABLED_PROFILE_ID {
                return true;
            }
        }
        // Fall back to legacy excluded_apps
        self.excluded_apps
            .iter()
            .any(|app| app.eq_ignore_ascii_case(process_name))
    }

    /// Returns the profile assigned to a process, if any.
    /// Returns None if the process should use default settings.
    pub fn get_profile_for_process(&self, process_name: &str) -> Option<&ScrollProfile> {
        if process_name.is_empty() {
            return None;
        }
        let profile_id = self.app_profiles.get(process_name)?;
        if profile_id == Self::DISABLED_PROFILE_ID {
            return None; // Pass-through
        }
        self.profiles.iter().find(|p| &p.id == profile_id)
    }

    /// Assign a profile to an app. Use None to remove assignment.
    pub fn assign_profile(&mut self, process_name: String, profile_id: Option<String>) {
        match profile_id {
            Some(id) => {
                self.app_profiles.insert(process_name, id);
            }
            None => {
                self.app_profiles.remove(&process_name);
            }
        }
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
    settings.migrate_from_v1();
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
