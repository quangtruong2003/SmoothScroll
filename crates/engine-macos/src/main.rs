//! Standalone macOS engine binary for SmoothScroll.
//!
//! Initializes the scroll engine, IPC server, and mouse hook.
//! The Swift Menu Bar app (macos/SmoothScrollMenuBar) connects via IPC.

use arc_swap::ArcSwap;
use parking_lot::{Mutex, RwLock};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{self, EffectiveSettings};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

mod engine_thread;
mod hook_wiring;
mod ipc_server;
mod settings_persistor;
mod state;

use state::{AppState, EngineSignal};

fn main() {
    init_logging();
    tracing::info!("SmoothScroll macOS engine starting...");

    let platform = match smoothscroll_platform::current() {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = %e, "failed to initialize platform");
            std::process::exit(1);
        }
    };

    let initial_rm = platform.accessibility.reduce_motion_enabled();
    let refresh_hz = platform.display.primary_refresh_rate_hz();
    let frame_ms = 1000.0 / refresh_hz as f64;
    tracing::info!("Display: {refresh_hz}Hz, frame: {frame_ms:.2}ms");

    let loaded_settings = settings::load();
    let enabled_initial = loaded_settings.enabled;
    let engine = Arc::new(Mutex::new(SmoothScrollEngine::new()));
    let settings_arc = Arc::new(RwLock::new(loaded_settings.clone()));

    let initial_eff = EffectiveSettings::from_settings(&loaded_settings);
    let effective_arc = Arc::new(ArcSwap::from_pointee(initial_eff));
    let effective_per_profile: HashMap<String, Arc<EffectiveSettings>> = loaded_settings
        .profiles
        .iter()
        .map(|p| (p.id.clone(), Arc::new(EffectiveSettings::with_profile(&loaded_settings, p))))
        .collect();
    let effective_per_profile_arc = Arc::new(RwLock::new(effective_per_profile));

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
        persistor: Arc::new(settings_persistor::SettingsPersistor::spawn()),
        reduce_motion: Arc::new(std::sync::atomic::AtomicBool::new(initial_rm)),
        accessibility: platform.accessibility.clone(),
    });

    app_state.commit_settings(loaded_settings);

    // Start engine thread
    let _engine_thread = engine_thread::EngineThread::spawn(app_state.clone(), frame_ms);

    // Install mouse hook
    let hook_handle = if smoothscroll_platform::macos::is_accessibility_trusted(false) {
        let sink = Arc::new(hook_wiring::EngineSink::new(app_state.clone()));
        match app_state.mouse_hook.install(sink as Arc<dyn smoothscroll_platform::traits::HookEventSink>) {
            Ok(h) => {
                tracing::info!("Mouse hook installed");
                Some(h)
            }
            Err(e) => {
                tracing::warn!(error = %e, "hook install failed");
                None
            }
        }
    } else {
        tracing::warn!("Accessibility not granted; hook not installed");
        None
    };

    // Start IPC server
    let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
    rt.block_on(async {
        let socket_path = ipc_server::ipc_socket_path();
        let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(());
        let ipc = Arc::new(ipc_server::IpcServer::new(
            socket_path.clone(),
            shutdown_rx,
            app_state.clone(),
        ));

        let server = ipc.clone();
        let _handle = tokio::spawn(async move {
            if let Err(e) = server.run().await {
                tracing::error!(error = %e, "IPC server error");
            }
        });

        tracing::info!("Engine ready at {:?}", socket_path);

        // Wait for quit signal
        let mut quit_rx = ipc.quit_tx.subscribe();
        quit_rx.changed().await.ok();
        tracing::info!("Quit signal received, shutting down");
    });

    drop(hook_handle);
    tracing::info!("Engine stopped");
}

fn init_logging() {
    let log_path = if let Some(dirs) = directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll") {
        if let Some(home) = std::env::var_os("HOME") {
            std::path::PathBuf::from(home).join("Library/Logs/SmoothScroll")
        } else {
            dirs.config_dir().join("logs")
        }
    } else {
        std::env::temp_dir().join("SmoothScroll-logs")
    };
    let _ = std::fs::create_dir_all(&log_path);

    let file_appender = tracing_appender::rolling::daily(&log_path, "engine");
    let (file_writer, _guard) = tracing_appender::non_blocking(file_appender);
    Box::leak(Box::new(_guard));

    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,smoothscroll_engine=debug"));

    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(false))
        .with(fmt::layer().with_writer(file_writer).with_ansi(false).with_target(false))
        .try_init();
}
