# SmoothScroll macOS — Plan 1: Rust IPC Server

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing IPC server into the Tauri app, fix all IPC handlers to correctly modify engine state, and update event serialization to match the Swift JSON-RPC protocol.

**Architecture:** The Rust IPC server lives in `crates/ipc/src/ipc_socket_server.rs`. This plan wires it into `src-tauri/src/lib.rs` on macOS, fixes the event serialization format, and ensures commands correctly persist settings and signal the engine.

**Tech Stack:** Rust (tokio, serde_json), Tauri v2

---

## File Structure

```
src-tauri/src/
  lib.rs              (MOD)  Wire IpcServer on macOS, skip tray::init
  ipc_socket_server.rs  (MOD)  Fix handlers, serialization, socket permissions
```

---

## Task 1: Fix Syntax Error in handle_client

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

The `event = rx.recv()` arm is missing a closing brace. This causes a compile error.

- [ ] **Step 1: Find the broken event arm around line 170-178**

Search for `event = rx.recv() =>` in the file and check the brace matching.

- [ ] **Step 2: Fix the missing closing brace**

The current code (broken):
```rust
event = rx.recv() => {
    if let Ok(event) = event {
        if let Ok(msg) = serde_json::to_vec(&event) {
            let _ = writer.write_all(msg.as_bytes()).await;
            let _ = writer.write_all(b"\n").await;
        }
    }
```

Should be:
```rust
event = rx.recv() => {
    if let Ok(event) = event {
        if let Ok(msg) = serde_json::to_vec(&event) {
            let _ = writer.write_all(msg.as_bytes()).await;
            let _ = writer.write_all(b"\n").await;
        }
    }
}
```

- [ ] **Step 3: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: No syntax errors related to ipc_socket_server

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(ipc): add missing closing brace in handle_client event arm"
```

---

## Task 2: Fix Event Serialization Format

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

The `IpcEvent` enum currently uses `#[serde(tag = "event")]` which produces `{"event":"scrollStateChanged","enabled":true}`. Swift's `Codable` enum expects `{"scrollStateChanged":{"enabled":true}}` — no tag wrapper.

- [ ] **Step 1: Find the IpcEvent enum definition**

Search for `pub enum IpcEvent` in `ipc_socket_server.rs`.

- [ ] **Step 2: Replace the serde attribute**

Current (broken):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum IpcEvent { ... }
```

Replace with:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IpcEvent {
    ScrollStateChanged { enabled: bool },
    PresetChanged { preset: String },
    SettingsChanged { settings: AppSettings },
}
```

- [ ] **Step 3: Verify the new format**

The new format produces:
```json
{"scrollStateChanged": {"enabled": true}}
{"PresetChanged": {"preset": "balanced"}}
```

This matches what Swift's `Codable` enum can decode natively.

- [ ] **Step 4: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(ipc): change IpcEvent serialization to camelCase without tag wrapper"
```

---

## Task 3: Add ipc_socket_path() Function

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

Create a helper function that returns the correct socket path using the `directories` crate. This ensures Swift and Rust resolve to the same path.

- [ ] **Step 1: Add the ipc_socket_path function at the top of ipc_socket_server.rs**

```rust
use directories::ProjectDirs;

/// Returns the Unix socket path for IPC communication.
/// MUST match Swift's `SocketPath.socket` constant.
/// On macOS, ProjectDirs.from("com", "SmoothScroll", "SmoothScroll") produces
/// ~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket
pub fn ipc_socket_path() -> std::path::PathBuf {
    let dirs = ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")
        .expect("failed to resolve project directories");
    dirs.data_dir().join("socket")
}
```

- [ ] **Step 2: Verify the directories crate is available**

Check `src-tauri/Cargo.toml` for `directories` in dependencies. If not present, add:
```toml
directories = "5"
```

- [ ] **Step 3: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs src-tauri/Cargo.toml
git commit -m "feat(ipc): add ipc_socket_path() using directories crate"
```

---

## Task 4: Wire IpcServer into lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

The `IpcServer` is currently dead code — defined but never instantiated. This task wires it into the Tauri setup function on macOS and skips the Tauri tray icon.

- [ ] **Step 1: Find the setup function in lib.rs**

Search for `fn setup` or `pub fn run` and understand where `tray::init` is called.

- [ ] **Step 2: Add macOS-specific IPC server spawning**

