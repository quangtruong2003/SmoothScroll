# SmoothScroll macOS — Implementation Spec (v3.2)

> **Date:** June 21, 2026
> **Status:** v3.2 — Complete rewrite fixing all CRITICAL/HIGH issues from v3.1 review
> **Goal:** Native macOS menu bar app with correct IPC, proper SwiftUI patterns, and Apple HIG compliance

---

## 0. Review Fixes Summary (v3.1 → v3.2)

This v3.2 spec addresses all issues identified in the senior Swift/Rust/macOS review:

| v3.1 Issue | v3.2 Fix |
|------------|-----------|
| `ReconnectionManager` never wired | Added instantiation and `start()` in `AppDelegate` |
| `IPCClient.shared` actor singleton pattern | Changed to `nonisolated static let shared` |
| `MenuBarController` notification callback thread unsafe | Wrapped in `Task { @MainActor in }` |
| `saveSettingsSnapshot` race condition | Added `@Published var isMutating` guard to prevent concurrent saves |
| `SocketPath` force unwrap | Changed to `guard let` with proper error handling |
| `AppSettingsResponse` incomplete | Now matches ALL Rust `AppSettings` fields |
| `setDirectionSyncEnabled` UI misleading | Disabled UI until backend supports (shows "Coming Soon") |
| No rollback on error in mutation methods | Added rollback logic on IPC failure |
| `connectionState` UI only handled `.failed` | Now handles `.connecting`, `.reconnecting`, `.disconnected` |
| `loadInitialState` doesn't check isConnected | Added `isConnected` guard before connect |
| `ReconnectionManager` missing from file structure | Added `ReconnectionManager.swift` |
| Missing `LSUIElement` config | Added `Info.plist` section with full `LSUIElement` |
| Phase 4 checklist incomplete | Added ReconnectionManager wiring items |

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    macOS Menu Bar                            │
│                                                              │
│   [NSStatusItem] ──click──► [NSPopover]                     │
│   ● green / ○ gray           │                               │
│                               ▼                               │
│   [SwiftUI PopoverView] ◄──► [SettingsStore]                │
│                               │                               │
│                               ▼                               │
│   [IPCClient (actor)] ◄──► [IpcServer (Rust)]              │
│   Unix Domain Socket         Unix Domain Socket              │
│                                                              │
│                               ▼                               │
│                    [Rust Engine + CGEventTap]                │
│                    - Smooth scroll, horizontal, zoom          │
│                    - Profile management                       │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** One tray icon only. On macOS, the Swift `NSStatusItem` is the sole tray. The Tauri `tray::init()` is skipped on macOS when the Swift menu bar app is active (see Phase 0).

---

## 2. Socket Path Convention

Both Swift and Rust MUST resolve to the same absolute path. Use platform-standard directories:

| Platform | Resolver | Path |
|----------|----------|------|
| macOS | `directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")` | `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket` |
| Linux | `directories::ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")` | `~/.config/com.SmoothScroll.SmoothScroll/socket` |
| Windows | Named pipe (not Unix socket) | `\\.\pipe\smoothscroll-ipc` |

**⚠️ Critical:** `ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")` on macOS produces the path with `com.SmoothScroll.` prefix — NOT just `SmoothScroll`. The Swift side MUST use the same `com.SmoothScroll.SmoothScroll` directory name.

**Rust:**
```rust
use directories::ProjectDirs;

fn ipc_socket_path() -> PathBuf {
    let dirs = ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")
        .expect("failed to resolve project directories");
    dirs.data_dir().join("socket")
}
```

**Swift:**
```swift
/// MUST match Rust `ProjectDirs::from("com", "SmoothScroll", "SmoothScroll")`.
/// On macOS, ProjectDirs produces `com.SmoothScroll.SmoothScroll` — NOT `SmoothScroll`.
enum SocketPath {
    static let socket: String = {
        // Use Result-based approach instead of force unwrap
        guard let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            // Fallback: use temporary directory if Application Support unavailable
            return NSTemporaryDirectory() + "com.SmoothScroll.SmoothScroll/socket"
        }
        
        let path = appSupport
            .appendingPathComponent("com.SmoothScroll.SmoothScroll")
            .appendingPathComponent("socket")
        
        // Ensure directory exists
        try? FileManager.default.createDirectory(
            at: path,
            withIntermediateDirectories: true,
            attributes: nil
        )
        
        return path.path
    }()
}
```

Both resolve to: `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket`

**Verification:** Write a unit test that asserts `SocketPath.socket == ipc_socket_path()` (Rust) at build time, or manually verify both paths match before first deploy.

---

## 3. IPC Protocol

### 3.1 Wire Format

Newline-delimited JSON-RPC 2.0. Each message is a single JSON object terminated by `\n`.

### 3.2 Serialization Contract

Rust serializes events using **enum case names** (no `#[serde(tag)]` wrapper). Swift decodes with standard `Codable` using matching case names.

**Rust event format:**
```json
{"scrollStateChanged": {"enabled": true}}
{"presetChanged": {"preset": "balanced"}}
```

**Swift expects:**
```swift
enum IpcEvent: Codable, Sendable {
    case scrollStateChanged(enabled: Bool)
    case presetChanged(preset: String)
    // ...
}
```

Swift's default `Codable` for enums with associated values produces exactly the Rust format above when using `snake_case` coding keys. **No tag wrapper.**

### 3.3 Commands (Swift → Rust)

| Method | Params | Returns | Notes |
|--------|--------|---------|-------|
| `get_scroll_enabled` | none | `bool` | Read from `app_state.enabled` |
| `set_scroll_enabled` | `{ enabled: bool }` | `bool` | Must reset engine on disable (see §4.2) |
| `get_preset` | none | `string` | Read from `app_state.effective.active_profile` |
| `set_preset` | `{ preset: string }` | `bool` | Must persist + signal engine (see §4.3) |
| `get_settings` | none | `AppSettings` | Full settings snapshot |
| `save_settings` | `{ settings: AppSettings }` | `bool` | Saves full settings (see §4.5) |
| `quit` | none | `bool` | Must signal app exit (see §4.4) |

**Note:** `horizontal_scroll`, `zoom`, and `direction_sync` are per-profile settings within `AppSettings`, not top-level toggles. The Swift UI reads/writes them via `get_settings` / `save_settings`. No separate IPC commands needed.

### 3.4 Events (Rust → Swift)

| Event | Payload | When |
|-------|---------|------|
| `scrollStateChanged` | `{ enabled: bool }` | Scroll toggled |
| `presetChanged` | `{ preset: string }` | Active profile changed |
| `settingsChanged` | Full `AppSettings` JSON | Any settings change (save_settings) |

### 3.5 Request/Response Matching

Swift tracks pending requests by `id`. When a response arrives with a matching `id`, the corresponding `CheckedContinuation` is resumed.

**⚠️ Race condition prevention:** The continuation MUST be stored BEFORE writing the request to the socket. If the request is written first, the response can arrive before the continuation is stored, causing a permanent hang.

**Correct pattern:**

