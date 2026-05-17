//! Tauri IPC commands callable from JS.

use crate::state::AppState;
use smoothscroll_core::app_categories::{
    classify_app, preset_for_category, AppCategory, SuggestedPreset,
};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{self, is_valid_accelerator, AppSettings, ScrollProfile};
use smoothscroll_platform::traits::ProcessInfo;
use smoothscroll_platform::types::Accelerator;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

/// Emit the canonical `enabled-changed` event so any open windows pick up
/// the change. Safe to call when no windows exist.
pub(crate) fn emit_enabled_changed<R: tauri::Runtime>(app: &AppHandle<R>, enabled: bool) {
    let _ = app.emit("enabled-changed", enabled);
}

/// Emit `settings-changed` with the full settings snapshot so all windows
/// can reload their state (used by TrayPanel to sync start_minimized, etc.).
pub(crate) fn emit_settings_changed<R: tauri::Runtime>(app: &AppHandle<R>, settings: &AppSettings) {
    let _ = app.emit("settings-changed", settings.clone());
}

pub(crate) fn refresh_keyboard_hook(state: &Arc<AppState>) -> Result<(), String> {
    let enabled = state.settings.read().keyboard_scroll_enabled;
    if enabled {
        if state.keyboard_handle.lock().is_some() {
            return Ok(());
        }
        let sink = crate::keyboard_sink::KeyboardEngineSink::new(state.clone());
        let handle = state.keyboard_hook.install(sink).map_err(|e| e.to_string())?;
        *state.keyboard_handle.lock() = Some(handle);
    } else {
        *state.keyboard_handle.lock() = None;
    }
    Ok(())
}

/// Re-register the global hotkey using the current settings. Returns the
/// platform error string on failure. Safe to call repeatedly: any previous
/// handle is dropped first so the OS slot is freed before re-registering.
pub(crate) fn register_hotkey_internal(
    state: &Arc<AppState>,
    accel: &str,
) -> Result<(), String> {
    if !is_valid_accelerator(accel) {
        return Err(format!("invalid accelerator '{accel}'"));
    }
    // Drop any existing handle first to release the OS slot.
    *state.hotkey_handle.lock() = None;

    let toggle_state = state.clone();
    let on_pressed: Box<dyn Fn() + Send + Sync> = Box::new(move || {
        let new_enabled = !toggle_state.enabled.load(Ordering::Relaxed);
        toggle_state.enabled.store(new_enabled, Ordering::Relaxed);
        toggle_state.engine_signal.signal();
        tracing::info!(enabled = new_enabled, "hotkey toggled");
    });
    state
        .hotkey
        .register(
            Accelerator {
                raw: accel.to_string(),
            },
            on_pressed,
        )
        .map(|h| {
            *state.hotkey_handle.lock() = Some(h);
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
pub fn get_enabled(state: State<'_, Arc<AppState>>) -> bool {
    state.enabled.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_enabled<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    enabled: bool,
) {
    state.enabled.store(enabled, Ordering::Relaxed);
    if enabled {
        state.engine_signal.signal();
    } else {
        let mut e = state.engine.lock();
        let s = e.settings().clone();
        *e = SmoothScrollEngine::new(s);
    }
    emit_enabled_changed(&app, enabled);
    let current = state.settings.read().clone();
    emit_settings_changed(&app, &current);
    tracing::info!(enabled, "set_enabled");
}

#[tauri::command]
pub fn get_settings(state: State<'_, Arc<AppState>>) -> AppSettings {
    state.settings.read().clone()
}

#[tauri::command]
pub fn save_settings<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut clamped = settings;
    clamped.clamp();

    settings::save(&clamped).map_err(|e| e.to_string())?;

    {
        let mut s = state.settings.write();
        *s = clamped.clone();
    }
    state.engine.lock().apply_settings(clamped.clone());
    state.enabled.store(clamped.enabled, Ordering::Relaxed);
    state.engine_signal.signal();

    emit_enabled_changed(&app, clamped.enabled);
    emit_settings_changed(&app, &clamped);

    let state_arc: Arc<AppState> = (*state).clone();
    let _ = refresh_keyboard_hook(&state_arc);

    tracing::debug!("settings saved");
    Ok(())
}

/// Toggle the global hotkey on/off without restarting. Persists to settings.
#[tauri::command]
pub fn set_hotkey_enabled(
    state: State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.enable_global_hotkey = enabled;
    }
    let snapshot = state.settings.read().clone();
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    if enabled {
        let accel = snapshot.hotkey_accelerator.clone();
        let state_arc: Arc<AppState> = (*state).clone();
        register_hotkey_internal(&state_arc, &accel)?;
    } else {
        *state.hotkey_handle.lock() = None;
    }
    Ok(())
}

/// Replace the current global hotkey with a new accelerator. Validates,
/// re-registers, then persists.
#[tauri::command]
pub fn set_hotkey_accelerator(
    state: State<'_, Arc<AppState>>,
    accelerator: String,
) -> Result<(), String> {
    if !is_valid_accelerator(&accelerator) {
        return Err(format!("invalid accelerator '{accelerator}'"));
    }
    {
        let mut s = state.settings.write();
        s.hotkey_accelerator = accelerator.clone();
    }
    let snapshot = state.settings.read().clone();
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    if snapshot.enable_global_hotkey {
        let state_arc: Arc<AppState> = (*state).clone();
        register_hotkey_internal(&state_arc, &accelerator)?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_running_processes(state: State<'_, Arc<AppState>>) -> Vec<ProcessInfo> {
    state.processes.list_visible_processes()
}

#[tauri::command]
pub fn add_excluded_app(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("name cannot be empty".to_string());
    }
    {
        let mut s = state.settings.write();
        if !s
            .excluded_apps
            .iter()
            .any(|a| a.eq_ignore_ascii_case(&trimmed))
        {
            s.excluded_apps.push(trimmed);
        }
    }
    let snapshot = state.settings.read().clone();
    smoothscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_excluded_app(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.excluded_apps.retain(|a| !a.eq_ignore_ascii_case(&name));
    }
    let snapshot = state.settings.read().clone();
    smoothscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_autostart(state: State<'_, Arc<AppState>>) -> bool {
    state.autostart.is_enabled()
}

#[tauri::command]
pub fn set_autostart<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    state.autostart.set(enabled).map_err(|e| e.to_string())?;
    {
        let mut s = state.settings.write();
        s.start_with_os = enabled;
    }
    let snapshot = state.settings.read().clone();
    smoothscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    emit_settings_changed(&app, &snapshot);
    Ok(())
}

#[tauri::command]
pub fn change_language<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    lang: String,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.language = lang;
        s.clamp();
    }
    let snapshot = state.settings.read().clone();
    smoothscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    let _ = app.emit("language-changed", snapshot.language.clone());
    Ok(())
}