Add this block after `tray::init()` (or in place of it on macOS):

```rust
#[cfg(target_os = "macos")]
{
    use crate::ipc_socket_server::{ipc_socket_path, IpcServer};
    
    let socket_path = ipc_socket_path();
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(());
    let ipc_server = Arc::new(IpcServer::new(
        socket_path,
        shutdown_rx,
        app_state.clone(),
    ));

    // Spawn IPC server on a dedicated tokio runtime
    // Tauri v2 doesn't expose its internal runtime for arbitrary async tasks
    let _server_handle = std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new()
            .expect("failed to create IPC tokio runtime");
        rt.block_on(async move {
            if let Err(e) = ipc_server.run().await {
                tracing::error!(error = %e, "IPC server error");
            }
        });
    });

    // Store shutdown_tx for cleanup (add to OwnedHandles or AppState as needed)
    tracing::info!("IPC server spawned at {:?}", socket_path);
}
```

- [ ] **Step 3: Skip tray::init on macOS**

Replace the current `tray::init` call with:
```rust
#[cfg(not(target_os = "macos"))]
{
    tray::init(app.handle(), state.clone())?;
}
#[cfg(target_os = "macos")]
{
    // Swift menu bar app owns the tray icon on macOS.
    // tray::init is skipped — Swift NSStatusItem replaces it.
}
```