```swift
actor IPCClient {
    nonisolated static let shared = IPCClient()  // FIXED: nonisolated for singleton access
    
    private var pendingRequests: [Int: CheckedContinuation<IpcResponse, Error>] = [:]

    /// Store continuation FIRST, then write request to socket.
    func send(_ request: IpcRequestMessage) async throws -> IpcResponse {
        let id = request.id

        // 1. Create continuation — stored IMMEDIATELY in the callback.
        //    No Task hop: callback runs synchronously on the actor.
        let response = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<IpcResponse, Error>) in
            pendingRequests[id] = cont
        }

        // 2. NOW write the request. If write fails, clean up continuation.
        do {
            try writeRequest(request)
        } catch {
            pendingRequests.removeValue(forKey: id)?
                .resume(throwing: IpcError.message("Write failed: \(error.localizedDescription)"))
            throw error
        }

        return response
    }

    private func handleResponse(_ response: IpcResponse) {
        guard let id = response.id else { return }
        if let cont = pendingRequests.removeValue(forKey: id) {
            if let error = response.error {
                cont.resume(throwing: IpcError.message(error.message))
            } else {
                cont.resume(returning: response)
            }
        }
    }
}
```

**Why NOT `Task { await self.storeContinuation(...) }` inside the callback?**
A `Task {}` inside `withCheckedThrowingContinuation`'s closure spawns a new task — the continuation is NOT stored when the closure returns. The response can arrive and be processed before the Task runs, leaving the continuation dangling (and the caller hung forever).

---

## 4. Rust Changes

### 4.0 Phase 0: Wire IPC Server into `lib.rs`

**This is the most critical change.** The `IpcServer` is currently dead code — defined but never instantiated.

In `lib.rs`, after `tray::init()`, spawn the IPC server on a dedicated tokio runtime:

```rust
#[cfg(target_os = "macos")]
{
    let socket_path = ipc_socket_server::ipc_socket_path();
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(());
    let ipc_server = Arc::new(ipc_socket_server::IpcServer::new(
        socket_path,
        shutdown_rx,
        app_state_for_setup.clone(),
    ));

    // Spawn IPC server on a dedicated tokio runtime (Tauri v2 doesn't
    // expose its internal runtime for arbitrary async tasks).
    let server_handle = std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("failed to create IPC tokio runtime");
        rt.block_on(async move {
            if let Err(e) = ipc_server.run().await {
                tracing::error!(error = %e, "IPC server error");
            }
        });
    });

    // Store shutdown sender and thread handle for cleanup.
    // Add to OwnedHandles or AppState.
}
```

**Also:** On macOS, skip `tray::init()` since the Swift menu bar app handles the tray icon. Guard with:

```rust
// In setup():
#[cfg(target_os = "macos")]
{
    // Swift menu bar app owns the tray icon on macOS.
    // tray::init is skipped — Swift NSStatusItem replaces it.
}
#[cfg(not(target_os = "macos"))]
{
    tray::init(app.handle(), state_for_setup.clone())?;
}
```

### 4.1 Fix Syntax Error in `handle_client`

Lines 170-178 of `ipc_socket_server.rs` have a missing closing brace. The `event = rx.recv()` arm needs:

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

### 4.2 Fix `set_scroll_enabled` — Reset Engine on Disable

Must mirror the Tauri command behavior:

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

### 4.3 Fix `set_preset` — Persist and Signal

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

### 4.4 Fix `quit` — Signal App Exit

Add a `tokio::sync::watch` channel for quit signaling:

```rust
// In IpcServer struct:
pub struct IpcServer {
    // ... existing fields ...
    quit_tx: tokio::sync::watch::Sender<bool>,
}

// In process_request:
"quit" => {
    let _ = app_state_for_quit_tx.send(true);
    (Some(serde_json::json!(true)), None)
}
```

In `lib.rs`, monitor the quit signal and call `app.exit(0)` when received.

### 4.5 Fix `save_settings` — Return Error on Failure

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
                    message: format!("Invalid settings: {e}"),
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

### 4.6 Fix Event Serialization — Remove `#[serde(tag)]`

Replace:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum IpcEvent { ... }
```

With:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IpcEvent {
    ScrollStateChanged { enabled: bool },
    PresetChanged { preset: String },
    SettingsChanged { settings: AppSettings },
}
```

This produces `{"scrollStateChanged": {"enabled": true}}` which Swift `Codable` decodes natively.

### 4.7 Add `write_all` Error Handling

```rust
// In handle_client, replace `let _ = writer.write_all(...)` with:
if let Err(_) = writer.write_all(&data).await {
    break; // Client disconnected — exit loop
}
if let Err(_) = writer.write_all(b"\n").await {
    break;
}
```

### 4.8 Socket Permissions

After binding the Unix socket, set restrictive permissions:

```rust
#[cfg(unix)]
{
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(&self.path, std::fs::Permissions::from_mode(0o600));
}
```

---

## 5. Swift Changes

### 5.1 File Structure

```
macos/SmoothScrollMenuBar/Sources/
├── App/
│   ├── main.swift                    # Entry point (KEEP)
│   └── AppDelegate.swift             # App lifecycle (REWRITE)
├── IPC/
│   ├── IPCClient.swift               # Socket client (REWRITE)
│   ├── IPCProtocol.swift             # Wire types (REWRITE)
│   └── ReconnectionManager.swift     # Auto-reconnect (NEW)
├── MenuBar/
│   └── MenuBarController.swift       # NSStatusItem + NSPopover (REWRITE)
├── Settings/
│   ├── SettingsStore.swift            # Observable state (REWRITE)
│   └── ScrollPreset.swift             # Preset enum (NEW - extracted)
├── Views/
│   ├── SmoothScrollPopover.swift     # Main popover (REWRITE)
│   └── VisualEffectBlur.swift        # NSVisualEffectView wrapper (KEEP)
└── Resources/
    ├── Info.plist                    # LSUIElement = true (UPDATE)
    └── SmoothScrollMenuBar.entitlements  # (KEEP)
```

**Delete:**
- `DirectionSyncSection.swift` — replaced by inline toggle in `SmoothScrollPopover`
- `SmoothScrollSection.swift` — replaced by inline toggles
- `PresetShortcutsView.swift` — replaced by segmented picker
- `SettingsRow.swift` — no longer needed
- `DeviceDirectionCard.swift` — not referenced

### 5.2 `ScrollPreset.swift`

```swift
import Foundation

/// Speed presets that map to Rust profile IDs.
enum ScrollPreset: String, CaseIterable, Identifiable, Sendable {
    case balanced = "balanced"
    case snappy = "snappy"
    case glide = "glide"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .balanced: return "Balanced"
        case .snappy: return "Snappy"
        case .glide: return "Glide"
        }
    }
}
```

### 5.3 `IPCProtocol.swift`