#[tauri::command]
pub fn accessibility_status() -> bool {
    #[cfg(target_os = "macos")]
    {
        smoothscroll_platform::macos::is_accessibility_trusted(false)
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[tauri::command]
pub fn accessibility_request_prompt() -> bool {
    #[cfg(target_os = "macos")]
    {
        smoothscroll_platform::macos::is_accessibility_trusted(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[tauri::command]
pub fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Returns true if the current machine's hostname matches one in the
/// comma-separated list compiled into the binary via the
/// `SMOOTHSCROLL_TRUSTED_HOSTS` env var at build time. When the env var is
/// unset (release builds for end users), this always returns false — forced
/// update cannot be bypassed.
#[tauri::command]
pub fn is_trusted_device() -> bool {
    const TRUSTED: Option<&str> = option_env!("SMOOTHSCROLL_TRUSTED_HOSTS");
    let Some(list) = TRUSTED else { return false };
    let Ok(host) = hostname::get() else { return false };
    let host = host.to_string_lossy().to_lowercase();
    list.split(',')
        .map(|s| s.trim().to_lowercase())
        .any(|allowed| !allowed.is_empty() && allowed == host)
}

#[tauri::command]
pub fn open_log_dir(_state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let dir = crate::log_dir();
    let _ = std::fs::create_dir_all(&dir);
    open_path(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_tray_panel<R: tauri::Runtime>(app: AppHandle<R>) {
    crate::tray::show_panel(&app);
}

#[tauri::command]
pub fn close_tray_panel<R: tauri::Runtime>(app: AppHandle<R>) {
    crate::tray::hide_panel(&app);
}

#[tauri::command]
pub fn show_main_window<R: tauri::Runtime>(app: AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
pub fn navigate_to<R: tauri::Runtime>(app: AppHandle<R>, section: String) {
    let _ = app.emit("navigate-to", section);
}

#[tauri::command]
pub fn quit_app<R: tauri::Runtime>(app: AppHandle<R>) {
    app.exit(0);
}

fn open_path(path: &std::path::Path) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(path)
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(path).spawn()?;
    }
    let _ = path;
    Ok(())
}

// ============================================================================
// Profile Management Commands
// ============================================================================

/// List all scroll profiles.
#[tauri::command]
pub fn list_profiles(state: State<'_, Arc<AppState>>) -> Vec<ScrollProfile> {
    state.settings.read().profiles.clone()
}

/// Create a new scroll profile with default settings.
#[tauri::command]
pub fn create_profile(
    state: State<'_, Arc<AppState>>,
    name: String,
) -> Result<ScrollProfile, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("profile name cannot be empty".to_string());
    }
    if trimmed.len() > 64 {
        return Err("profile name too long (max 64 characters)".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let profile = ScrollProfile::new(&id, trimmed);

    {
        let mut s = state.settings.write();
        s.profiles.push(profile.clone());
    }

    let snapshot = state.settings.read().clone();
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    Ok(profile)
}

/// Update an existing profile.
#[tauri::command]
pub fn update_profile(
    state: State<'_, Arc<AppState>>,
    profile: ScrollProfile,
) -> Result<(), String> {
    let trimmed_name = profile.name.trim();
    if trimmed_name.is_empty() {
        return Err("profile name cannot be empty".to_string());
    }
    if trimmed_name.len() > 64 {
        return Err("profile name too long (max 64 characters)".to_string());
    }
    {
        let mut s = state.settings.write();
        if let Some(existing) = s.profiles.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile.clone();
            existing.name = trimmed_name.to_string();
            existing.clamp();
        } else {
            return Err(format!("profile '{}' not found", profile.id));
        }
    }

    let snapshot = state.settings.read().clone();
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete a profile. Returns error if apps are assigned to it.
#[tauri::command]
pub fn delete_profile(
    state: State<'_, Arc<AppState>>,
    profile_id: String,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();

        // Check if any apps are assigned to this profile
        let assigned_apps: Vec<_> = s
            .app_profiles
            .iter()
            .filter(|(_, id)| **id == profile_id)
            .map(|(name, _)| name.clone())
            .collect();

        if !assigned_apps.is_empty() {
            return Err(format!(
                "Cannot delete: apps assigned to this profile: {}",
                assigned_apps.join(", ")
            ));
        }

        // Remove profile
        let before_len = s.profiles.len();
        s.profiles.retain(|p| p.id != profile_id);
        if s.profiles.len() == before_len {
            return Err(format!("profile '{profile_id}' not found"));
        }
    }

    let snapshot = state.settings.read().clone();
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    Ok(())
}

/// Assign a profile to an app. Use profile_id = None to remove assignment.
#[tauri::command]
pub fn assign_app_profile(
    state: State<'_, Arc<AppState>>,
    process_name: String,
    profile_id: Option<String>,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();

        // Validate profile exists (unless it's the special disabled ID)
        if let Some(ref id) = profile_id {
            if id != AppSettings::DISABLED_PROFILE_ID
                && !s.profiles.iter().any(|p| &p.id == id)
            {
                return Err(format!("profile '{id}' not found"));
            }
        }

        s.assign_profile(process_name, profile_id);
    }

    let snapshot = state.settings.read().clone();
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    Ok(())
}

/// Remove profile assignment from an app.
#[tauri::command]
pub fn unassign_app_profile(
    state: State<'_, Arc<AppState>>,
    process_name: String,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.app_profiles.remove(&process_name);
    }

    let snapshot = state.settings.read().clone();
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProfileSuggestion {
    pub category: AppCategory,
    pub category_label: String,
    pub preset: SuggestedPreset,
}

#[tauri::command]
pub fn suggest_profile_for_app(name: String) -> ProfileSuggestion {
    let category = classify_app(&name);
    let preset = preset_for_category(category);
    ProfileSuggestion {
        category,
        category_label: category.label().to_string(),
        preset,
    }
}

#[tauri::command]
pub fn add_known_game(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("name cannot be empty".into());
    }
    {
        let mut s = state.settings.write();
        if !s
            .game_mode_known_apps
            .iter()
            .any(|g| g.eq_ignore_ascii_case(&trimmed))
        {
            s.game_mode_known_apps.push(trimmed);
        }
    }
    let snap = state.settings.read().clone();
    settings::save(&snap).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_known_game(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.game_mode_known_apps
            .retain(|g| !g.eq_ignore_ascii_case(&name));
    }
    let snap = state.settings.read().clone();
    settings::save(&snap).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_game_mode_status(state: State<'_, Arc<AppState>>) -> bool {
    state.game_mode_active.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn get_input_source(state: State<'_, Arc<AppState>>) -> &'static str {
    match state.last_input_source.load(Ordering::Relaxed) {
        1 => "HighResWheel",
        2 => "Touchpad",
        _ => "Wheel",
    }
}
