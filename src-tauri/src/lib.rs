//! App entry point. Composition Root.

#[cfg(target_os = "macos")]
mod ipc_socket_server;
mod commands;
mod edge_scroll_thread;
mod engine_thread;
pub mod game_mode;
mod hook_wiring;
mod settings_persistor;
mod state;
mod tray;

#[cfg(test)]
mod settings_persistor_tests;

use arc_swap::ArcSwap;
use engine_thread::EngineThread;
use hook_wiring::EngineSink;
use parking_lot::{Mutex, RwLock};
use settings_persistor::SettingsPersistor;
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{self, EffectiveSettings};
use smoothscroll_platform::icon::IconCache;
use smoothscroll_platform::traits::HookHandle;
use state::{AppState, EngineSignal};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

pub fn run() {
    init_logging();

    let platform = match smoothscroll_platform::current() {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = %e, "failed to initialize platform - SmoothScroll cannot run");
            eprintln!("SmoothScroll failed to start: {}", e);
            std::process::exit(1);
        }
    };
    let initial_rm = platform.accessibility.reduce_motion_enabled();

    let refresh_hz = platform.display.primary_refresh_rate_hz();
    let frame_ms = 1000.0 / refresh_hz as f64;
    tracing::info!("Display refresh rate: {refresh_hz}Hz, frame interval: {frame_ms:.2}ms");
    let timer_period: u32 = if refresh_hz <= 75 { 2 } else { 1 };

    #[cfg(windows)]
    let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
        Arc::new(smoothscroll_platform::windows::WindowsWindowGeometry);
    #[cfg(target_os = "macos")]
    let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
        Arc::new(smoothscroll_platform::macos::MacosWindowGeometry);
    #[cfg(target_os = "linux")]
    let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
        Arc::new(smoothscroll_platform::linux::LinuxWindowGeometry);

    #[cfg(windows)]
    let monitor_enum: Arc<dyn smoothscroll_platform::traits::MonitorEnumeration> =
        Arc::new(smoothscroll_platform::windows::WindowsWindowGeometry);
    #[cfg(target_os = "macos")]
    let monitor_enum: Arc<dyn smoothscroll_platform::traits::MonitorEnumeration> =
        Arc::new(smoothscroll_platform::macos::MacosWindowGeometry);
    #[cfg(target_os = "linux")]
    let monitor_enum: Arc<dyn smoothscroll_platform::traits::MonitorEnumeration> =
        Arc::new(smoothscroll_platform::linux::LinuxWindowGeometry);

    let loaded_settings = settings::load();
    let enabled_initial = loaded_settings.enabled;
    let engine = Arc::new(Mutex::new(SmoothScrollEngine::new()));
    let settings_arc = Arc::new(RwLock::new(loaded_settings.clone()));

    // Build initial hot-path snapshots.
    let initial_eff = EffectiveSettings::from_settings(&loaded_settings);
    let effective_arc = Arc::new(ArcSwap::from_pointee(initial_eff));
    let effective_per_profile: std::collections::HashMap<String, Arc<EffectiveSettings>> =
        loaded_settings
            .profiles
            .iter()
            .map(|p| {
                (
                    p.id.clone(),
                    Arc::new(EffectiveSettings::with_profile(&loaded_settings, p)),
                )
            })
            .collect();
    let effective_per_profile_arc = Arc::new(RwLock::new(effective_per_profile));

    let persistor = Arc::new(SettingsPersistor::spawn());

    let config_dir = directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")
        .map(|d| d.config_dir().to_path_buf())
        .unwrap_or_else(std::env::temp_dir);
    let stats_collector = smoothscroll_core::stats::StatsCollector::new(config_dir.join("stats.json"));

    #[cfg(windows)]
    let fullscreen_detector: Arc<dyn smoothscroll_platform::traits::FullscreenDetector> =
        Arc::new(smoothscroll_platform::windows::WindowsFullscreenDetector);
    #[cfg(target_os = "macos")]
    let fullscreen_detector: Arc<dyn smoothscroll_platform::traits::FullscreenDetector> =
        Arc::new(smoothscroll_platform::macos::MacosFullscreenDetector);
    #[cfg(target_os = "linux")]
    let fullscreen_detector: Arc<dyn smoothscroll_platform::traits::FullscreenDetector> =
        Arc::new(smoothscroll_platform::linux::LinuxFullscreenDetector);

    let app_state = Arc::new(AppState {
        engine,
        settings: settings_arc,
        effective: effective_arc,
        effective_per_profile: effective_per_profile_arc,
        mouse_hook: platform.mouse_hook,
        emitter: platform.wheel_emitter.clone(),
        zoom_emitter: platform.zoom_emitter.clone(),
        processes: platform.process_query,
        autostart: platform.autostart,
        hotkey: platform.hotkey,
        hotkey_handle: Arc::new(Mutex::new(None)),
        engine_signal: Arc::new(EngineSignal::default()),
        enabled: Arc::new(AtomicBool::new(enabled_initial)),
        game_mode_active: Arc::new(AtomicBool::new(false)),
        fullscreen_detector,
        window_geom,
        monitor_enum,
        last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
        persistor,
        reduce_motion: Arc::new(AtomicBool::new(initial_rm)),
        accessibility: platform.accessibility.clone(),
        rm_watch_handle: Arc::new(Mutex::new(None)),
        last_foreground_at_tray_open: Arc::new(Mutex::new(None)),
        app_icon_cache: Arc::new(Mutex::new(IconCache::new())),
        stats: stats_collector,
    });

    // Apply the OS Reduce Motion signal to the initial effective snapshot.
    // Without this, the engine smooths everything until the user first saves
    // settings or the RM watcher fires.
    app_state.commit_settings(loaded_settings.clone());

    let engine_thread = EngineThread::spawn(app_state.clone(), frame_ms);
    edge_scroll_thread::spawn(app_state.clone());

    let sink = EngineSink::new(app_state.clone());
    let sink_for_emitter = sink.clone();

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

    let _ = crate::commands::refresh_hotkey(&app_state);

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
        _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(timer_period),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second instance was launched. Keep a single tray icon by
            // activating the existing instance instead of creating a new one.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state.clone())
        .manage(parking_lot::Mutex::new(Some(owned)))
        .setup(move |app| {
            // Initialize system tray on all platforms. The Swift Menu Bar app
            // (macos/SmoothScrollMenuBar) is the primary tray on macOS and talks
            // to the engine over the Unix socket below; the Tauri tray remains
            // available as a fallback.
            #[cfg(not(target_os = "macos"))]
            {
                tray::init(app.handle(), state_for_setup.clone())?;
            }
            #[cfg(target_os = "macos")]
            {
                if let Err(e) = tray::init(app.handle(), state_for_setup.clone()) {
                    tracing::warn!(error = %e, "failed to initialize tray on macOS");
                }
            }

            #[cfg(target_os = "macos")]
            {
                // IPC server for potential future Swift companion app communication.
                // Even with Tauri tray, we keep the IPC server available.
                use crate::ipc_socket_server::{ipc_socket_path, IpcServer};

                let socket_path = ipc_socket_path();
                let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(());
                let ipc_server = Arc::new(IpcServer::new(
                    socket_path,
                    shutdown_rx,
                    state_for_setup.clone(),
                ));

                // Spawn IPC server on a dedicated tokio runtime.
                // Tauri v2 doesn't expose its internal runtime for arbitrary async tasks,
                // so we create a new one on a background thread.
                let _server_handle = std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new()
                        .expect("failed to create IPC tokio runtime");
                    rt.block_on(async move {
                        if let Err(e) = ipc_server.run().await {
                            tracing::debug!(error = %e, "IPC server error (non-critical)");
                        }
                    });
                });

                tracing::info!("IPC server spawned at {:?}", socket_path);

                // Monitor quit signal and exit Tauri app when received.
                let app_handle = app.handle().clone();
                let quit_rx = ipc_server.quit_tx.subscribe();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async move {
                        let mut quit_rx = quit_rx;
                        quit_rx.changed().await.ok();
                        tracing::info!("Quit signal received, exiting app");
                        app_handle.exit(0);
                    });
                });
            }

            // Reduce-motion watcher: re-commits settings when OS toggles RM
            // and emits reduce-motion-changed for the UI to update its status line.
            let app_for_rm = app.handle().clone();
            let app_state_for_rm = state_for_setup.clone();
            let rm_result = state_for_setup
                .accessibility
                .watch(Box::new(move |new_value: bool| {
                    app_state_for_rm
                        .reduce_motion
                        .store(new_value, std::sync::atomic::Ordering::Relaxed);
                    let snapshot = app_state_for_rm.settings.read().clone();
                    app_state_for_rm.commit_settings(snapshot);
                    let _ = tauri::Emitter::emit(&app_for_rm, "reduce-motion-changed", new_value);
                }));
            match rm_result {
                Ok(handle) => {
                    *state_for_setup.rm_watch_handle.lock() = Some(handle);
                }
                Err(e) => {
                    tracing::warn!(error = %e, "reduce-motion watcher unavailable - app will run without OS reduce-motion sync");
                }
            }

            // Bridge classifier transitions to the frontend so it can drop
            // its 1Hz polling and react push-style.
            let app_for_emit = app.handle().clone();
            sink_for_emitter.install_input_source_emitter(move |label| {
                crate::commands::emit_input_source_changed(&app_for_emit, label);
            });

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
            commands::get_platform_status,
            commands::is_trusted_device,
            commands::open_log_dir,
            commands::open_tray_panel,
            commands::close_tray_panel,
            commands::resize_tray_panel,
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
            commands::get_input_source,
            commands::get_reduce_motion_status,
            commands::get_default_settings,
            commands::get_foreground_app_context,
            commands::apply_onboarding_preset,
            commands::skip_onboarding,
            commands::reset_onboarding,
            commands::list_monitors,
            commands::get_daily_stats,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            tracing::error!(error = %e, "Tauri runtime error - shutting down");
            sentry::capture_error(&e);
            eprintln!("SmoothScroll encountered an error: {}", e);
        });
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

