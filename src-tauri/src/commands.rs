//! Tauri IPC commands callable from JS.

use crate::state::AppState;
use smoothscroll_core::app_categories::{
    classify_app, preset_for_category, AppCategory, SuggestedPreset,
};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{self, is_valid_accelerator, AppSettings, ScrollProfile};
use smoothscroll_platform::installed_apps::InstalledApp;
use smoothscroll_platform::traits::ProcessInfo;
use smoothscroll_platform::types::Accelerator;
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::sync::LazyLock;
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
        // Route through the unified toggle so the tray icon and every open
        // window observe the hotkey like any other surface. When no notifier
        // is installed (before setup, or in tests), fall back to the bare
        // runtime toggle.
        if let Some(notify) = toggle_state.enabled_notifier.get() {
            notify(new_enabled);
        } else {
            toggle_state.enabled.store(new_enabled, Ordering::Relaxed);
            toggle_state.engine_signal.signal();
        }
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

/// Single mutation point for the enabled flag, shared by every toggle
/// surface (settings UI, tray icon, tray panel, global hotkey). Mirrors the
/// new value into `settings.enabled` and commits it so the persisted snapshot
/// (and any later debounced save) carries the same state — previously only the
/// atomic was updated, so a stale `settings-changed` snapshot could silently
/// re-enable smoothing on the next save.
pub(crate) fn set_enabled_state(state: &Arc<AppState>, enabled: bool) -> AppSettings {
    let mut snapshot = state.settings.read().clone();
    snapshot.enabled = enabled;
    state.enabled.store(enabled, Ordering::Relaxed);
    if enabled {
        state.engine_signal.signal();
    } else {
        let mut e = state.engine.lock();
        *e = SmoothScrollEngine::default();
    }
    state.commit_settings(snapshot.clone());
    snapshot
}

/// `set_enabled_state` + the two broadcasts every open window (and the tray
/// icon, via its `enabled-changed` listener) relies on to stay in sync.
pub(crate) fn apply_enabled<R: tauri::Runtime>(
    app: &AppHandle<R>,
    state: &Arc<AppState>,
    enabled: bool,
) {
    let snapshot = set_enabled_state(state, enabled);
    emit_enabled_changed(app, enabled);
    emit_settings_changed(app, &snapshot);
    tracing::info!(enabled, "enabled toggled");
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
    apply_enabled(&app, &state, enabled);
}

#[tauri::command]
pub fn get_settings(state: State<'_, Arc<AppState>>) -> AppSettings {
    state.settings.read().clone()
}

/// Export the live settings snapshot to a user-chosen path via the native
/// Save dialog. Writes atomically; returns the final path (".json" appended
/// when the user omitted it) so the UI can show where the file landed.
#[tauri::command]
pub fn export_settings(state: State<'_, Arc<AppState>>, path: String) -> Result<String, String> {
    let path = if path.to_lowercase().ends_with(".json") {
        path
    } else {
        format!("{path}.json")
    };
    let current = state.settings.read().clone();
    settings::save_to(std::path::Path::new(&path), &current).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub fn save_settings<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    settings: serde_json::Value,
) -> Result<(), String> {
    // Migrate through the same pipeline as disk loads so importing an old
    // backup yields exactly what a restart would load (v0 field insertions,
    // profile zoom inheritance, v1→v2 app profiles, key canonicalization).
    let (clamped, _) = settings::migrate_raw_settings(settings).map_err(|e| e.to_string())?;

    // Synchronous save — frontend's explicit Save action requires disk state.
    settings::save(&clamped).map_err(|e| e.to_string())?;

    state.commit_settings(clamped.clone());
    state.enabled.store(clamped.enabled, Ordering::Relaxed);
    state.engine_signal.signal();

    emit_enabled_changed(&app, clamped.enabled);
    emit_settings_changed(&app, &clamped);

    // Re-register the hotkey after the new settings are live. A failure here
    // (e.g. the combo is claimed by another app) must reach the UI — showing
    // a hotkey that is not actually registered is worse than failing the save.
    let state_arc: Arc<AppState> = (*state).clone();
    if let Err(e) = refresh_hotkey(&state_arc) {
        tracing::warn!(error = %e, "hotkey re-registration failed after save");
        return Err(format!("hotkey registration failed: {e}"));
    }

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
    // Build a candidate without mutating the authoritative in-memory store.
    // Persist FIRST: if this write fails, neither the OS registration nor
    // runtime state changes, so all sources of truth remain aligned.
    let previous = state.settings.read().clone();
    let mut snapshot = previous.clone();
    snapshot.start_with_os = enabled;
    settings::save(&snapshot).map_err(|e| e.to_string())?;

    if let Err(error) = state.autostart.set(enabled) {
        // Roll the persisted flag back so settings.json does not claim an
        // autostart registration the OS rejected. Keep the old in-memory
        // snapshot untouched; report the original OS error to the caller.
        let _ = settings::save(&previous);
        return Err(error.to_string());
    }

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
        crate::webview_memory::set_backgrounded(&win, false);
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
pub fn resize_for_update<R: tauri::Runtime>(app: AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: 350,
            height: 280,
        }));
        let _ = win.set_resizable(false);
        let _ = win.center();
    }
}