- [ ] **Step 4: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully (macOS-specific code won't affect other platforms)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(macos): wire IpcServer into Tauri app, skip tray icon"
```

---

## Task 5: Fix set_scroll_enabled Handler

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

When `set_scroll_enabled(false)` is called, the engine must be reset to default state (matching the Tauri command behavior).

- [ ] **Step 1: Find the "set_scroll_enabled" match arm in process_request**

Search for `set_scroll_enabled` in the file.

- [ ] **Step 2: Update the handler to reset engine on disable**

Current (broken):
```rust
"set_scroll_enabled" => {
    let enabled = params
        .as_ref()
        .and_then(|p| p.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    app_state.enabled.store(enabled, Ordering::Release);
    if enabled {
        app_state.engine_signal.signal();
    }

    let _ = event_tx.send(IpcEvent::ScrollStateChanged { enabled });
    (Some(serde_json::json!(true)), None)
}
```

Replace with:
```rust
"set_scroll_enabled" => {
    let enabled = params
        .as_ref()
        .and_then(|p| p.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    app_state.enabled.store(enabled, Ordering::Release);
    if enabled {
        app_state.engine_signal.signal();
    } else {
        // Reset engine to default when disabling — matches Tauri command behavior.
        let mut e = app_state.engine.lock();
        *e = SmoothScrollEngine::default();
    }

    let _ = event_tx.send(IpcEvent::ScrollStateChanged { enabled });
    (Some(serde_json::json!(true)), None)
}
```

- [ ] **Step 3: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(ipc): reset engine to default when scroll disabled"
```

---

## Task 6: Fix set_preset Handler

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

When `set_preset` is called, it must persist to disk and signal the engine (not just update the active profile in memory).

- [ ] **Step 1: Find the "set_preset" match arm in process_request**

Search for `set_preset` in the file.

- [ ] **Step 2: Update the handler to persist and signal**

Current (broken):
```rust
"set_preset" => {
    let preset = params
        .as_ref()
        .and_then(|p| p.get("preset"))
        .and_then(|v| v.as_str())
        .unwrap_or("balanced")
        .to_string();

    // Update active profile in settings
    {
        let mut s = app_state.settings.write();
        s.active_profile = preset.clone();
    }

    let _ = event_tx.send(IpcEvent::PresetChanged { preset });
    (Some(serde_json::json!(true)), None)
}
```

Replace with:
```rust
"set_preset" => {
    let preset = params
        .as_ref()
        .and_then(|p| p.get("preset"))
        .and_then(|v| v.as_str())
        .unwrap_or("balanced")
        .to_string();

    // Update the active profile in settings and persist.
    {
        let mut s = app_state.settings.write();
        s.active_profile = preset.clone();
    }
    let snapshot = app_state.settings.read().clone();
    app_state.commit_settings(snapshot);
    app_state.engine_signal.signal();

    let _ = event_tx.send(IpcEvent::PresetChanged { preset });
    (Some(serde_json::json!(true)), None)
}
```

- [ ] **Step 3: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(ipc): persist preset and signal engine in set_preset handler"
```

---

## Task 7: Fix quit Handler and Add Quit Signal Channel

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`
- Modify: `src-tauri/src/lib.rs`

The `quit` command must signal the Tauri app to exit (currently it's a no-op).

- [ ] **Step 1: Add quit_tx to IpcServer struct**

Find the `IpcServer` struct definition and add:
```rust
pub struct IpcServer {
    // ... existing fields ...
    pub quit_tx: tokio::sync::watch::Sender<bool>,
}
```

- [ ] **Step 2: Initialize quit_tx in IpcServer::new**

In the `new` function, add:
```rust
let (quit_tx, _) = tokio::sync::watch::channel(false);
```

And include it in the struct initialization.

- [ ] **Step 3: Add quit match arm in process_request**

```rust
"quit" => {
    let _ = app_state.quit_tx.send(true);
    (Some(serde_json::json!(true)), None)
}
```

- [ ] **Step 4: Monitor quit signal in lib.rs**

In the setup code, after spawning the IPC server, add a tokio task to watch for quit:

```rust
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
```

- [ ] **Step 5: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs src-tauri/src/lib.rs
git commit -m "feat(ipc): add quit handler with watch channel to exit Tauri app"
```

---

## Task 8: Fix save_settings Handler

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

The `save_settings` handler should return an error response if deserialization fails.

- [ ] **Step 1: Find the "save_settings" match arm in process_request**

Search for `save_settings` in the file.

- [ ] **Step 2: Update to return proper error on failure**

Current (broken - ignores errors):
```rust
"save_settings" => {
    if let Some(s) = params.as_ref().and_then(|p| p.get("settings")) {
        if let Ok(updated) = serde_json::from_value::<AppSettings>(s.clone()) {
            app_state.commit_settings(updated);
        }
    }
    (Some(serde_json::json!(true)), None)
}
```

Replace with:
```rust
"save_settings" => {
    if let Some(s) = params.as_ref().and_then(|p| p.get("settings")) {
        match serde_json::from_value::<AppSettings>(s.clone()) {
            Ok(updated) => {
                app_state.commit_settings(updated);
                (Some(serde_json::json!(true)), None)
            }
            Err(e) => (
                None,
                Some(IpcError {
                    code: -32000,
                    message: format!("Invalid settings: {}", e),
                }),
            ),
        }
    } else {
        (
            None,
            Some(IpcError {
                code: -32602,
                message: "Missing 'settings' parameter".into(),
            }),
        )
    }
}
```

- [ ] **Step 3: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(ipc): return error on save_settings deserialization failure"
```

---

## Task 9: Add write_all Error Handling

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

When `write_all` fails (client disconnected), the loop should exit cleanly.

- [ ] **Step 1: Find write_all calls in handle_client**

Search for `writer.write_all` in the file.

- [ ] **Step 2: Add error handling to break on disconnect**

Current (broken - ignores errors):
```rust
let _ = writer.write_all(msg.as_bytes()).await;
let _ = writer.write_all(b"\n").await;
```

Replace with:
```rust
if let Err(_) = writer.write_all(&msg).await {
    break; // Client disconnected — exit loop
}
if let Err(_) = writer.write_all(b"\n").await {
    break;
}
```

- [ ] **Step 3: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(ipc): break loop on write_all error in handle_client"
```

---

## Task 10: Add Socket Permissions

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

After binding the Unix socket, set restrictive permissions to prevent unauthorized access.

- [ ] **Step 1: Find where the socket is bound**

Search for `UnixListener::bind` or `bind_addr` in the file.

- [ ] **Step 2: Add permission setting after socket creation**

```rust
#[cfg(unix)]
{
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(&self.path, std::fs::Permissions::from_mode(0o600));
}
```

- [ ] **Step 3: Verify cargo check passes**

Run: `cd src-tauri && cargo check`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "security(ipc): set socket permissions to 0o600 on Unix"
```

---

## Verification

After completing all tasks:

1. **Compile check:** `cd src-tauri && cargo check` passes on macOS
2. **Socket path test:** Verify `ipc_socket_path()` returns `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket`
3. **Event format test:** Serialize an `IpcEvent` and verify output is `{"scrollStateChanged":{"enabled":true}}` (no `event` tag)
4. **Handler test:** Manual test with `socat` or nc to verify commands work correctly