fn init_logging() {
    prune_old_logs();

    // Initialize Sentry for crash reporting
    if let Some(guard) = init_sentry() {
        // Leak the guard so it lives for the program's lifetime.
        Box::leak(Box::new(guard));
    }

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
        .with(sentry_tracing::layer())
        .with(fmt::layer().with_target(false))
        .with(
            fmt::layer()
                .with_writer(file_writer)
                .with_ansi(false)
                .with_target(false),
        )
        .try_init();
}

/// Initialize Sentry for crash reporting.
/// Returns a guard that must be kept alive for the duration of the program.
/// In development, Sentry is disabled to avoid noise.
fn init_sentry() -> Option<sentry::ClientInitGuard> {
    let dsn = std::env::var("SENTRY_DSN").unwrap_or_default();

    if dsn.is_empty() {
        tracing::debug!("Sentry disabled (no SENTRY_DSN configured)");
        return None;
    }

    let dsn_for_log = dsn.split('@').next().unwrap_or("<hidden>");

    let guard = sentry::init((
        dsn.clone(),
        sentry::ClientOptions {
            release: sentry::release_name!(),
            traces_sample_rate: 0.1,
            ..Default::default()
        },
    ));

    tracing::info!(dsn = %dsn_for_log, "Sentry initialized for crash reporting");

    Some(guard)
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
