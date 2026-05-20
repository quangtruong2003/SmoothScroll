//! Application settings.

use crate::easing::EasingMode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[cfg(not(target_arch = "wasm32"))]
use std::path::PathBuf;

/// User-selectable theme mode for the settings UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum ThemeMode {
    Light,
    Dark,
    #[default]
    System,
}

/// User control over the OS "Reduce Motion" signal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum RespectReduceMotion {
    /// Follow the OS signal (default).
    #[default]
    Auto,
    /// Always run engine in instant mode regardless of OS.
    Always,
    /// Always smooth, ignore OS.
    Never,
}

fn default_games_list() -> Vec<String> {
    [
        "LeagueOfLegends.exe",
        "VALORANT.exe",
        "csgo.exe",
        "cs2.exe",
        "dota2.exe",
        "ApexLegends.exe",
        "RainbowSix.exe",
        "FortniteClient-Win64-Shipping.exe",
        "PUBG.exe",
        "GTA5.exe",
        "RDR2.exe",
        "eldenring.exe",
        "Cyberpunk2077.exe",
        "witcher3.exe",
        "MinecraftLauncher.exe",
        "javaw.exe",
        "RocketLeague.exe",
        "Overwatch.exe",
        "Overwatch2.exe",
        "WoW.exe",
        "ffxiv_dx11.exe",
        "warframe.exe",
        "factorio.exe",
        "Terraria.exe",
        "StardewValley.exe",
        "ETS2.exe",
        "ats.exe",
        "dishonored2.exe",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
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
            step_size_px: 144,
            animation_time_ms: 220,
            acceleration_delta_ms: 70,
            acceleration_max: 10,
            tail_to_head_ratio: 5,
            animation_easing: true,
            easing_mode: EasingMode::QuinticOut,
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

/// Whether to pass wheel events through raw (no smoothing) when a precision
/// modifier is held. Defaults are ON because Ctrl/Alt+Wheel almost always
/// drives precision actions like zoom or font-size in modern apps.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ModifierPassthrough {
    #[serde(default = "default_true")]
    pub ctrl: bool,
    #[serde(default = "default_true")]
    pub alt: bool,
    #[serde(default = "default_true")]
    pub clear_inertia_on_press: bool,
}

fn default_true() -> bool {
    true
}

impl Default for ModifierPassthrough {
    fn default() -> Self {
        Self {
            ctrl: true,
            alt: true,
            clear_inertia_on_press: true,
        }
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
    pub shift_horizontal_invert: bool,
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
    pub app_profiles: HashMap<String, String>, // process_name -> profile_id

    // Game mode
    pub game_mode_enabled: bool,
    pub game_mode_known_apps: Vec<String>,

    // Edge auto-scroll
    pub edge_scroll_enabled: bool,
    pub edge_scroll_zone_px: i32,
    pub edge_scroll_max_notches_per_sec: f64,
    pub edge_scroll_modifier_required: bool,
    pub edge_scroll_modifier: String,

    // Keyboard scroll smoothing
    pub keyboard_scroll_enabled: bool,
    pub keyboard_scroll_keys: Vec<String>,
    pub keyboard_smart_text_skip: bool,
    pub keyboard_pgdn_step_notches: i32,
    pub keyboard_arrow_step_notches: i32,

    // Precision Touchpad
    pub touchpad_smoothing_enabled: bool,
    pub touchpad_pixel_multiplier: f64,
    pub touchpad_acceleration_factor: f64,

    // Accessibility
    pub respect_reduce_motion: RespectReduceMotion,

    // Precision actions (modifier passthrough)
    pub modifier_passthrough: ModifierPassthrough,

    // Onboarding
    pub onboarding_completed_at: Option<u64>,

    // Auto-disable seed (Windows native-smooth apps). True after first seed.
    #[serde(default)]
    pub auto_excluded_seeded: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            step_size_px: 144,
            animation_time_ms: 220,
            acceleration_delta_ms: 70,
            acceleration_max: 10,
            tail_to_head_ratio: 5,
            animation_easing: true,
            easing_mode: EasingMode::QuinticOut,
            shift_key_horizontal: true,
            shift_horizontal_invert: true,
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
            edge_scroll_enabled: false,
            edge_scroll_zone_px: 40,
            edge_scroll_max_notches_per_sec: 5.0,
            edge_scroll_modifier_required: false,
            edge_scroll_modifier: "Alt".to_string(),
            keyboard_scroll_enabled: false,
            keyboard_scroll_keys: vec![
                "PageUp".to_string(),
                "PageDown".to_string(),
                "Space".to_string(),
                "ShiftSpace".to_string(),
                "ArrowUp".to_string(),
                "ArrowDown".to_string(),
            ],
            keyboard_smart_text_skip: true,
            keyboard_pgdn_step_notches: 5,
            keyboard_arrow_step_notches: 1,
            touchpad_smoothing_enabled: true,
            touchpad_pixel_multiplier: 1.0,
            touchpad_acceleration_factor: 1.0,
            respect_reduce_motion: RespectReduceMotion::default(),
            modifier_passthrough: ModifierPassthrough::default(),
            onboarding_completed_at: None,
            auto_excluded_seeded: false,
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

        self.keyboard_pgdn_step_notches = self.keyboard_pgdn_step_notches.clamp(1, 20);
        self.keyboard_arrow_step_notches = self.keyboard_arrow_step_notches.clamp(1, 10);

        self.touchpad_pixel_multiplier = self.touchpad_pixel_multiplier.clamp(0.1, 5.0);
        self.touchpad_acceleration_factor = self.touchpad_acceleration_factor.clamp(0.0, 3.0);

        // Clamp all profiles
        for profile in &mut self.profiles {
            profile.clamp();
        }

        const KNOWN_LANGS: [&str; 14] = [
            "en", "vi", "zh", "fr", "de", "hi", "id", "it", "ja", "ko", "pt-BR", "es", "tr", "ru",
        ];
        if !KNOWN_LANGS.contains(&self.language.as_str()) {
            self.language = "en".to_string();
        }

        if !is_valid_accelerator(&self.hotkey_accelerator) {
            self.hotkey_accelerator = "Ctrl+Alt+S".to_string();
        }

        self.edge_scroll_zone_px = self.edge_scroll_zone_px.clamp(10, 200);
        self.edge_scroll_max_notches_per_sec =
            self.edge_scroll_max_notches_per_sec.clamp(0.5, 20.0);
        if !["Alt", "Shift", "Ctrl"].contains(&self.edge_scroll_modifier.as_str()) {
            self.edge_scroll_modifier = "Alt".to_string();
        }
    }

    /// Migrate from v1 (excluded_apps) to v2 (app_profiles).
    /// Should be called after loading settings.
    pub fn migrate_from_v1(&mut self) {
        if !self.excluded_apps.is_empty() && self.app_profiles.is_empty() {
            for app in self.excluded_apps.drain(..) {
                self.app_profiles
                    .insert(app, Self::DISABLED_PROFILE_ID.to_string());
            }
        }
    }

    /// Special profile ID for disabled (pass-through) apps.
    pub const DISABLED_PROFILE_ID: &'static str = "__disabled__";

    /// Windows apps known to ship native smooth-scroll animation that conflicts
    /// with this engine (UWP, WinUI, modern Edge). Seeded once into
    /// `app_profiles` as pass-through so users get a delay-free experience by
    /// default. After the first seed, the user is in control.
    pub const NATIVE_SMOOTH_SEED: &'static [&'static str] = &[
        "Notepad.exe",
        "SystemSettings.exe",
        "ApplicationFrameHost.exe",
        "CalculatorApp.exe",
        "Photos.exe",
        "WinStore.App.exe",
        "msedge.exe",
    ];

    /// Idempotently seed the native-smooth-app exclusion list. Runs once;
    /// subsequent loads are no-ops so user removals stick.
    pub fn seed_native_smooth_excludes(&mut self) {
        if self.auto_excluded_seeded {
            return;
        }
        for app in Self::NATIVE_SMOOTH_SEED {
            self.app_profiles
                .entry((*app).to_string())
                .or_insert_with(|| Self::DISABLED_PROFILE_ID.to_string());
        }
        self.auto_excluded_seeded = true;
    }

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

/// Hot-path subset of AppSettings — only fields the engine needs per event.
/// No Vec, no HashMap. Cheap to clone, cheap to swap.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EffectiveSettings {
    pub step_size_px: i32,
    pub animation_time_ms: i32,
    pub acceleration_delta_ms: i32,
    pub acceleration_max: i32,
    pub tail_to_head_ratio: i32,
    pub animation_easing: bool,
    pub easing_mode: EasingMode,
    pub reverse_wheel_direction: bool,
    pub horizontal_smoothness: bool,
    pub shift_key_horizontal: bool,
    pub shift_horizontal_invert: bool,
    pub touchpad_smoothing_enabled: bool,
    pub touchpad_pixel_multiplier: f64,
    pub touchpad_acceleration_factor: f64,
    pub instant_mode: bool,
    pub modifier_ctrl_passthrough: bool,
    pub modifier_alt_passthrough: bool,
    pub modifier_clear_inertia: bool,
}

