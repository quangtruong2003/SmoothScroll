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

/// Emit `input-source-changed` so the Settings UI reflects the live source
/// without polling. Call when InputClassifier transitions between sources.
pub(crate) fn emit_input_source_changed<R: tauri::Runtime>(
    app: &AppHandle<R>,
    label: &'static str,
) {
    let _ = app.emit("input-source-changed", label);
}

pub(crate) fn refresh_hotkey(state: &Arc<AppState>) -> Result<(), String> {
    let enabled = state.settings.read().enable_global_hotkey;
    let accel = state.settings.read().hotkey_accelerator.clone();
    if enabled && is_valid_accelerator(&accel) {
        register_hotkey_internal(state, &accel)
    } else {
        *state.hotkey_handle.lock() = None;
        Ok(())
    }
}

/// Re-register the global hotkey using the current settings. Returns the
/// platform error string on failure. Safe to call repeatedly: any previous
/// handle is dropped first so the OS slot is freed before re-registering.
pub(crate) fn register_hotkey_internal(state: &Arc<AppState>, accel: &str) -> Result<(), String> {
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
        *e = SmoothScrollEngine::default();
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

    // Synchronous save — frontend's explicit Save action requires disk state.
    settings::save(&clamped).map_err(|e| e.to_string())?;

    state.commit_settings(clamped.clone());
    state.enabled.store(clamped.enabled, Ordering::Relaxed);
    state.engine_signal.signal();

    emit_enabled_changed(&app, clamped.enabled);
    emit_settings_changed(&app, &clamped);

    let state_arc: Arc<AppState> = (*state).clone();
    let _ = refresh_hotkey(&state_arc);

    tracing::debug!("settings saved");
    Ok(())
}

/// Toggle the global hotkey on/off without restarting. Persists to settings.
#[tauri::command]
pub fn set_hotkey_enabled(state: State<'_, Arc<AppState>>, enabled: bool) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.enable_global_hotkey = enabled;
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot.clone());

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
    state.commit_settings(snapshot.clone());

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
    state.commit_settings(snapshot);
    Ok(())
}

#[tauri::command]
pub fn remove_excluded_app(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.excluded_apps.retain(|a| !a.eq_ignore_ascii_case(&name));
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);
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
    // Synchronous save — mirrors save_settings pattern for durability.
    settings::save(&snapshot).map_err(|e| e.to_string())?;
    state.commit_settings(snapshot.clone());
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
    state.commit_settings(snapshot.clone());
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

#[derive(Debug, Clone, serde::Serialize)]
pub struct PlatformStatus {
    pub accessible: bool,
    pub flatpak: bool,
    pub session_type: String,
    pub error_message: Option<String>,
}