#[tauri::command]
pub fn restore_window_size<R: tauri::Runtime>(app: AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: 800,
            height: 600,
        }));
        let _ = win.set_resizable(true);
        let _ = win.center();
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
pub fn create_profile<R: tauri::Runtime>(
    app: AppHandle<R>,
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
    state.commit_settings(snapshot.clone());
    emit_settings_changed(&app, &snapshot);

    Ok(profile)
}

/// Update an existing profile.
#[tauri::command]
pub fn update_profile<R: tauri::Runtime>(
    app: AppHandle<R>,
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
    state.commit_settings(snapshot.clone());
    emit_settings_changed(&app, &snapshot);

    Ok(())
}

/// Delete a profile. Returns error if apps are assigned to it.
#[tauri::command]
pub fn delete_profile<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    profile_id: String,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();

        // Check if any apps are assigned to this profile. A profile can be
        // bound app-wide, per monitor, or per app-on-monitor; removing it
        // while any of those still point at it would leave a dangling binding.
        let mut assigned: Vec<String> = s
            .app_profiles
            .iter()
            .filter(|(_, id)| **id == profile_id)
            .map(|(name, _)| name.clone())
            .collect();
        assigned.extend(
            s.monitor_profiles
                .iter()
                .filter(|mp| mp.profile_id == profile_id)
                .map(|mp| mp.friendly_name.clone()),
        );
        assigned.extend(
            s.app_monitor_profiles
                .iter()
                .filter(|amp| amp.profile_id == profile_id)
                .map(|amp| format!("{} ({})", amp.process_name, amp.friendly_name)),
        );

        if !assigned.is_empty() {
            return Err(format!(
                "Cannot delete: profile is in use by: {}",
                assigned.join(", ")
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
    state.commit_settings(snapshot.clone());
    emit_settings_changed(&app, &snapshot);

    Ok(())
}

/// Assign a profile to an app. Use profile_id = None to remove assignment.
/// Passing `device_name` scopes the binding to that monitor, so one app can
/// carry a different profile on each screen.
#[tauri::command]
pub fn assign_app_profile<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    process_name: String,
    profile_id: Option<String>,
    device_name: Option<String>,
    friendly_name: Option<String>,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();

        // Validate profile exists (unless it's the special disabled ID)
        if let Some(ref id) = profile_id {
            if id != AppSettings::DISABLED_PROFILE_ID && !s.profiles.iter().any(|p| &p.id == id) {
                return Err(format!("profile '{id}' not found"));
            }
        }

        match device_name {
            Some(device) => s.assign_app_monitor_profile(
                &process_name,
                &device,
                &friendly_name.unwrap_or_default(),
                profile_id,
            ),
            None => s.assign_profile(process_name, profile_id),
        }
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot.clone());
    emit_settings_changed(&app, &snapshot);

    Ok(())
}

/// Remove profile assignment from an app. Passing `device_name` removes only
/// the binding for that app on that monitor.
#[tauri::command]
pub fn unassign_app_profile<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    process_name: String,
    device_name: Option<String>,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        match device_name {
            Some(device) => s.assign_app_monitor_profile(&process_name, &device, "", None),
            None => s.assign_profile(process_name.clone(), None),
        }
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot.clone());
    emit_settings_changed(&app, &snapshot);

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
    state.game_mode_active.load(Ordering::Acquire)
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
    let current_profile_id = s.app_profiles_lookup(&name).map(String::from);
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

