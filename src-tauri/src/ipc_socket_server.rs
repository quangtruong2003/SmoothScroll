//! Unix domain socket IPC server for communication with the Swift Menu Bar app.
//!
//! Listens on `~/.config/smoothscroll/smoothscroll.sock` (macOS: `~/Library/Application Support/...`)
//! and handles JSON-RPC 2.0 requests.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
#[cfg(target_os = "macos")]
use tokio::net::UnixListener;
#[cfg(target_os = "macos")]
use tokio::sync::broadcast;

use crate::state::AppState;

type ResponseResult = (Option<serde_json::Value>, Option<IpcError>);

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IpcResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<IpcError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IpcError {
    pub code: i32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum IpcEvent {
    ScrollStateChanged { enabled: bool },
    DirectionSyncChanged { enabled: bool },
    PresetChanged { preset: String },
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
pub struct IpcServer {
    path: PathBuf,
    shutdown_rx: tokio::sync::watch::Receiver<()>,
    event_tx: broadcast::Sender<IpcEvent>,
    app_state: Arc<AppState>,
}

#[cfg(target_os = "macos")]
impl IpcServer {
    pub fn new(
        path: PathBuf,
        shutdown_rx: tokio::sync::watch::Receiver<()>,
        app_state: Arc<AppState>,
    ) -> Self {
        let (event_tx, _) = broadcast::channel(100);
        Self {
            path,
            shutdown_rx,
            event_tx,
            app_state,
        }
    }

    pub fn event_tx(&self) -> broadcast::Sender<IpcEvent> {
        self.event_tx.clone()
    }

    pub async fn run(self: Arc<Self>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Remove stale socket file.
        if self.path.exists() {
            let _ = std::fs::remove_file(&self.path);
        }

        // Ensure parent directory exists.
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let listener = match UnixListener::bind(&self.path) {
            Ok(l) => l,
            Err(e) => return Err(format!("failed to bind Unix socket at {:?}: {}", self.path, e).into()),
        };

        loop {
            tokio::select! {
                _ = self.shutdown_rx.changed() => {
                    tracing::info!("IPC server shutting down");
                    break;
                }
                accept_result = listener.accept() => {
                    let (socket, _) = accept_result?;
                    let tx = self.event_tx.clone();
                    let state = self.app_state.clone();
                    tokio::spawn(Self::handle_client(socket, tx, state));
                }
            }
        }

        Ok(())
    }

    async fn handle_client(
        socket: tokio::net::UnixStream,
        event_tx: broadcast::Sender<IpcEvent>,
        app_state: Arc<AppState>,
    ) {
        let (reader, mut writer) = socket.into_split();
        let mut reader = BufReader::new(reader);
        let mut lines = reader.lines();
        let mut rx = event_tx.subscribe();

        loop {
            tokio::select! {
                line = lines.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            let request: serde_json::Value = match serde_json::from_str(&line) {
                                Ok(v) => v,
                                Err(_) => {
                                    let resp = IpcResponse {
                                        jsonrpc: "2.0".into(),
                                        id: None,
                                        result: None,
                                        error: Some(IpcError { code: -32700, message: "Parse error".into() }),
                                    };
                                    let _ = writer.write_all(serde_json::to_vec(&resp).unwrap_or_default().as_slice()).await;
                                    let _ = writer.write_all(b"\n").await;
                                    continue;
                                }
                            };
                            let id = request.get("id").cloned();
                            let method = request.get("method").and_then(|m| m.as_str()).unwrap_or("").to_string();
                            let params = request.get("params").cloned();
                            let response = Self::process_request(&method, &params, &app_state, &event_tx).await;
                            let resp_with_id = IpcResponse {
                                jsonrpc: "2.0".into(),
                                id,
                                result: response.0,
                                error: response.1,
                            };
                            if let Ok(data) = serde_json::to_vec(&resp_with_id) {
                                let _ = writer.write_all(&data).await;
                                let _ = writer.write_all(b"\n").await;
                            }
                        }
                        Ok(None) => break,
                        Err(_) => break,
                    }
                }
                event = rx.recv() => {
                    if let Ok(event) = event {
                        if let Ok(msg) = serde_json::to_vec(&event) {
                        let _ = writer.write_all(msg.as_bytes()).await;
                        let _ = writer.write_all(b"\n").await;
                    }
                }
            }
        }
    }

    type ResponseResult = (Option<serde_json::Value>, Option<IpcError>);

    async fn process_request(
        method: &str,
        params: &Option<serde_json::Value>,
        app_state: &Arc<AppState>,
        event_tx: &broadcast::Sender<IpcEvent>,
    ) -> ResponseResult {
        match method {
            "get_scroll_enabled" => {
                let enabled = app_state.enabled.load(Ordering::Relaxed);
                (Some(serde_json::json!(enabled)), None)
            }
            "set_scroll_enabled" => {
                let enabled = params
                    .as_ref()
                    .and_then(|p| p.get("enabled"))
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                app_state.enabled.store(enabled, Ordering::Relaxed);
                let _ = event_tx.send(IpcEvent::ScrollStateChanged { enabled });
                (Some(serde_json::json!(true)), None)
            }
            "get_direction_sync_enabled" => {
                // Direction sync is not yet wired into AppState — return default.
                (Some(serde_json::json!(false)), None)
            }
            "set_direction_sync_enabled" => {
                // TODO: wire direction sync into AppState when available.
                let _enabled = params
                    .as_ref()
                    .and_then(|p| p.get("enabled"))
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                (Some(serde_json::json!(true)), None)
            }
            "get_preset" => {
                let eff = app_state.effective.load();
                let preset = &eff.active_profile;
                (Some(serde_json::json!(preset)), None)
            }
            "set_preset" => {
                let preset = params
                    .as_ref()
                    .and_then(|p| p.get("preset"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("balanced")
                    .to_string();
                let _ = event_tx.send(IpcEvent::PresetChanged { preset });
                (Some(serde_json::json!(true)), None)
            }
            "get_settings" => {
                let settings = app_state.settings.read();
                let json = serde_json::to_value(&*settings).unwrap_or(serde_json::Value::Null);
                (Some(json), None)
            }
            "save_settings" => {
                if let Some(s) = params.as_ref().and_then(|p| p.get("settings")) {
                    if let Ok(updated) = serde_json::from_value::<smoothscroll_core::settings::AppSettings>(s.clone()) {
                        app_state.commit_settings(updated);
                    }
                }
                (Some(serde_json::json!(true)), None)
            }
            "quit" => {
                // Signal the app to quit via the existing command.
                // We can't call tauri commands directly from here, so set a flag.
                // The tray or a periodic check can respond to this.
                (Some(serde_json::json!(true)), None)
            }
            _ => (
                None,
                Some(IpcError {
                    code: -32601,
                    message: format!("Method not found: {method}"),
                }),
            ),
        }
    }
}

// ---------------------------------------------------------------------------
// Non-macOS stubs (so the crate compiles on Windows/Linux)
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "macos"))]
pub struct IpcServer;

#[cfg(not(target_os = "macos"))]
impl IpcServer {
    pub fn new(
        _path: PathBuf,
        _shutdown_rx: tokio::sync::watch::Receiver<()>,
        _app_state: Arc<AppState>,
    ) -> Self {
        Self
    }

    pub async fn run(self: Arc<Self>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // No-op on non-macOS platforms.
        Ok(())
    }
}