impl EffectiveSettings {
    /// Build from the global (default) settings.
    pub fn from_settings(s: &AppSettings) -> Self {
        Self {
            step_size_px: s.step_size_px,
            animation_time_ms: s.animation_time_ms,
            acceleration_delta_ms: s.acceleration_delta_ms,
            acceleration_max: s.acceleration_max,
            tail_to_head_ratio: s.tail_to_head_ratio,
            animation_easing: s.animation_easing,
            easing_mode: s.easing_mode,
            reverse_wheel_direction: s.reverse_wheel_direction,
            horizontal_smoothness: s.horizontal_smoothness,
            shift_key_horizontal: s.shift_key_horizontal,
            shift_horizontal_invert: s.shift_horizontal_invert,
            touchpad_smoothing_enabled: s.touchpad_smoothing_enabled,
            touchpad_pixel_multiplier: s.touchpad_pixel_multiplier,
            touchpad_acceleration_factor: s.touchpad_acceleration_factor,
            instant_mode: false,
            modifier_ctrl_passthrough: s.modifier_passthrough.ctrl,
            modifier_alt_passthrough: s.modifier_passthrough.alt,
            modifier_clear_inertia: s.modifier_passthrough.clear_inertia_on_press,
        }
    }

    /// Build from a base settings + profile, merging profile overrides.
    pub fn with_profile(base: &AppSettings, profile: &ScrollProfile) -> Self {
        Self {
            step_size_px: profile.step_size_px,
            animation_time_ms: profile.animation_time_ms,
            acceleration_delta_ms: profile.acceleration_delta_ms,
            acceleration_max: profile.acceleration_max,
            tail_to_head_ratio: profile.tail_to_head_ratio,
            animation_easing: profile.animation_easing,
            easing_mode: profile.easing_mode,
            reverse_wheel_direction: profile.reverse_wheel_direction,
            horizontal_smoothness: profile.horizontal_smoothness,
            shift_key_horizontal: base.shift_key_horizontal,
            shift_horizontal_invert: base.shift_horizontal_invert,
            touchpad_smoothing_enabled: base.touchpad_smoothing_enabled,
            touchpad_pixel_multiplier: base.touchpad_pixel_multiplier,
            touchpad_acceleration_factor: base.touchpad_acceleration_factor,
            instant_mode: false,
            modifier_ctrl_passthrough: base.modifier_passthrough.ctrl,
            modifier_alt_passthrough: base.modifier_passthrough.alt,
            modifier_clear_inertia: base.modifier_passthrough.clear_inertia_on_press,
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
#[cfg(not(target_arch = "wasm32"))]
pub fn settings_path() -> Result<PathBuf, SettingsError> {
    let dirs = directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")
        .ok_or(SettingsError::NoConfigDir)?;
    let dir = dirs.config_dir();
    std::fs::create_dir_all(dir)?;
    Ok(dir.join("settings.json"))
}

/// Load settings from disk, returning defaults if the file is missing or corrupt.
#[cfg(not(target_arch = "wasm32"))]
pub fn load() -> AppSettings {
    match try_load() {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(error = %e, "failed to load settings, using defaults");
            AppSettings::default()
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn try_load() -> Result<AppSettings, SettingsError> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let bytes = std::fs::read(&path)?;
    let mut settings: AppSettings = serde_json::from_slice(&bytes)?;
    settings.clamp();
    settings.migrate_from_v1();
    settings.seed_native_smooth_excludes();
    Ok(settings)
}

/// Save settings atomically (write to temp, then rename).
#[cfg(not(target_arch = "wasm32"))]
pub fn save(settings: &AppSettings) -> Result<(), SettingsError> {
    let path = settings_path()?;
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_vec_pretty(settings)?;
    std::fs::write(&tmp, &json)?;
    std::fs::rename(&tmp, &path)?;
    Ok(())
}