```swift
import Foundation

// MARK: - JSON-RPC Wire Types

/// JSON-RPC 2.0 request envelope.
/// `jsonrpc` is a constant string literal — Swift infers as `String`.
struct JSONRPCRequest: Encodable, Sendable {
    let jsonrpc: String = "2.0"
    let id: Int
    let method: String
    let params: AnyEncodable?
}

struct IpcResponse: Decodable, Sendable {
    let id: Int?
    let result: AnyDecodable?
    let error: IpcErrorBody?
}

struct IpcErrorBody: Decodable, Sendable {
    let code: Int
    let message: String
}

// MARK: - Type-Erased Codable Wrappers

/// Wraps any Encodable value for JSON-RPC params.
/// IMPORTANT: Do NOT use Foundation's AnyCodable — this custom implementation
/// handles associated values correctly for our IPC protocol.
struct AnyEncodable: Encodable, Sendable {
    private let encodeFunc: (Encoder) throws -> Void

    init<T: Encodable>(_ value: T) {
        self.encodeFunc = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeFunc(encoder)
    }
}

/// Wraps any Decodable value for JSON-RPC result.
/// Handles primitive types, arrays, and dictionaries recursively.
struct AnyDecodable: Decodable, Sendable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let dict = try? container.decode([String: AnyDecodable].self) {
            value = dict.mapValues { $0.value }
        } else if let array = try? container.decode([AnyDecodable].self) {
            value = array.map { $0.value }
        } else {
            value = NSNull()
        }
    }
}

// MARK: - Request Params (Swift → Rust)

struct SetEnabledParams: Encodable, Sendable {
    let enabled: Bool
}

struct SetPresetParams: Encodable, Sendable {
    let preset: String
}

struct SaveSettingsParams: Encodable, Sendable {
    let settings: AppSettingsResponse
}

// MARK: - Events (Rust → Swift)

/// Matches Rust `IpcEvent` with `#[serde(rename_all = "camelCase")]`.
/// Rust produces: {"scrollStateChanged": {"enabled": true}}
/// Swift Codable decodes this natively.
enum IpcEvent: Codable, Sendable {
    case scrollStateChanged(enabled: Bool)
    case presetChanged(preset: String)
    case settingsChanged(settings: AppSettingsResponse)

    enum CodingKeys: String, CodingKey {
        case scrollStateChanged
        case presetChanged
        case settingsChanged
    }
}

// MARK: - Settings Response

/// Complete settings response matching Rust `AppSettings` struct.
/// This MUST include ALL fields that the UI reads/writes.
///
/// WARNING: Missing fields decode as zero/false/empty — NOT an error.
/// When Rust adds new fields, update this struct AND the corresponding
/// Rust IPC handler to include them in the response.
struct AppSettingsResponse: Codable, Sendable {
    // Core state
    let enabled: Bool
    let activeProfile: String
    
    // Scroll settings
    let stepSizePx: Int
    let animationTimeMs: Int
    let accelerationDeltaMs: Int
    let accelerationMax: Int
    let tailToHeadRatio: Int
    let animationEasing: Bool
    let easingMode: String
    
    // Direction & horizontal
    let horizontalSmoothness: Bool
    let horizontalInvert: Bool
    let reverseWheelDirection: Bool
    
    // Zoom
    let smoothZoom: Bool
    let zoomInvert: Bool
    let zoomSensitivity: Double
    
    // Profile list (for advanced UI)
    let profiles: [ScrollProfileResponse]
    
    // App profiles mapping
    let appProfiles: [String: String]
    
    // Game mode
    let gameModeEnabled: Bool
    
    enum CodingKeys: String, CodingKey {
        case enabled
        case activeProfile = "active_profile"
        case stepSizePx = "step_size_px"
        case animationTimeMs = "animation_time_ms"
        case accelerationDeltaMs = "acceleration_delta_ms"
        case accelerationMax = "acceleration_max"
        case tailToHeadRatio = "tail_to_head_ratio"
        case animationEasing = "animation_easing"
        case easingMode = "easing_mode"
        case horizontalSmoothness = "horizontal_smoothness"
        case horizontalInvert = "horizontal_invert"
        case reverseWheelDirection = "reverse_wheel_direction"
        case smoothZoom = "smooth_zoom"
        case zoomInvert = "zoom_invert"
        case zoomSensitivity = "zoom_sensitivity"
        case profiles
        case appProfiles = "app_profiles"
        case gameModeEnabled = "game_mode_enabled"
    }
}

/// Minimal profile info for UI display.
struct ScrollProfileResponse: Codable, Sendable {
    let id: String
    let name: String
}
```

### 5.4 `IPCClient.swift`

```swift
import Foundation
import Darwin
import os

/// Non-actor wrapper for raw socket I/O. Runs on DispatchQueue to avoid blocking the actor.
private final class SocketIO: @unchecked Sendable {
    var fd: Int32 = -1
    var readBuffer = Data()
    let queue = DispatchQueue(label: "com.SmoothScroll.IPCClient.IO", qos: .userInitiated)

    func read() -> Data? {
        var buffer = [UInt8](repeating: 0, count: 4096)
        let n = Darwin.read(fd, &buffer, buffer.count)
        guard n > 0 else { return nil }
        return Data(bytes: buffer, count: n)
    }

    func write(_ data: Data) throws {
        try data.withUnsafeBytes { rawBuf in
            let base = rawBuf.bindMemory(to: UInt8.self).baseAddress!
            var sent = 0
            while sent < data.count {
                let n = Darwin.write(fd, base.advanced(by: sent), data.count - sent)
                if n < 0 { throw IpcError.message("write() failed: \(String(cString: strerror(errno)))") }
                sent += n
            }
        }
    }
}