#[tauri::command]
pub fn get_platform_status() -> PlatformStatus {
    #[cfg(target_os = "linux")]
    {
        use smoothscroll_platform::linux::wayland::permission;

        let session_type = match std::env::var("XDG_SESSION_TYPE")
            .unwrap_or_default()
            .as_str()
        {
            "wayland" => "wayland",
            _ => "x11",
        };

        if permission::is_flatpak() {
            return PlatformStatus {
                accessible: false,
                flatpak: true,
                session_type: session_type.to_string(),
                error_message: Some(
                    "SmoothScroll does not support Flatpak.\n\n\
                     Flatpak sandbox blocks access to /dev/uinput which is \
                     required for scroll interception.\n\n\
                     Please install SmoothScroll from .deb or .AppImage instead."
                        .to_string(),
                ),
            };
        }

        match std::fs::OpenOptions::new().write(true).open("/dev/uinput") {
            Ok(_) => PlatformStatus {
                accessible: true,
                flatpak: false,
                session_type: session_type.to_string(),
                error_message: None,
            },
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => PlatformStatus {
                accessible: false,
                flatpak: false,
                session_type: session_type.to_string(),
                error_message: Some(
                    "SmoothScroll needs access to /dev/uinput for scroll smoothing.\n\n\
                     Run the following commands and log out:\n\n\
                       sudo gpasswd -a $USER input\n\
                       sudo bash -c 'echo \"KERNEL==\\\"uinput\\\", GROUP=\\\"input\\\", \
                     MODE=\\\"0660\\\", OPTIONS+=\\\"static_node=uinput\\\"\" > \
                     /etc/udev/rules.d/99-smoothscroll.rules'\n\
                       sudo udevadm control --reload-rules\n\n\
                     After logging back in, restart SmoothScroll."
                        .to_string(),
                ),
            },
            Err(e) => PlatformStatus {
                accessible: false,
                flatpak: false,
                session_type: session_type.to_string(),
                error_message: Some(format!("Cannot open /dev/uinput: {}", e)),
            },
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        PlatformStatus {
            accessible: true,
            flatpak: false,
            session_type: String::new(),
            error_message: None,
        }
    }
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
    let Ok(host) = hostname::get() else {
        return false;
    };
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
pub fn resize_tray_panel<R: tauri::Runtime>(app: AppHandle<R>, width: u32, height: u32) {
    crate::tray::resize_panel(&app, width, height);
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
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(path).spawn()?;
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
    state.commit_settings(snapshot);

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
    state.commit_settings(snapshot);

    Ok(())
}

/// Delete a profile. Returns error if apps are assigned to it.
#[tauri::command]
pub fn delete_profile(state: State<'_, Arc<AppState>>, profile_id: String) -> Result<(), String> {
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
    state.commit_settings(snapshot);

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
            if id != AppSettings::DISABLED_PROFILE_ID && !s.profiles.iter().any(|p| &p.id == id) {
                return Err(format!("profile '{id}' not found"));
            }
        }

        s.assign_profile(process_name, profile_id);
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);

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
    state.commit_settings(snapshot);

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
    state.commit_settings(snap);
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
    state.commit_settings(snap);
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

#[tauri::command]
pub fn get_reduce_motion_status(state: State<'_, Arc<AppState>>) -> bool {
    state.reduce_motion.load(Ordering::Relaxed)
}

/// Returns the canonical default settings from `smoothscroll_core`.
/// Single source of truth for "Reset to default" actions in the UI.
#[tauri::command]
pub fn get_default_settings() -> AppSettings {
    AppSettings::default()
}

#[tauri::command]
pub fn apply_onboarding_preset(
    state: State<'_, Arc<AppState>>,
    use_case: String,
    feel: String,
) -> Result<(), String> {
    use smoothscroll_core::onboarding::{apply_preset, Feel, UseCase};
    let uc = match use_case.as_str() {
        "Reader" => UseCase::Reader,
        "Coder" => UseCase::Coder,
        "Designer" => UseCase::Designer,
        "General" => UseCase::General,
        _ => return Err(format!("invalid use_case '{use_case}'")),
    };
    let f = match feel.as_str() {
        "Glide" => Feel::Glide,
        "Balanced" => Feel::Balanced,
        "Snappy" => Feel::Snappy,
        _ => return Err(format!("invalid feel '{feel}'")),
    };

    let mut snapshot = state.settings.read().clone();
    apply_preset(&mut snapshot, uc, f);
    snapshot.onboarding_completed_at = Some(now_unix());
    snapshot.clamp();

    settings::save(&snapshot).map_err(|e| e.to_string())?;
    state.commit_settings(snapshot);
    Ok(())
}

#[tauri::command]
pub fn skip_onboarding(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut snapshot = state.settings.read().clone();
    snapshot.onboarding_completed_at = Some(now_unix());
    settings::save(&snapshot).map_err(|e| e.to_string())?;
    state.commit_settings(snapshot);
    Ok(())
}

#[tauri::command]
pub fn reset_onboarding(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut snapshot = state.settings.read().clone();
    snapshot.onboarding_completed_at = None;
    settings::save(&snapshot).map_err(|e| e.to_string())?;
    state.commit_settings(snapshot);
    Ok(())
}

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[tauri::command]
pub fn get_daily_stats(state: State<'_, Arc<AppState>>) -> smoothscroll_core::stats::DailyStats {
    state.stats.periodic_save();
    state.stats.snapshot()
}

#[tauri::command]
pub fn list_monitors(
    state: State<'_, Arc<AppState>>,
) -> Vec<smoothscroll_platform::traits::MonitorInfo> {
    state.monitor_enum.list_monitors()
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ForegroundAppContext {
    pub process_name: Option<String>,
    pub suggested_category: Option<smoothscroll_core::app_categories::AppCategory>,
    pub suggested_category_label: Option<String>,
    pub current_profile_id: Option<String>,
    pub is_excluded: bool,
    /// Base64-encoded PNG of the foreground app's icon (no `data:` prefix).
    /// `None` when icon extraction fails or the platform does not support it
    /// (Linux, or macOS in this build); the frontend falls back to its
    /// Lucide icon in that case.
    pub app_icon_base64: Option<String>,
}

/// Looks up the foreground app's pid + exe_path via the ProcessQuery impl
/// and consults the icon cache. Returns None when the platform does not
/// implement foreground_process_info, the lookup fails, the resolved name
/// doesn't match the one we got from the snapshot (defensive against
/// stale foreground snapshots), or the cache extractor returns None
/// (Linux, macOS in this build).
fn extract_icon_for_foreground(state: &State<'_, Arc<AppState>>, name: &str) -> Option<String> {
    let info = state.processes.foreground_process_info()?;
    if !info.name.eq_ignore_ascii_case(name) {
        return None;
    }
    let cache = state.app_icon_cache.lock();
    cache.get_or_extract(info.pid, info.exe_path.as_deref().map(std::path::Path::new))
}

/// Returns context about the foreground app at the moment the tray panel was
/// shown (or a live query as fallback). Consumes the snapshot so a stale value
/// does not leak between tray opens.
#[tauri::command]
pub fn get_foreground_app_context(state: State<'_, Arc<AppState>>) -> ForegroundAppContext {
    let process_name = {
        let mut guard = state.last_foreground_at_tray_open.lock();
        guard.take()
    }
    .or_else(|| state.processes.foreground_process_name());

    let Some(name) = process_name else {
        return ForegroundAppContext {
            process_name: None,
            suggested_category: None,
            suggested_category_label: None,
            current_profile_id: None,
            is_excluded: false,
            app_icon_base64: None,
        };
    };

    let category = classify_app(&name);
    let s = state.settings.read();
    let is_excluded = s.is_excluded(&name);
    let current_profile_id = s.app_profiles.get(&name).cloned();
    let app_icon_base64 = extract_icon_for_foreground(&state, &name);

    ForegroundAppContext {
        process_name: Some(name),
        suggested_category: Some(category),
        suggested_category_label: Some(category.label().to_string()),
        current_profile_id,
        is_excluded,
        app_icon_base64,
    }
}
