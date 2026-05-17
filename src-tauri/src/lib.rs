//! App entry point. Composition Root.

mod commands;
mod edge_scroll_thread;
mod engine_thread;
pub mod game_mode;
mod hook_wiring;
pub mod keyboard_sink;
mod state;
mod tray;

use engine_thread::EngineThread;
use hook_wiring::EngineSink;
use parking_lot::{Mutex, RwLock};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings;
use smoothscroll_platform::traits::HookHandle;
use state::{AppState, EngineSignal};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

pub fn run() {
    init_logging();

    let platform = smoothscroll_platform::current().expect("build platform");

    #[cfg(windows)]
    let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
        Arc::new(smoothscroll_platform::windows::WindowsWindowGeometry);
    #[cfg(target_os = "macos")]
    let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
        Arc::new(smoothscroll_platform::macos::MacosWindowGeometry);

    let loaded_settings = settings::load();
    let enabled_initial = loaded_settings.enabled;
    let engine = Arc::new(Mutex::new(SmoothScrollEngine::new(loaded_settings.clone())));
    let settings_arc = Arc::new(RwLock::new(loaded_settings));

    #[cfg(windows)]
    let fullscreen_detector: Arc<dyn smoothscroll_platform::traits::FullscreenDetector> =
        Arc::new(smoothscroll_platform::windows::WindowsFullscreenDetector);
    #[cfg(target_os = "macos")]
    let fullscreen_detector: Arc<dyn smoothscroll_platform::traits::FullscreenDetector> =
        Arc::new(smoothscroll_platform::macos::MacosFullscreenDetector);

    #[cfg(windows)]
    let keyboard_hook: Arc<dyn smoothscroll_platform::traits::KeyboardScrollHook> =
        Arc::new(smoothscroll_platform::windows::WindowsKeyboardScrollHook);
    #[cfg(target_os = "macos")]
    let keyboard_hook: Arc<dyn smoothscroll_platform::traits::KeyboardScrollHook> =
        Arc::new(smoothscroll_platform::macos::MacosKeyboardScrollHook);

    let app_state = Arc::new(AppState {
        engine,
        settings: settings_arc,
        mouse_hook: platform.mouse_hook,
        emitter: platform.wheel_emitter,
        processes: platform.process_query,
        autostart: platform.autostart,
        hotkey: platform.hotkey,
        hotkey_handle: Arc::new(Mutex::new(None)),
        keyboard_hook,
        keyboard_handle: Arc::new(Mutex::new(None)),
        engine_signal: Arc::new(EngineSignal::default()),
        enabled: Arc::new(AtomicBool::new(enabled_initial)),
        game_mode_active: Arc::new(AtomicBool::new(false)),
        fullscreen_detector,
        window_geom,
    });

    let engine_thread = EngineThread::spawn(app_state.clone());
    edge_scroll_thread::spawn(app_state.clone());

    let sink = EngineSink::new(app_state.clone());

    #[cfg(target_os = "macos")]
    let trusted = smoothscroll_platform::macos::is_accessibility_trusted(false);
    #[cfg(not(target_os = "macos"))]
    let trusted = true;

    let hook_result: Result<HookHandle, _> = if trusted {
        app_state
            .mouse_hook
            .install(sink as Arc<dyn smoothscroll_platform::traits::HookEventSink>)
    } else {
        tracing::warn!("Accessibility not granted on macOS; hook not installed");
        Err(smoothscroll_platform::types::PlatformError::PermissionDenied)
    };

    // Register global hotkey from settings if enabled.
    if app_state.settings.read().enable_global_hotkey {
        let accel = app_state.settings.read().hotkey_accelerator.clone();
        match commands::register_hotkey_internal(&app_state, &accel) {
            Ok(()) => tracing::info!(accel = %accel, "hotkey registered"),
            Err(e) => tracing::warn!(error = %e, "hotkey registration failed"),
        }
    }

    let _ = crate::commands::refresh_keyboard_hook(&app_state);

    let state_for_setup = app_state.clone();

    // OwnedHandles is managed by Tauri so it is dropped on app exit —
    // guaranteeing deterministic drop order for the hook, engine thread, and
    // timer guard, preventing leaked OS hooks or orphan processes.
    struct OwnedHandles {
        #[allow(dead_code)]
        _engine: EngineThread,
        #[allow(dead_code)]
        _hook: Option<HookHandle>,
        #[cfg(windows)]
        #[allow(dead_code)]
        _timer: smoothscroll_platform::windows::HighResTimerGuard,
    }

    let owned = OwnedHandles {
        _engine: engine_thread,
        _hook: hook_result.ok(),
        #[cfg(windows)]
        _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(1),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(app_state.clone())
        .manage(parking_lot::Mutex::new(Some(owned)))
        .setup(move |app| {
            tray::init(app.handle(), state_for_setup.clone())?;

            crate::game_mode::spawn(app.handle().clone(), state_for_setup.clone());

            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });

                // Always hide main window — silent boot
                let _ = win.hide();
            }

            tracing::info!(
                "SmoothScroll ready (enabled={})",
                state_for_setup.enabled.load(Ordering::Relaxed)
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_enabled,
            commands::set_enabled,
            commands::get_settings,
            commands::save_settings,
            commands::set_hotkey_enabled,
            commands::set_hotkey_accelerator,
            commands::list_running_processes,
            commands::add_excluded_app,
            commands::remove_excluded_app,
            commands::get_autostart,
            commands::set_autostart,
            commands::change_language,
            commands::accessibility_status,
            commands::accessibility_request_prompt,
            commands::app_version,
            commands::open_log_dir,
            commands::open_tray_panel,
            commands::close_tray_panel,
            commands::show_main_window,
            commands::navigate_to,
            commands::quit_app,
            // Profile management
            commands::list_profiles,
            commands::create_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::assign_app_profile,
            commands::unassign_app_profile,
            commands::suggest_profile_for_app,
            // Game mode
            commands::add_known_game,
            commands::remove_known_game,
            commands::get_game_mode_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

fn init_logging() {
    prune_old_logs();

    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let log_path = log_dir();
    let _ = std::fs::create_dir_all(&log_path);

    let file_appender = tracing_appender::rolling::daily(&log_path, "softscroll");
    let (file_writer, guard) = tracing_appender::non_blocking(file_appender);
    // Leak the guard so it lives for the program's lifetime — flushing on normal
    // exit is handled automatically.
    Box::leak(Box::new(guard));

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,softscroll=debug"));

    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(false))
        .with(
            fmt::layer()
                .with_writer(file_writer)
                .with_ansi(false)
                .with_target(false),
        )
        .try_init();
}

/// Returns the platform-appropriate log directory. Exposed as `pub(crate)` so
/// commands can open the log folder without duplicating the path logic.
pub(crate) fn log_dir() -> PathBuf {
    if let Some(dirs) = directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll") {
        #[cfg(target_os = "macos")]
        {
            // Use ~/Library/Logs/SmoothScroll — the macOS-native log location.
            if let Some(home) = std::env::var_os("HOME") {
                return PathBuf::from(home).join("Library/Logs/SmoothScroll");
            }
        }
        return dirs.config_dir().join("logs");
    }
    std::env::temp_dir().join("SmoothScroll-logs")
}

fn prune_old_logs() {
    let dir = log_dir();
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(7 * 24 * 3600))
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = meta.modified() else {
            continue;
        };
        if modified < cutoff {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}