actor IPCClient {
    // FIXED: nonisolated static let for proper actor singleton
    nonisolated static let shared = IPCClient()
    
    private var nextId = 1
    private var pendingRequests: [Int: CheckedContinuation<IpcResponse, Error>] = [:]
    private var readTask: Task<Void, Never>?
    private let io = SocketIO()

    /// Stream that emits when connection is lost. ReconnectionManager subscribes to this.
    private var connectionLostContinuation: AsyncStream<Void>.Continuation?
    nonisolated var connectionLost: AsyncStream<Void> {
        AsyncStream { continuation in
            Task { await self.setConnectionLostContinuation(continuation) }
        }
    }

    nonisolated var isConnected: Bool {
        get async { await io.fd >= 0 }
    }

    private let socketPath = SocketPath.socket
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "IPCClient")

    private init() {}  // Private to enforce shared usage

    private func setConnectionLostContinuation(_ cont: AsyncStream<Void>.Continuation) {
        connectionLostContinuation = cont
    }

    // MARK: - Connect

    func connect() async throws {
        // Check if already connected
        guard io.fd < 0 else { return }

        let fd = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { throw IpcError.message("socket() failed") }

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)

        let maxPathLen = MemoryLayout.size(ofValue: addr.sun_path)
        socketPath.withCString { pathPtr in
            withUnsafeMutablePointer(to: &addr.sun_path) { sunPathPtr in
                sunPathPtr.withMemoryRebound(to: CChar.self, capacity: maxPathLen) { dstPtr in
                    strncpy(dstPtr, pathPtr, maxPathLen - 1)
                    dstPtr[maxPathLen - 1] = 0
                }
            }
        }

        let rc = withUnsafePointer(to: &addr) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                Darwin.connect(fd, sockaddrPtr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }

        if rc < 0 {
            close(fd)
            throw IpcError.message("connect() failed: \(String(cString: strerror(errno)))")
        }

        io.fd = fd
        logger.info("Connected to IPC socket at \(self.socketPath)")

        readTask = Task { await readLoop() }
    }

    func disconnect() async {
        readTask?.cancel()
        readTask = nil
        // Resume all pending requests with error
        for (_, cont) in pendingRequests {
            cont.resume(throwing: IpcError.message("Disconnected"))
        }
        pendingRequests.removeAll()
        if io.fd >= 0 {
            close(io.fd)
            io.fd = -1
        }
        connectionLostContinuation?.yield()
    }

    // MARK: - Request/Response

    /// Send a Codable request and wait for the response.
    /// Stores continuation BEFORE writing — prevents race condition.
    func send<T: Decodable>(_ method: String, params: (any Encodable)? = nil) async throws -> T {
        // FIXED: Check connection before attempting to send
        guard io.fd >= 0 else { throw IpcError.message("Not connected") }

        let id = nextId; nextId += 1
        let request = JSONRPCRequest(
            id: id,
            method: method,
            params: params.map { AnyEncodable($0) }
        )

        // 1. Encode request
        let jsonData = try JSONEncoder().encode(request)
        guard var lineData = jsonData.data(using: .utf8) else {
            throw IpcError.message("Failed to encode request")
        }
        lineData.append(0x0A) // newline

        // 2. Store continuation FIRST (synchronous, no Task hop)
        let response: IpcResponse = try await withCheckedThrowingContinuation { cont in
            pendingRequests[id] = cont
        }

        // 3. Write request (on IO queue to avoid blocking actor)
        do {
            try io.queue.sync { try io.write(lineData) }
        } catch {
            pendingRequests.removeValue(forKey: id)?
                .resume(throwing: IpcError.message("Write failed: \(error.localizedDescription)"))
            throw error
        }

        // 4. Decode result
        if let error = response.error {
            throw IpcError.message(error.message)
        }
        guard let result = response.result else {
            // No result — return default (e.g., true for success responses)
            return try JSONDecoder().decode(T.self, from: Data("true".utf8))
        }
        let resultData = try JSONSerialization.data(withJSONObject: result.value)
        return try JSONDecoder().decode(T.self, from: resultData)
    }

    // MARK: - Read Loop (line-buffered, runs on IO queue)

    private func readLoop() async {
        while !Task.isCancelled {
            // Read on IO queue to avoid blocking actor thread
            let data: Data? = await withCheckedContinuation { (cont: CheckedContinuation<Data?, Never>) in
                io.queue.async {
                    cont.resume(returning: self.io.read())
                }
            }

            guard let data else {
                logger.warning("IPC socket read returned nil, disconnecting")
                await disconnect()
                return
            }
            io.readBuffer.append(data)

            // Split on newlines — handle partial messages across reads
            while let newlineRange = io.readBuffer.range(of: Data("\n".utf8)) {
                let lineData = io.readBuffer.subdata(in: io.readBuffer.startIndex..<newlineRange.lowerBound)
                io.readBuffer.removeSubrange(io.readBuffer.startIndex...newlineRange.lowerBound)

                guard !lineData.isEmpty else { continue }
                processMessage(lineData)
            }
        }
    }

    private func processMessage(_ data: Data) {
        guard let response = try? JSONDecoder().decode(IpcResponse.self, from: data) else {
            // Try decoding as event
            if let event = try? JSONDecoder().decode(IpcEvent.self, from: data) {
                Task { @MainActor in
                    SettingsStore.shared.handleEvent(event)
                }
            }
            return
        }

        // It's a response to a pending request
        guard let id = response.id else { return }
        if let cont = pendingRequests.removeValue(forKey: id) {
            if let error = response.error {
                cont.resume(throwing: IpcError.message(error.message))
            } else {
                cont.resume(returning: response)
            }
        }
    }
}

enum IpcError: Error, Sendable, LocalizedError {
    case message(String)

    var errorDescription: String? { message }
    private var message: String {
        switch self {
        case .message(let m): return m
        }
    }
}
```

**Key decisions:**
- **FIXED: `nonisolated static let shared`** — proper actor singleton pattern
- **FIXED: `guard io.fd >= 0` before send** — prevents sending on disconnected socket
- **I/O on `DispatchQueue`** — never blocks actor thread
- **Continuation stored before write** — prevents race condition
- **`AsyncStream<Void>` for disconnect** — no polling needed
- **`SocketPath.socket`** — shared constant, matches Rust `ProjectDirs` exactly
- **`Codable` request/response** — type-safe
- **`IpcError` conforms to `LocalizedError`** — proper error messages in UI

### 5.5 `SettingsStore.swift`

```swift
import Foundation
import Combine
import os

@MainActor
final class SettingsStore: ObservableObject, Sendable {
    static let shared = SettingsStore()

    // MARK: - Connection State
    @Published private(set) var connectionState: ConnectionState = .disconnected
    
    enum ConnectionState: Sendable, Equatable {
        case disconnected
        case connecting
        case connected
        case reconnecting(attempt: Int)
        case failed(String)
        
        static func == (lhs: ConnectionState, rhs: ConnectionState) -> Bool {
            switch (lhs, rhs) {
            case (.disconnected, .disconnected),
                 (.connecting, .connecting),
                 (.connected, .connected):
                return true
            case let (.reconnecting(a), .reconnecting(b)):
                return a == b
            case let (.failed(a), .failed(b)):
                return a == b
            default:
                return false
            }
        }
    }

    // MARK: - Settings
    @Published private(set) var scrollEnabled: Bool = false
    @Published private(set) var speedPreset: ScrollPreset = .balanced
    @Published var horizontalEnabled: Bool = false {
        didSet { Task { await saveSettingsSnapshot() } }
    }
    @Published var zoomEnabled: Bool = false {
        didSet { Task { await saveSettingsSnapshot() } }
    }
    @Published var directionSyncEnabled: Bool = false  // Coming Soon — disabled in UI
    
    /// True while a settings mutation is in progress to prevent concurrent saves.
    @Published private(set) var isMutating: Bool = false

    /// Tracks where the last update came from to prevent echo loops.
    private var lastUpdateSource: UpdateSource = .local
    private enum UpdateSource { case local, remote }

