# SmoothScroll macOS — Plan 2: Swift IPC Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Swift-side IPC layer: SocketPath constant, JSON-RPC protocol types, actor-based IPC client with DispatchQueue I/O, and auto-reconnection manager.

**Architecture:** The IPC layer uses a Unix domain socket with newline-delimited JSON-RPC 2.0. Raw I/O runs on a dedicated `DispatchQueue` to avoid blocking the actor thread. The `IPCClient` actor provides a clean async/await API. `ReconnectionManager` subscribes to disconnect events via `AsyncStream` and handles exponential backoff reconnection.

**Tech Stack:** Swift 5.9+, Darwin (POSIX), os.log

---

## File Structure

```
macos/SmoothScrollMenuBar/Sources/IPC/
├── SocketPath.swift       (NEW)  Shared socket path constant
├── IPCProtocol.swift      (NEW)  JSON-RPC types, AnyEncodable/Decodable, IpcEvent
├── IPCClient.swift        (NEW)  Actor-based socket client
└── ReconnectionManager.swift  (NEW)  Auto-reconnect with AsyncStream
```

---

## Task 1: Create SocketPath.swift

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/IPC/SocketPath.swift`

Defines the socket path constant that MUST match Rust's `ipc_socket_path()` function.

- [ ] **Step 1: Create the file with defensive path resolution**

```swift
import Foundation

/// Shared socket path for IPC communication.
/// MUST match Rust `ipc_socket_path()` which uses:
/// `ProjectDirs::from("com", "SmoothScroll", "SmoothScroll").data_dir().join("socket")`
///
/// On macOS, this produces:
/// `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket`
///
/// ⚠️ The directory name is `com.SmoothScroll.SmoothScroll` — NOT just `SmoothScroll`.
enum SocketPath {
    static let socket: String = {
        // Use guard-let instead of force unwrap for defensive coding
        guard let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            // Fallback: use temporary directory if Application Support unavailable
            // This should rarely happen on macOS
            let tempPath = NSTemporaryDirectory() + "com.SmoothScroll.SmoothScroll/socket"
            try? FileManager.default.createDirectory(
                atPath: tempPath,
                withIntermediateDirectories: true,
                attributes: nil
            )
            return tempPath
        }
        
        let socketDir = appSupport
            .appendingPathComponent("com.SmoothScroll.SmoothScroll")
            .appendingPathComponent("socket")
        
        // Ensure directory exists before returning
        try? FileManager.default.createDirectory(
            at: socketDir,
            withIntermediateDirectories: true,
            attributes: nil
        )
        
        return socketDir.path
    }()
}
```

- [ ] **Step 2: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/IPC/SocketPath.swift` (or build via Xcode)
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/IPC/SocketPath.swift
git commit -m "feat(macos-ipc): add SocketPath constant with defensive path resolution"
```

---

## Task 2: Create IPCProtocol.swift

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift`

Defines JSON-RPC 2.0 wire types, type-erased Codable wrappers, request params, and event enums.

- [ ] **Step 1: Create the file with all protocol types**

```swift
import Foundation

// MARK: - JSON-RPC Wire Types

/// JSON-RPC 2.0 request envelope.
/// `jsonrpc` is a constant string — Swift infers as `String`.
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
    
    // Profile list
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

- [ ] **Step 2: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift
git commit -m "feat(macos-ipc): add JSON-RPC protocol types and AppSettingsResponse"
```

---

## Task 3: Create SocketIO Helper

**Files:**
- Modify: `macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift`

The `SocketIO` class wraps raw POSIX socket I/O on a dedicated `DispatchQueue` to avoid blocking the actor thread.

- [ ] **Step 1: Add SocketIO class before the IPCClient actor**

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
                if n < 0 {
                    throw IpcError.message("write() failed: \(String(cString: strerror(errno)))")
                }
                sent += n
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

- [ ] **Step 2: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift
git commit -m "feat(macos-ipc): add SocketIO wrapper for POSIX I/O on DispatchQueue"
```

---

## Task 4: Create IPCClient Actor

**Files:**
- Modify: `macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift`

The `IPCClient` actor provides the async/await API for IPC communication. Key design decisions:
- Uses `nonisolated static let shared` for proper actor singleton
- Stores continuation BEFORE writing to prevent race condition
- Uses `AsyncStream<Void>` for disconnect notification (no polling)

- [ ] **Step 1: Add IPCClient actor with connect/disconnect**

Add after SocketIO class:

```swift
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
```

- [ ] **Step 2: Add send method with continuation-first pattern**

```swift
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
```

- [ ] **Step 3: Add readLoop and processMessage**

```swift
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
```

- [ ] **Step 4: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift`
Expected: No syntax errors

- [ ] **Step 5: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift
git commit -m "feat(macos-ipc): implement IPCClient actor with DispatchQueue I/O"
```

---

## Task 5: Create ReconnectionManager.swift

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/IPC/ReconnectionManager.swift`

Manages auto-reconnection using `AsyncStream<Void>` from `IPCClient.connectionLost` (no polling).

- [ ] **Step 1: Create the file**

```swift
import Foundation
import os

/// Manages auto-reconnection when IPC connection is lost.
/// Uses AsyncStream from IPCClient.connectionLost — no polling needed.
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

- [ ] **Step 2: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/IPC/ReconnectionManager.swift`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/IPC/ReconnectionManager.swift
git commit -m "feat(macos-ipc): add ReconnectionManager with AsyncStream reconnect"
```

---

## Verification

After completing all tasks:

1. **Compilation:** All Swift files compile without errors
2. **Socket path:** `SocketPath.socket` matches Rust path `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket`
3. **Actor singleton:** `IPCClient.shared` uses `nonisolated static let` pattern
4. **Continuation-first:** `send()` stores continuation before writing to socket
5. **AsyncStream disconnect:** `ReconnectionManager` subscribes to `connectionLost` without polling
