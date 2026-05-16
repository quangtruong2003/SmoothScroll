//! App entry point. Composition Root — equivalent to C# `App.xaml.cs.OnStartup`.

mod commands;
mod engine_thread;
mod hook_wiring;
mod state;
mod tray;

use engine_thread::EngineThread;
use hook_wiring::EngineSink;
use parking_lot::{Mutex, RwLock};
use softscroll_core::engine::SmoothScrollEngine;
use softscroll_core::settings;
use softscroll_platform::traits::{HookHandle, HotkeyHandle};
use softscroll_platform::types::Accelerator;
use state::{AppState, EngineSignal};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

pub fn run() {
    init_logging();

    let platform = softscroll_platform::current().expect("build platform");

    let loaded_settings = settings::load();
    let enabled_initial = loaded_settings.enabled;
    let engine = Arc::new(Mutex::new(SmoothScrollEngine::new(loaded_settings.clone())));
    let settings_arc = Arc::new(RwLock::new(loaded_settings));

    let app_state = Arc::new(AppState {
        engine,
        settings: settings_arc,
        mouse_hook: platform.mouse_hook,
        emitter: platform.wheel_emitter,
        processes: platform.process_query,
        autostart: platform.autostart,
        hotkey: platform.hotkey,
        engine_signal: Arc::new(EngineSignal::default()),
        enabled: Arc::new(AtomicBool::new(enabled_initial)),
    });

    let engine_thread = EngineThread::spawn(app_state.clone());

    let sink = EngineSink::new(app_state.clone());

    #[cfg(target_os = "macos")]
    let trusted = softscroll_platform::macos::is_accessibility_trusted(false);
    #[cfg(not(target_os = "macos"))]
    let trusted = true;

    let hook_result: Result<HookHandle, _> = if trusted {
        app_state
            .mouse_hook
            .install(sink as Arc<dyn softscroll_platform::traits::HookEventSink>)
    } else {
        tracing::warn!("Accessibility not granted on macOS; hook not installed");
        Err(softscroll_platform::types::PlatformError::PermissionDenied)
    };

    // Register global hotkey (Ctrl+Alt+S) if enabled in settings.
    let hotkey_result = if app_state.settings.read().enable_global_hotkey {
        let toggle_state = app_state.clone();
        let on_pressed: Box<dyn Fn() + Send + Sync> = Box::new(move || {
            let new_enabled = !toggle_state.enabled.load(Ordering::Relaxed);
            toggle_state.enabled.store(new_enabled, Ordering::Relaxed);
            toggle_state.engine_signal.signal();
            tracing::info!(enabled = new_enabled, "hotkey toggled");
        });
        app_state.hotkey.register(
            Accelerator {
                raw: "Ctrl+Alt+S".to_string(),
            },
            on_pressed,
        )
    } else {
        Err(softscroll_platform::types::PlatformError::Unsupported)
    };

    let state_for_setup = app_state.clone();

    // OwnedHandles is managed by Tauri so it is dropped on app exit —
    // guaranteeing deterministic drop order for the hook, engine thread, and
    // timer guard, preventing leaked OS hooks or orphan processes.
    struct OwnedHandles {
        #[allow(dead_code)]
        _engine: EngineThread,
        #[allow(dead_code)]
        _hook: Option<HookHandle>,
        #[allow(dead_code)]
        _hotkey: Option<HotkeyHandle>,
        #[cfg(windows)]
        #[allow(dead_code)]
        _timer: softscroll_platform::windows::HighResTimerGuard,
    }

    let owned = OwnedHandles {
        _engine: engine_thread,
        _hook: hook_result.ok(),
        _hotkey: hotkey_result.ok(),
        #[cfg(windows)]
        _timer: softscroll_platform::windows::HighResTimerGuard::begin(1),
    };

    tauri::Builder::default()
        .manage(app_state.clone())
        .manage(parking_lot::Mutex::new(Some(owned)))
        .setup(move |app| {
            tray::init(app.handle(), state_for_setup.clone())?;

            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });

                if state_for_setup.settings.read().start_minimized {
                    let _ = win.hide();
                }
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