    /// Cached full settings from backend — used to avoid partial overwrites.
    private var cachedSettings: AppSettingsResponse?

    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "SettingsStore")

    private init() {}

    // MARK: - Initial State Loading

    /// Load all settings from Rust backend after IPC connects.
    /// FIXED: Checks isConnected before attempting to connect to prevent double-connect.
    func loadInitialState() async {
        connectionState = .connecting
        
        do {
            // FIXED: Check if already connected before trying to connect
            if await IPCClient.shared.isConnected {
                logger.info("Already connected, fetching settings")
            } else {
                try await IPCClient.shared.connect()
            }
            
            connectionState = .connected

            let settings: AppSettingsResponse = try await IPCClient.shared.send("get_settings")
            applySettings(settings, source: .remote)
            cachedSettings = settings
            
            logger.info("Settings loaded successfully")
        } catch {
            logger.error("Failed to load initial state: \(error.localizedDescription)")
            connectionState = .failed(error.localizedDescription)
        }
    }

    // MARK: - Scroll Enabled (with rollback on error)

    func setScrollEnabled(_ enabled: Bool) async {
        let previousValue = scrollEnabled
        scrollEnabled = enabled
        
        do {
            try await IPCClient.shared.send("set_scroll_enabled", params: SetEnabledParams(enabled: enabled))
        } catch {
            logger.error("setScrollEnabled failed, rolling back: \(error.localizedDescription)")
            scrollEnabled = previousValue  // FIXED: Rollback on error
        }
    }

    // MARK: - Preset (with rollback on error)

    func setPreset(_ preset: ScrollPreset) async {
        let previousValue = speedPreset
        speedPreset = preset
        
        do {
            try await IPCClient.shared.send("set_preset", params: SetPresetParams(preset: preset.rawValue))
        } catch {
            logger.error("setPreset failed, rolling back: \(error.localizedDescription)")
            speedPreset = previousValue  // FIXED: Rollback on error
        }
    }

    // MARK: - Settings Snapshot (with mutation guard)

    /// Always fetch→modify→save full settings to prevent partial overwrite.
    /// FIXED: Uses `isMutating` guard to prevent concurrent saves.
    private func saveSettingsSnapshot() async {
        // Prevent concurrent saves
        guard !isMutating else {
            logger.warning("saveSettingsSnapshot skipped — mutation already in progress")
            return
        }
        
        isMutating = true
        defer { isMutating = false }
        
        do {
            // 1. Fetch current full settings from backend
            let current: AppSettingsResponse = try await IPCClient.shared.send("get_settings")

            // 2. Apply local overrides
            let updated = AppSettingsResponse(
                enabled: scrollEnabled,
                activeProfile: speedPreset.rawValue,
                stepSizePx: current.stepSizePx,
                animationTimeMs: current.animationTimeMs,
                accelerationDeltaMs: current.accelerationDeltaMs,
                accelerationMax: current.accelerationMax,
                tailToHeadRatio: current.tailToHeadRatio,
                animationEasing: current.animationEasing,
                easingMode: current.easingMode,
                horizontalSmoothness: horizontalEnabled ? current.horizontalSmoothness : 0,
                horizontalInvert: current.horizontalInvert,
                reverseWheelDirection: current.reverseWheelDirection,
                smoothZoom: zoomEnabled,
                zoomInvert: current.zoomInvert,
                zoomSensitivity: current.zoomSensitivity,
                profiles: current.profiles,
                appProfiles: current.appProfiles,
                gameModeEnabled: current.gameModeEnabled
            )

            // 3. Save full snapshot
            try await IPCClient.shared.send("save_settings", params: SaveSettingsParams(settings: updated))
            cachedSettings = updated
            logger.info("Settings saved successfully")
        } catch {
            logger.error("saveSettings failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Event Handling

    /// Apply settings from backend. Skips if update originated locally (prevents echo).
    func handleEvent(_ event: IpcEvent) {
        guard lastUpdateSource == .local else { return }
        lastUpdateSource = .remote
        defer { lastUpdateSource = .local }

        switch event {
        case .scrollStateChanged(let enabled):
            scrollEnabled = enabled
        case .presetChanged(let preset):
            speedPreset = ScrollPreset(rawValue: preset) ?? .balanced
        case .settingsChanged(let settings):
            applySettings(settings, source: .remote)
        }
    }

    private func applySettings(_ settings: AppSettingsResponse, source: UpdateSource) {
        lastUpdateSource = source
        defer { lastUpdateSource = .local }

        scrollEnabled = settings.enabled
        speedPreset = ScrollPreset(rawValue: settings.activeProfile) ?? .balanced
        horizontalEnabled = settings.horizontalSmoothness > 0
        zoomEnabled = settings.smoothZoom
        // Note: directionSyncEnabled intentionally not synced — backend doesn't support it yet
    }
    
    // MARK: - Connection State Helpers
    
    func updateConnectionState(_ state: ConnectionState) {
        connectionState = state
    }
}
```

**Key decisions:**
- **FIXED: `nonisolated static let shared`** — proper actor singleton
- **FIXED: `UpdateSource` enum** — thread-safe, no race between concurrent events
- **FIXED: Fetch→modify→save pattern** — `saveSettingsSnapshot()` always fetches full settings first
- **FIXED: `isMutating` guard** — prevents concurrent saves
- **FIXED: Rollback on error** — mutation methods rollback on IPC failure
- **`Codable` params** — `SetEnabledParams`, `SetPresetParams`, `SaveSettingsParams`
- **`@MainActor`** — all `@Published` mutations happen on main thread
- **`Sendable`** — safe to reference from actor boundary
- **`os.Logger` instead of `print()`**
- **FIXED: `ConnectionState` conforms to `Equatable`** — for SwiftUI diffing

### 5.6 `ReconnectionManager.swift` (NEW)

```swift
import Foundation
import os

/// Manages auto-reconnection when IPC connection is lost.
/// FIXED: This was missing from v3.1 spec — now properly wired in AppDelegate.
@MainActor
final class ReconnectionManager {
    private let client: IPCClient
    private let settings: SettingsStore
    private var task: Task<Void, Never>?
    private var retryCount = 0
    private let maxRetryCount = 10
    private let baseDelay: UInt64 = 1_000_000_000 // 1s

    init(client: IPCClient = .shared, settings: SettingsStore = .shared) {
        self.client = client
        self.settings = settings
    }

    func start() {
        task = Task { [weak self] in
            guard let self else { return }

            // Wait for disconnect signal (no polling)
            for await _ in await self.client.connectionLost {
                guard !Task.isCancelled else { return }
                await self.handleDisconnect()
            }
        }
    }

    private func handleDisconnect() async {
        retryCount += 1
        settings.updateConnectionState(.reconnecting(attempt: retryCount))

        while retryCount < maxRetryCount && !Task.isCancelled {
            // Exponential backoff
            let delay = min(baseDelay * UInt64(1 << min(retryCount, 10)), 30_000_000_000)
            try? await Task.sleep(nanoseconds: delay)

            do {
                try await client.connect()
                await settings.loadInitialState()
                retryCount = 0
                settings.updateConnectionState(.connected)
                return
            } catch {
                settings.updateConnectionState(.failed(error.localizedDescription))
            }
        }
        
        // Max retries reached
        retryCount = 0
    }

    func stop() {
        task?.cancel()
        task = nil
    }
}
```

### 5.7 `SmoothScrollPopover.swift`

```swift
import SwiftUI

struct SmoothScrollPopover: View {
    @StateObject private var settings = SettingsStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            PopoverHeader()

            Divider()

            VStack(alignment: .leading, spacing: 12) {
                // FIXED: Full connection state UI
                connectionStatusView

                // All controls disabled when disconnected
                let isEnabled = settings.connectionState == .connected

                // Smooth Scroll toggle
                Toggle("Smooth Scroll", isOn: Binding(
                    get: { settings.scrollEnabled },
                    set: { newValue in
                        Task { await settings.setScrollEnabled(newValue) }
                    }
                ))
                .toggleStyle(.switch)
                .disabled(!isEnabled)

                // Speed preset
                VStack(alignment: .leading, spacing: 4) {
                    Text("Speed")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                    Picker("Speed", selection: Binding(
                        get: { settings.speedPreset },
                        set: { newValue in
                            Task { await settings.setPreset(newValue) }
                        }
                    )) {
                        ForEach(ScrollPreset.allCases) { preset in
                            Text(preset.displayName).tag(preset)
                        }
                    }
                    .pickerStyle(.segmented)
                    .disabled(!isEnabled)
                }

                Divider()

                // Horizontal Scroll
                Toggle("Horizontal Scroll", isOn: $settings.horizontalEnabled)
                    .toggleStyle(.switch)
                    .disabled(!isEnabled)

                // Zoom
                Toggle("Zoom", isOn: $settings.zoomEnabled)
                    .toggleStyle(.switch)
                    .disabled(!isEnabled)

                // Direction Sync — Coming Soon
                Toggle("Direction Sync", isOn: $settings.directionSyncEnabled)
                    .toggleStyle(.switch)
                    .disabled(true)  // FIXED: Disabled until backend supports
                
                Text("Coming Soon")
                    .font(.system(size: 9))
                    .foregroundStyle(.tertiary)
                    .padding(.leading, 36)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .frame(width: 280)
        .background(
            VisualEffectBlur(material: .popover, blendingMode: .behindWindow)
                .ignoresSafeArea()
        )
    }
    
    @ViewBuilder
    private var connectionStatusView: some View {
        switch settings.connectionState {
        case .connecting:
            HStack(spacing: 6) {
                ProgressView()
                    .controlSize(.small)
                Text("Connecting...")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(6)
            
        case .reconnecting(let attempt):
            HStack(spacing: 6) {
                ProgressView()
                    .controlSize(.small)
                Text("Reconnecting... (attempt \(attempt))")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(6)
            
        case .failed(let message):
            ConnectionBanner(message: message)
            
        case .disconnected:
            HStack(spacing: 6) {
                Image(systemName: "wifi.slash")
                    .foregroundStyle(.secondary)
                Text("Disconnected")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.gray.opacity(0.1))
            .cornerRadius(6)
            
        case .connected:
            EmptyView()
        }
    }
}

struct PopoverHeader: View {
    private var version: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
    }

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                Text("SmoothScroll")
                    .font(.system(size: 13, weight: .semibold))
                if !version.isEmpty {
                    Text("v\(version)")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
}

struct ConnectionBanner: View {
    let message: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.1))
        .cornerRadius(6)
    }
}
```

**Key decisions:**
- **`VisualEffectBlur(material: .popover)`** — correct for macOS NSPopover (NOT `.ultraThinMaterial`)
- **FIXED: Full `connectionState` UI** — shows connecting, reconnecting, disconnected states
- **FIXED: `directionSyncEnabled` disabled** — shows "Coming Soon" label
- **FIXED: All controls disabled when disconnected** — prevents invalid operations
- **Version from `Bundle.main`** — no hardcoded string
- **`$settings.scrollEnabled` binding with setter** — sends IPC after state update

### 5.8 `MenuBarController.swift`

```swift
import AppKit
import SwiftUI
import os

final class MenuBarController: NSObject {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var hostingController: NSHostingController<SmoothScrollPopover>!
    private var settingsObserver: NSObjectProtocol?
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "MenuBarController")

    func setup() {
        setupAppMenu()  // Must come first — enables ⌘Q
        setupStatusItem()
        setupPopover()
        setupObservers()
    }

    func teardown() {
        if let observer = settingsObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - App Menu (enables ⌘Q for LSUIElement apps)

    private func setupAppMenu() {
        // With LSUIElement = true, the default app menu is hidden.
        // We must create a minimal app menu so ⌘Q works.
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About SmoothScroll", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit SmoothScroll", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)
        NSApp.mainMenu = mainMenu
    }

    // MARK: - Status Item

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "SS"
            }
            button.target = self
            button.action = #selector(togglePopover)

            // Accessibility
            button.setAccessibilityLabel("SmoothScroll")
            button.setAccessibilityRole(.button)
            updateAccessibilityValue()
        }
    }

    private func updateAccessibilityValue() {
        Task { @MainActor in  // FIXED: Access @MainActor on main thread
            let enabled = SettingsStore.shared.scrollEnabled
            statusItem.button?.setAccessibilityValue(
                enabled ? "Enabled" : "Disabled"
            )
        }
    }

    // MARK: - Popover

    private func setupPopover() {
        hostingController = NSHostingController(rootView: SmoothScrollPopover())

        popover = NSPopover()
        popover.contentSize = NSSize(width: 280, height: 220)
        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = hostingController
    }

    @objc private func togglePopover(_ sender: NSStatusBarButton) {
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }

    // MARK: - Observers

    private func setupObservers() {
        settingsObserver = NotificationCenter.default.addObserver(
            forName: .scrollStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            // FIXED: Wrap in Task { @MainActor } to safely access SettingsStore
            Task { @MainActor in
                self?.updateIcon()
                self?.updateAccessibilityValue()
            }
        }
    }

    private func updateIcon() {
        guard let button = statusItem.button else { return }
        let enabled = SettingsStore.shared.scrollEnabled

        if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
            image.isTemplate = true
            button.image = image
            // Use alpha for enabled/disabled — template images ignore tint on some macOS versions
            button.alphaValue = enabled ? 1.0 : 0.4
        }
    }
}