// ---- Game Mode: game catalog + chip icons --------------------------------

#[derive(Debug, Clone, serde::Serialize)]
pub struct GameCatalogEntry {
    /// exe file name, e.g. "GTA5.exe" — same shape `game_mode_known_apps` stores.
    pub exe_name: String,
    /// Shortcut name / window title when known; secondary label in the picker.
    pub display_name: Option<String>,
}

/// Session cache of the installed-apps scan: built once on first catalog or
/// icon request, process-lifetime. A game installed mid-session appears in
/// the next app launch (accepted spec trade-off).
static INSTALLED_APPS: LazyLock<parking_lot::Mutex<Option<Vec<InstalledApp>>>> =
    LazyLock::new(|| parking_lot::Mutex::new(None));

/// Positive-only icon cache: canonical exe name -> base64 PNG (no data:
/// prefix). Failed lookups are cheap hash-miss retries, so they are not
/// cached.
static GAME_ICONS: LazyLock<parking_lot::Mutex<HashMap<String, String>>> =
    LazyLock::new(|| parking_lot::Mutex::new(HashMap::new()));

fn canonical_exe_key(name: &str) -> String {
    smoothscroll_core::settings::AppSettings::canonicalize_process_name(name)
}

/// Running-process entries come first (live-verified), installed entries fill
/// the rest; dedup is case-insensitive on the canonical exe name.
fn merge_game_catalog(
    installed: &[InstalledApp],
    running: &[ProcessInfo],
) -> Vec<GameCatalogEntry> {
    let mut out: Vec<GameCatalogEntry> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for p in running {
        let key = canonical_exe_key(&p.name);
        if key.is_empty() || !seen.insert(key) {
            continue;
        }
        let title = p.window_title.trim();
        out.push(GameCatalogEntry {
            exe_name: p.name.clone(),
            display_name: (!title.is_empty()).then(|| title.to_string()),
        });
    }
    for a in installed {
        let key = canonical_exe_key(&a.exe_name);
        if key.is_empty() || !seen.insert(key) {
            continue;
        }
        out.push(GameCatalogEntry {
            exe_name: a.exe_name.clone(),
            display_name: a.display_name.clone(),
        });
    }
    out
}

/// Resolves a known-game name to an on-disk exe: running processes first
/// (they carry `exe_path`), then the installed-apps scan.
fn resolve_exe_path(
    name: &str,
    installed: &[InstalledApp],
    running: &[ProcessInfo],
) -> Option<std::path::PathBuf> {
    let key = canonical_exe_key(name);
    if key.is_empty() {
        return None;
    }
    running
        .iter()
        .find(|p| canonical_exe_key(&p.name) == key)
        .and_then(|p| p.exe_path.as_deref())
        .map(std::path::PathBuf::from)
        .or_else(|| {
            installed
                .iter()
                .find(|a| canonical_exe_key(&a.exe_name) == key)
                .map(|a| a.exe_path.clone())
        })
}

fn ensure_installed_apps() -> Vec<InstalledApp> {
    let mut guard = INSTALLED_APPS.lock();
    if guard.is_none() {
        *guard = Some(smoothscroll_platform::installed_apps::scan_installed_apps());
        tracing::info!(
            count = guard.as_ref().map_or(0, |v| v.len()),
            "installed-apps scan complete"
        );
    }
    guard.clone().unwrap_or_default()
}

/// Picker catalog: installed apps (session-cached scan) + currently running
/// visible apps (fresh per call), deduped.
#[tauri::command]
pub fn get_game_catalog(state: State<'_, Arc<AppState>>) -> Vec<GameCatalogEntry> {
    let running = state.processes.list_visible_processes();
    let installed = ensure_installed_apps();
    merge_game_catalog(&installed, &running)
}

