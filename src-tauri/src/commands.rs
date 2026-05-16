//! Tauri IPC commands callable from JS.

use crate::state::AppState;
use softscroll_core::engine::SmoothScrollEngine;
use softscroll_core::settings::{self, AppSettings};
use softscroll_platform::traits::ProcessInfo;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
pub fn get_enabled(state: State<'_, Arc<AppState>>) -> bool {
    state.enabled.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_enabled(state: State<'_, Arc<AppState>>, enabled: bool) {
    state.enabled.store(enabled, Ordering::Relaxed);
    if enabled {
        state.engine_signal.signal();
    } else {
        let mut e = state.engine.lock();
        let s = e.settings().clone();
        *e = SmoothScrollEngine::new(s);
    }
    tracing::info!(enabled, "set_enabled");
}

#[tauri::command]
pub fn get_settings(state: State<'_, Arc<AppState>>) -> AppSettings {
    state.settings.read().clone()
}

#[tauri::command]
pub fn save_settings(state: State<'_, Arc<AppState>>, settings: AppSettings) -> Result<(), String> {
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

    tracing::debug!("settings saved");
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
    softscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_excluded_app(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.excluded_apps.retain(|a| !a.eq_ignore_ascii_case(&name));
    }
    let snapshot = state.settings.read().clone();
    softscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_autostart(state: State<'_, Arc<AppState>>) -> bool {
    state.autostart.is_enabled()
}

#[tauri::command]
pub fn set_autostart(state: State<'_, Arc<AppState>>, enabled: bool) -> Result<(), String> {
    state.autostart.set(enabled).map_err(|e| e.to_string())?;
    {
        let mut s = state.settings.write();
        s.start_with_os = enabled;
    }
    let snapshot = state.settings.read().clone();
    softscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn change_language(state: State<'_, Arc<AppState>>, lang: String) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.language = lang;
        s.clamp();
    }
    let snapshot = state.settings.read().clone();
    softscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn accessibility_status() -> bool {
    #[cfg(target_os = "macos")]
    {
        softscroll_platform::macos::is_accessibility_trusted(false)
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
        softscroll_platform::macos::is_accessibility_trusted(true)
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

#[tauri::command]
pub fn open_log_dir(_state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let dir = crate::log_dir();
    let _ = std::fs::create_dir_all(&dir);
    open_path(&dir).map_err(|e| e.to_string())
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
    Ok(())
}