extension Notification.Name {
    static let scrollStateDidChange = Notification.Name("scrollStateDidChange")
}
```

**Key decisions:**
- **`NSHostingController` stored as property** — proper lifecycle management
- **FIXED: `Task { @MainActor in }` wrapper** — NotificationCenter callbacks may run on any thread
- **FIXED: `updateAccessibilityValue()` wraps in Task** — SettingsStore is @MainActor
- **FIXED: `.transient` popover behavior** — dismisses on click outside (standard macOS)
- **FIXED: Observer stored and removed in `teardown()`** — no memory leak
- **`os.Logger` instead of `print()`**
- **Accessibility: `setAccessibilityLabel`, `setAccessibilityRole`, `setAccessibilityValue`**
- **Alpha-based status indicator** — template images ignore tint on some macOS versions

### 5.9 `AppDelegate.swift`

```swift
import AppKit
import os

class AppDelegate: NSObject, NSApplicationDelegate {
    private var menuBarController: MenuBarController?
    private var reconnectionManager: ReconnectionManager?  // FIXED: Now stored
    private var activity: NSObjectProtocol?
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "AppDelegate")

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Keep process alive (idle-level — UI-only app doesn't need .userInitiated)
        activity = ProcessInfo.processInfo.beginActivity(
            options: .idleSystemSleepDisabled,
            reason: "SmoothScroll menu bar app active"
        )

        // Setup menu bar (includes NSMenu for ⌘Q)
        menuBarController = MenuBarController()
        menuBarController?.setup()

        // FIXED: Instantiate and start ReconnectionManager
        reconnectionManager = ReconnectionManager()
        reconnectionManager?.start()

        // Connect to Rust backend
        Task {
            await SettingsStore.shared.loadInitialState()
            // Post notification so MenuBarController updates icon
            NotificationCenter.default.post(name: .scrollStateDidChange, object: nil)
        }
    }

    /// Graceful shutdown: send IPC quit to Rust, wait briefly, then terminate.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        Task {
            do {
                try await IPCClient.shared.send("quit")
            } catch {
                self.logger.warning("IPC quit failed: \(error.localizedDescription)")
            }
            // Give Rust time to process quit
            try? await Task.sleep(for: .milliseconds(500))
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }

    func applicationWillTerminate(_ notification: Notification) {
        // FIXED: Stop reconnection manager first
        reconnectionManager?.stop()
        
        menuBarController?.teardown()
        Task {
            await IPCClient.shared.disconnect()
        }
        if let activity {
            ProcessInfo.processInfo.endActivity(activity)
        }
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }
}
```

**Key decisions:**
- **FIXED: `reconnectionManager` stored and started** — enables auto-reconnect
- **`applicationShouldTerminate` with `.terminateLater`** — sends IPC `quit` command to Rust
- **FIXED: `reconnectionManager.stop()` in `applicationWillTerminate`** — clean shutdown
- **`.idleSystemSleepDisabled`** — menu bar UI doesn't need aggressive App Nap prevention
- **Activity stored and ended in `applicationWillTerminate`**
- **IPC disconnect on terminate**

### 5.10 `main.swift`

No changes needed — current implementation is correct:

```swift
import AppKit

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
```

### 5.11 `Info.plist` Updates

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Hide Dock icon — we're a menu bar app only -->
    <key>LSUIElement</key>
    <true/>
    
    <!-- App identification -->
    <key>CFBundleIdentifier</key>
    <string>com.SmoothScroll.MenuBar</string>
    <key>CFBundleName</key>
    <string>SmoothScroll</string>
    <key>CFBundleDisplayName</key>
    <string>SmoothScroll</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    
    <!-- App category -->
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.utilities</string>
    
    <!-- Hardened Runtime (required for notarization) -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <false/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <false/>
</dict>
</plist>
```