/// Chip icons for known games. Keys of the response mirror the requested
/// names; misses resolve to `null` and the frontend falls back to its
/// generic icon. Successes are cached by canonical name.
/// Disk cache for extracted game icons: `<config>/icon-cache/<key>.b64`
/// holding "<exe mtime nanos>\n<base64 png>". Keyed by canonical exe name
/// (matching the name-based game-mode matching); the mtime line invalidates
/// the entry when the source exe is replaced by an update.
fn icon_cache_dir() -> Option<std::path::PathBuf> {
    directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")
        .map(|d| d.config_dir().join("icon-cache"))
}

/// Windows file names cannot contain these; canonical exe names otherwise do.
fn safe_cache_file_name(key: &str) -> String {
    key.chars()
        .map(|c| {
            if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '_'
            } else {
                c
            }
        })
        .collect()
}

fn cache_file_path(dir: &std::path::Path, key: &str) -> std::path::PathBuf {
    dir.join(format!("{}.b64", safe_cache_file_name(key)))
}

fn exe_mtime_nanos(path: &std::path::Path) -> Option<u128> {
    std::fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_nanos())
}

fn load_cached_icon(dir: &std::path::Path, path: &std::path::Path, key: &str) -> Option<String> {
    let content = std::fs::read_to_string(cache_file_path(dir, key)).ok()?;
    let (mtime_line, b64) = content.split_once('\n')?;
    if mtime_line.trim() != exe_mtime_nanos(path)?.to_string() {
        return None;
    }
    // Cheap integrity check: base64 of a PNG always starts with this prefix.
    b64.starts_with("iVBOR").then(|| b64.to_string())
}

fn store_cached_icon(dir: &std::path::Path, path: &std::path::Path, key: &str, b64: &str) {
    let Some(nanos) = exe_mtime_nanos(path) else {
        return;
    };
    let _ = std::fs::create_dir_all(dir);
    let _ = std::fs::write(cache_file_path(dir, key), format!("{nanos}\n{b64}"));
}

/// Icon for a resolved exe: disk cache first, then extraction (persisted on
/// success). `cache_dir` is `None` when the config dir cannot be resolved —
/// the icon still extracts, it just is not persisted.
fn icon_for_path(
    path: &std::path::Path,
    key: &str,
    cache_dir: Option<&std::path::Path>,
) -> Option<String> {
    if let Some(dir) = cache_dir {
        if let Some(b64) = load_cached_icon(dir, path, key) {
            return Some(b64);
        }
    }
    smoothscroll_platform::icon::extract_for_exe(path).inspect(|b64| {
        if let Some(dir) = cache_dir {
            store_cached_icon(dir, path, key, b64);
        }
    })
}

#[tauri::command]
pub fn get_known_game_icons(
    state: State<'_, Arc<AppState>>,
    names: Vec<String>,
) -> HashMap<String, Option<String>> {
    let running = state.processes.list_visible_processes();
    let installed = ensure_installed_apps();
    let cache_dir = icon_cache_dir();
    let mut icons = GAME_ICONS.lock();
    let mut out: HashMap<String, Option<String>> = HashMap::new();
    for name in names {
        let key = canonical_exe_key(&name);
        if key.is_empty() {
            continue;
        }
        let icon = match icons.get(&key) {
            Some(b64) => Some(b64.clone()),
            None => resolve_exe_path(&name, &installed, &running)
                .and_then(|path| icon_for_path(&path, &key, cache_dir.as_deref()))
                .inspect(|b64| {
                    icons.insert(key.clone(), b64.clone());
                }),
        };
        out.insert(name, icon);
    }
    out
}

#[cfg(test)]
mod tests {
    mod game_catalog_tests {
        use super::super::{merge_game_catalog, resolve_exe_path};
        use smoothscroll_platform::installed_apps::InstalledApp;
        use smoothscroll_platform::traits::ProcessInfo;
        use std::path::PathBuf;

        fn installed(name: &str, path: &str) -> InstalledApp {
            InstalledApp {
                exe_name: name.into(),
                display_name: None,
                exe_path: PathBuf::from(path),
            }
        }

        fn running(name: &str, exe_path: Option<&str>) -> ProcessInfo {
            ProcessInfo {
                pid: 1,
                name: name.into(),
                window_title: String::new(),
                exe_path: exe_path.map(|s| s.to_string()),
            }
        }

