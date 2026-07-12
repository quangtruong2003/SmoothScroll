use crate::state::AppState;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use smoothscroll_core::engine::SmoothScrollEngine;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixListener;
use tokio::sync::broadcast;

pub fn ipc_socket_path() -> PathBuf {
    let dirs = ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")
        .expect("failed to resolve project directories");
    dirs.data_dir().join("socket")
}

type ResponseResult = (Option<serde_json::Value>, Option<IpcError>);

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
pub enum IpcEvent {
    ScrollStateChanged { enabled: bool },
    DirectionSyncChanged { enabled: bool },
    PresetChanged { preset: String },
    SettingsChanged { settings: serde_json::Value },
}

pub struct IpcServer {
    path: PathBuf,
    shutdown_rx: tokio::sync::watch::Receiver<()>,
    event_tx: broadcast::Sender<IpcEvent>,
    app_state: Arc<AppState>,
    pub quit_tx: tokio::sync::watch::Sender<bool>,
}

impl IpcServer {
    pub fn new(
        path: PathBuf,
        shutdown_rx: tokio::sync::watch::Receiver<()>,
        app_state: Arc<AppState>,
    ) -> Self {
        let (event_tx, _) = broadcast::channel(100);
        let (quit_tx, _) = tokio::sync::watch::channel(false);
        Self { path, shutdown_rx, event_tx, app_state, quit_tx }
    }

    pub async fn run(self: Arc<Self>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.path.exists() {
            let _ = std::fs::remove_file(&self.path);
        }
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let listener = UnixListener::bind(&self.path)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&self.path, std::fs::Permissions::from_mode(0o600));
        }
        let mut shutdown_rx = self.shutdown_rx.clone();
        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => break,
                accept_result = listener.accept() => {
                    let (socket, _) = accept_result?;
                    let tx = self.event_tx.clone();
                    let state = self.app_state.clone();
                    let me = self.clone();
                    tokio::spawn(Self::handle_client(me, socket, tx, state));
                }
            }
        }
        Ok(())
    }

    async fn handle_client(
        self: Arc<Self>,
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
                                    let data = serde_json::to_vec(&resp).unwrap_or_default();
                                    let _ = writer.write_all(&data).await;
                                    let _ = writer.write_all(b"\n").await;
                                    continue;
                                }
                            };
                            let id = request.get("id").cloned();
                            let method = request.get("method").and_then(|m| m.as_str()).unwrap_or("").to_string();
                            let params = request.get("params").cloned();
                            let response = self.process_request(&method, &params).await;
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
                        Ok(None) | Err(_) => break,
                    }
                }
                event = rx.recv() => {
                    if let Ok(event) = event {
                        if let Ok(msg) = serde_json::to_vec(&event) {
                            let _ = writer.write_all(&msg).await;
                            let _ = writer.write_all(b"\n").await;
                        }
                    }
                }
            }
        }
    }

    async fn process_request(&self, method: &str, params: &Option<serde_json::Value>) -> ResponseResult {
        match method {
            "get_scroll_enabled" => {
                let enabled = self.app_state.enabled.load(std::sync::atomic::Ordering::Relaxed);
                (Some(serde_json::json!(enabled)), None)
            }
            "set_scroll_enabled" => {
                let enabled = params.as_ref().and_then(|p| p.get("enabled")).and_then(|v| v.as_bool()).unwrap_or(false);
                self.app_state.enabled.store(enabled, std::sync::atomic::Ordering::Release);
                if enabled { self.app_state.engine_signal.signal(); }
                let _ = self.event_tx.send(IpcEvent::ScrollStateChanged { enabled });
                (Some(serde_json::json!(true)), None)
            }
            "get_preset" => {
                let settings = self.app_state.settings.read();
                (Some(serde_json::json!(settings.active_profile)), None)
            }
            "set_preset" => {
                let preset = params.as_ref().and_then(|p| p.get("preset")).and_then(|v| v.as_str()).unwrap_or("default").to_string();
                { let mut s = self.app_state.settings.write(); s.active_profile = preset.clone(); }
                let snapshot = self.app_state.settings.read().clone();
                self.app_state.commit_settings(snapshot);
                self.app_state.engine_signal.signal();
                let _ = self.event_tx.send(IpcEvent::PresetChanged { preset });
                (Some(serde_json::json!(true)), None)
            }
            "get_settings" => {
                let settings = self.app_state.settings.read();
                (Some(serde_json::to_value(&*settings).unwrap_or(serde_json::Value::Null)), None)
            }
            "quit" => {
                let _ = self.quit_tx.send(true);
                (Some(serde_json::json!(true)), None)
            }
            _ => (None, Some(IpcError { code: -32601, message: format!("Method not found: {method}") })),
        }
    }
}