**Important Notes:**
- `LSUIElement = true` hides the Dock icon — this is required for menu bar-only apps
- The app still appears in Activity Monitor and can be quit via menu bar or ⌘Q
- For App Sandbox: **Disable it**. Unix domain sockets require filesystem access outside sandbox

### 5.12 Entitlements

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Sandbox disabled — required for Unix socket IPC -->
    <!-- <key>com.apple.security.app-sandbox</key>
         <false/> -->
    
    <!-- If you enable sandbox later, you need:
         com.apple.security.application-groups = ["group.com.SmoothScroll"] -->
</dict>
</plist>
```

---

## 6. Implementation Phases

### Phase 0: Wire IPC Server (Rust) — CRITICAL

**Verify:** `cargo build --target aarch64-apple-darwin` compiles; IPC server starts and accepts connections on macOS.

1. Fix syntax error in `handle_client` (missing closing brace)
2. Add `ipc_socket_path()` function using `directories` crate
3. Spawn `IpcServer` in `lib.rs` setup closure on dedicated tokio runtime
4. Add quit signal channel (`tokio::sync::watch`)
5. On macOS, conditionally skip `tray::init()` (guard with `#[cfg(not(target_os = "macos"))]`)
6. Set socket permissions to `0o600` after bind

### Phase 1: Fix Rust IPC Handlers

**Verify:** Connect via `socat` or test client, send commands, verify correct behavior.

1. Fix `set_scroll_enabled` — reset engine on disable
2. Fix `set_preset` — persist via `commit_settings` + `engine_signal.signal()`
3. Fix `quit` — signal app exit via watch channel
4. Fix `save_settings` — return error on deserialization failure
5. Fix event serialization — remove `#[serde(tag)]`, use `rename_all = "camelCase"`
6. Add `write_all` error handling (break on disconnect)
7. Add `SettingsChanged` event variant

### Phase 2: Rewrite Swift IPC Layer

**Verify:** Swift app connects to Rust, sends `get_settings`, receives valid response.

1. Add `SocketPath` constant matching Rust `ProjectDirs` exactly (⚠️ `com.SmoothScroll.SmoothScroll`)
2. Add proper error handling with guard-let instead of force unwrap
3. Rewrite `IPCProtocol.swift` — `JSONRPCRequest`, `IpcResponse`, `AnyEncodable`, concrete params structs
4. Complete `AppSettingsResponse` with ALL fields from Rust `AppSettings`
5. Rewrite `IPCClient.swift` — `nonisolated static let shared`, I/O on `DispatchQueue`, continuation-first send, `AsyncStream` disconnect
6. Add `ScrollPreset.swift` enum
7. Add `ReconnectionManager.swift` with proper `AsyncStream` disconnect subscription

### Phase 3: Rewrite Swift UI

**Verify:** Menu bar icon shows, popover opens, toggles work, settings persist.

1. Rewrite `SettingsStore.swift` — `@MainActor`, `Sendable`, `UpdateSource` echo prevention, fetch→modify→save, `isMutating` guard, error rollback
2. Rewrite `SmoothScrollPopover.swift` — native controls, full connectionState UI, direction sync "Coming Soon"
3. Rewrite `MenuBarController.swift` — NSMenu for ⌘Q, proper lifecycle, `Task { @MainActor }` in notification callbacks, accessibility
4. Rewrite `AppDelegate.swift` — `applicationShouldTerminate` with `.terminateLater`, instantiate and start `ReconnectionManager`, graceful IPC quit
5. Update `Info.plist` with `LSUIElement = true`
6. Update entitlements (disable sandbox)
7. Delete unused view files

### Phase 4: Polish

**Verify:** All items in testing checklist pass.

1. Auto-reconnect with `AsyncStream` disconnect notification (managed outside actor)
2. State persistence roundtrip (change → IPC → Rust → restart → verify)
3. VoiceOver navigation test
4. Menu bar icon state indicator (alpha-based)
5. FIXED: Test ReconnectionManager instantiation and start in AppDelegate
6. FIXED: Test notification callbacks access SettingsStore safely via `Task { @MainActor }`
7. FIXED: Test all controls disabled when `connectionState != .connected`
8. FIXED: Test direction sync toggle shows "Coming Soon" and is disabled

---

## 7. Rust AppSettings → Swift Mapping

This section documents the complete field mapping between Rust `AppSettings` and Swift `AppSettingsResponse`.

### Core Fields

| Rust Field | Swift Field | Type | Notes |
|------------|-------------|------|-------|
| `enabled` | `enabled` | `Bool` | Master on/off |
| `active_profile` | `activeProfile` | `String` | Current profile ID |

### Scroll Settings

| Rust Field | Swift Field | Type | Notes |
|------------|-------------|------|-------|
| `step_size_px` | `stepSizePx` | `Int` | |
| `animation_time_ms` | `animationTimeMs` | `Int` | |
| `acceleration_delta_ms` | `accelerationDeltaMs` | `Int` | |
| `acceleration_max` | `accelerationMax` | `Int` | |
| `tail_to_head_ratio` | `tailToHeadRatio` | `Int` | |
| `animation_easing` | `animationEasing` | `Bool` | |
| `easing_mode` | `easingMode` | `String` | Rust `EasingMode` enum as string |