        #[test]
        fn merge_puts_running_first_and_dedups_case_insensitively() {
            let installed = vec![installed("hades.exe", r"C:\g\hades.exe")];
            let running = vec![running("HadesII.exe", Some(r"C:\g\hades2.exe"))];
            let got = merge_game_catalog(&installed, &running);
            // Running first, then the not-yet-seen installed entry.
            assert_eq!(got[0].exe_name, "HadesII.exe");
            assert_eq!(got[1].exe_name, "hades.exe");
        }

        #[test]
        fn merge_hides_installed_entry_duplicate_of_running() {
            let installed = vec![installed("cs2.exe", r"C:\s\cs2.exe")];
            let running = vec![running("CS2.EXE", Some(r"C:\s\cs2.exe"))];
            let got = merge_game_catalog(&installed, &running);
            assert_eq!(got.len(), 1);
            assert_eq!(got[0].exe_name, "CS2.EXE");
            // window_title empty -> display_name stays None
            assert_eq!(got[0].display_name, None);
        }

        #[test]
        fn merge_drops_empty_names() {
            let installed = vec![InstalledApp {
                exe_name: String::new(),
                display_name: None,
                exe_path: PathBuf::from(r"C:\x"),
            }];
            let running = vec![running("   ", None)];
            assert!(merge_game_catalog(&installed, &running).is_empty());
        }

        #[test]
        fn resolve_prefers_running_exe_path_then_installed() {
            let installed = vec![installed("hades.exe", r"C:\g\hades.exe")];
            // Named `running_procs` so the `running(..)` helper stays callable below.
            let running_procs = vec![running("cs2.exe", Some(r"C:\s\cs2.exe"))];

            assert_eq!(
                resolve_exe_path("cs2.EXE", &installed, &running_procs),
                Some(PathBuf::from(r"C:\s\cs2.exe"))
            );
            assert_eq!(
                resolve_exe_path("Hades.exe", &installed, &running_procs),
                Some(PathBuf::from(r"C:\g\hades.exe"))
            );
            // Running process without an exe_path falls through to the scan.
            let no_path = vec![running("hades.exe", None)];
            assert_eq!(
                resolve_exe_path("hades.exe", &installed, &no_path),
                Some(PathBuf::from(r"C:\g\hades.exe"))
            );
            assert_eq!(
                resolve_exe_path("missing.exe", &installed, &running_procs),
                None
            );
        }
    }

    mod game_icon_disk_cache_tests {
        use super::super::{load_cached_icon, safe_cache_file_name, store_cached_icon};
        use std::path::PathBuf;
        use std::time::{SystemTime, UNIX_EPOCH};

        fn temp_cache_dir() -> PathBuf {
            let dir = std::env::temp_dir().join(format!(
                "ss-icon-cache-test-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir_all(&dir).unwrap();
            dir
        }

        #[test]
        fn safe_cache_file_name_replaces_windows_reserved_chars() {
            assert_eq!(safe_cache_file_name("a<b>c:d"), "a_b_c_d");
            assert_eq!(safe_cache_file_name("gta5"), "gta5");
        }

        #[test]
        fn disk_cache_round_trips_and_invalidates_on_source_change() {
            let dir = temp_cache_dir();
            let exe = dir.join("Game.exe");
            std::fs::write(&exe, b"mz").unwrap();

            store_cached_icon(&dir, &exe, "game.exe", "iVBORw0KGgoAAAANSUhEUg=");
            assert_eq!(
                load_cached_icon(&dir, &exe, "Game.exe").as_deref(),
                Some("iVBORw0KGgoAAAANSUhEUg=")
            );

            // Same key but a different (missing) source exe: mtime unreadable.
            assert_eq!(
                load_cached_icon(&dir, &dir.join("missing.exe"), "game.exe"),
                None
            );

            // Corrupted payload without the PNG base64 prefix is rejected.
            std::fs::write(
                dir.join(format!("{}.b64", safe_cache_file_name("corrupt"))),
                "123\nnotpng",
            )
            .unwrap();
            assert_eq!(load_cached_icon(&dir, &exe, "corrupt"), None);

            let _ = std::fs::remove_dir_all(&dir);
        }
    }
}