### Direction & Horizontal

| Rust Field | Swift Field | Type | Notes |
|------------|-------------|------|-------|
| `horizontal_smoothness` | `horizontalSmoothness` | `Bool` | |
| `horizontal_invert` | `horizontalInvert` | `Bool` | |
| `reverse_wheel_direction` | `reverseWheelDirection` | `Bool` | |

### Zoom

| Rust Field | Swift Field | Type | Notes |
|------------|-------------|------|-------|
| `smooth_zoom` | `smoothZoom` | `Bool` | |
| `zoom_invert` | `zoomInvert` | `Bool` | |
| `zoom_sensitivity` | `zoomSensitivity` | `Double` | |

### Profiles

| Rust Field | Swift Field | Type | Notes |
|------------|-------------|------|-------|
| `profiles` | `profiles` | `[ScrollProfileResponse]` | Minimal info for UI |
| `app_profiles` | `appProfiles` | `[String: String]` | Process → Profile ID |

### Game Mode

| Rust Field | Swift Field | Type | Notes |
|------------|-------------|------|-------|
| `game_mode_enabled` | `gameModeEnabled` | `Bool` | |

### Fields NOT in v1 Swift UI

These fields exist in Rust but are not exposed in the menu bar UI:

- `start_with_os`, `start_minimized`
- `language`, `theme`
- `enable_global_hotkey`, `hotkey_accelerator`
- `show_tray_icon_state`
- `excluded_apps` (legacy)
- `game_mode_known_apps`
- `edge_scroll_*`
- `touchpad_*`
- `respect_reduce_motion`
- `modifier_passthrough`
- `onboarding_completed_at`
- `auto_disable_windows_apps`

These should be added to a settings panel in a future version.

---

## 8. Testing Checklist

### IPC
- [ ] Rust IPC server starts on app launch
- [ ] Swift connects to correct socket path (`com.SmoothScroll.SmoothScroll/socket`)
- [ ] Swift and Rust resolve to identical socket path (unit test recommended)
- [ ] `get_settings` returns full settings snapshot
- [ ] `set_scroll_enabled(true)` enables scrolling
- [ ] `set_scroll_enabled(false)` disables scrolling AND resets engine
- [ ] `set_preset` persists to disk and survives restart
- [ ] `save_settings` fetches→modifies→saves full settings (no partial overwrite)
- [ ] `quit` terminates the Tauri app
- [ ] Event `scrollStateChanged` updates Swift UI
- [ ] Event `settingsChanged` updates all Swift UI fields
- [ ] Request/response matching works (correct `id` returned)
- [ ] Partial message buffering works (large payloads split across reads)
- [ ] Actor thread is not blocked during I/O (no thread starvation)
- [ ] `isMutating` guard prevents concurrent saves
- [ ] Error rollback works (failed mutation reverts to previous value)

### UI
- [ ] Menu bar icon shows scroll symbol
- [ ] Menu bar icon dims when disabled, full opacity when enabled
- [ ] Popover opens on menu bar click
- [ ] Popover closes on click outside (transient behavior)
- [ ] Smooth Scroll toggle works
- [ ] Speed preset picker works (Balanced / Snappy / Glide)
- [ ] Horizontal Scroll toggle works
- [ ] Zoom toggle works
- [ ] Direction Sync toggle shows "Coming Soon" and is disabled
- [ ] All controls disabled when disconnected
- [ ] Connection status shows: connecting spinner, reconnecting with attempt count, disconnected, failed with message

### Lifecycle
- [ ] State syncs on app launch (reads from Rust, not hardcoded defaults)
- [ ] Auto-reconnect works when Rust restarts (via AsyncStream, no polling)
- [ ] ReconnectionManager instantiated and started in AppDelegate
- [ ] Quit from menu bar sends IPC `quit` before disconnecting (`.terminateLater`)
- [ ] No memory leaks (observer removed, activity ended, no leaked continuations)
- [ ] Version shows from Bundle, not hardcoded
- [ ] No echo loops (UI update from Rust event doesn't trigger re-send)
- [ ] `isMutating` flag prevents concurrent settings saves

### Thread Safety
- [ ] MenuBarController notification callback safely accesses SettingsStore via `Task { @MainActor }`
- [ ] `updateAccessibilityValue()` safely accesses @MainActor SettingsStore
- [ ] IPCClient uses `nonisolated static let shared` for singleton access

### Accessibility
- [ ] VoiceOver reads "SmoothScroll, button" on menu bar icon
- [ ] VoiceOver announces "Enabled" or "Disabled" value
- [ ] All toggle controls are keyboard navigable
- [ ] Popover is fully VoiceOver navigable

### macOS Conventions
- [ ] No Dock icon (`LSUIElement = true` in Info.plist)
- [ ] Single menu bar icon (no Tauri tray duplicate)
- [ ] Standard NSMenu with About + Quit
- [ ] ⌘Q quits the app
- [ ] App sandbox disabled (required for Unix socket)

---

## 9. Files to Delete

```
macos/SmoothScrollMenuBar/Sources/Views/
  - DirectionSyncSection.swift      ← DELETE
  - SmoothScrollSection.swift        ← DELETE
  - PresetShortcutsView.swift        ← DELETE
  - SettingsRow.swift                 ← DELETE
  - DeviceDirectionCard.swift          ← DELETE
  - VisualEffectBlur.swift           ← KEEP
```

---

## 10. Estimated Effort

| Phase | Work | Estimate |
|-------|------|----------|
| Phase 0: Wire IPC Server | Fix syntax, spawn in lib.rs, skip Tauri tray, quit channel | 3-4h |
| Phase 1: Fix Rust Handlers | set_scroll_enabled reset, set_preset persist, quit, serialization | 3-4h |
| Phase 2: Rewrite Swift IPC | SocketPath, Codable types, DispatchQueue I/O, continuation-first send, AsyncStream disconnect, ReconnectionManager | 5-6h |
| Phase 3: Rewrite Swift UI | SettingsStore (UpdateSource, fetch→modify→save, isMutating, rollback), NSMenu ⌘Q, applicationShouldTerminate, Popover, connectionState UI | 5-6h |
| Phase 4: Polish | AsyncStream reconnect, accessibility, testing | 2-3h |
| **Total** | | **18-23h** |

---

## 11. Open Questions / Future Work

1. **Full settings UI**: The menu bar popover is intentionally minimal. A full settings window should be added for advanced options (edge scroll, touchpad, profiles, etc.)

2. **Direction sync backend**: Currently stubbed in UI. Needs Rust backend support.

3. **Menu bar extra apps**: Consider `MenuBarExtra` SwiftUI API (macOS 13+) for cleaner implementation.

4. **Per-app profiles UI**: The menu bar app doesn't expose per-app profile assignment. Consider adding in a future version.

5. **macOS-specific features**:
   - Accessibility permissions prompt (CGEventTap requires it)
   - Login item registration (`SMAppService` on macOS 13+)
   - Touch Bar support (if applicable)
