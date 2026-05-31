import Foundation

actor IPCClient {
    static let shared = IPCClient()

    private var socket: UnixSocketConnection?
    private var isConnected = false
    private var nextId = 1

    private let socketPath: String

    private init() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        self.socketPath = "\(home)/.smoothscroll/socket"
    }

    func connect() async throws {
        guard !isConnected else { return }

        let connection = UnixSocketConnection(path: socketPath)
        try await connection.connect()
        self.socket = connection
        self.isConnected = true

        // Start reading responses and events.
        Task {
            await readLoop()
        }
    }

    func disconnect() async throws {
        isConnected = false
        socket = nil
    }

    private func readLoop() async {
        guard let socket = socket else { return }

        while isConnected {
            do {
                let line = try await socket.readLine()
                guard let data = line.data(using: .utf8) else { continue }

                // Try to decode as event first.
                if let event = try? JSONDecoder().decode(IpcEvent.self, from: data) {
                    await handleEvent(event)
                }
            } catch {
                isConnected = false
                break
            }
        }
    }

    private func handleEvent(_ event: IpcEvent) async {
        await MainActor.run {
            switch event {
            case .scrollStateChanged(let enabled):
                SettingsStore.shared.scrollEnabled = enabled
            case .directionSyncChanged(let enabled):
                SettingsStore.shared.directionSyncEnabled = enabled
            case .presetChanged(let preset):
                SettingsStore.shared.speedPreset = preset
            }
        }
    }

    private func send<T: Decodable>(_ request: IpcRequest) async throws -> T {
        guard let socket = socket else {
            throw IpcError(message: "Not connected")
        }

        let id = nextId
        nextId += 1

        let (method, params) = requestToMethodAndParams(request)
        let message = IpcRequestMessage(id: id, method: method, params: params)
        let data = try JSONEncoder().encode(message)
        let line = String(data: data, encoding: .utf8)! + "\n"

        try await socket.write(line)

        // For simplicity, events are handled in the read loop.
        // This is a simplified client — a full implementation would use
        // a dictionary of pending requests keyed by id.
        throw IpcError(message: "Request/response not implemented — use events for state sync")
    }

    private func requestToMethodAndParams(_ request: IpcRequest) -> (String, [String: AnyCodable]?) {
        switch request {
        case .getScrollEnabled:
            return ("get_scroll_enabled", nil)
        case .setScrollEnabled(let enabled):
            return ("set_scroll_enabled", ["enabled": AnyCodable(enabled)])
        case .getDirectionSyncEnabled:
            return ("get_direction_sync_enabled", nil)
        case .setDirectionSyncEnabled(let enabled):
            return ("set_direction_sync_enabled", ["enabled": AnyCodable(enabled)])
        case .getPreset:
            return ("get_preset", nil)
        case .setPreset(let preset):
            return ("set_preset", ["preset": AnyCodable(preset)])
        case .quit:
            return ("quit", nil)
        default:
            return ("unknown", nil)
        }
    }

    // MARK: - Convenience Methods

    func setScrollEnabled(_ enabled: Bool) async throws {
        guard isConnected else { return }
        let _ = try await socket?.write("{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_scroll_enabled\",\"params\":{\"enabled\":\(enabled)}}\n")
        nextId += 1
    }

    func setDirectionSyncEnabled(_ enabled: Bool) async throws {
        guard isConnected else { return }
        let _ = try await socket?.write("{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_direction_sync_enabled\",\"params\":{\"enabled\":\(enabled)}}\n")
        nextId += 1
    }

    func setPreset(_ preset: String) async throws {
        guard isConnected else { return }
        let _ = try await socket?.write("{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_preset\",\"params\":{\"preset\":\"\(preset)\"}}\n")
        nextId += 1
    }
}

// MARK: - Unix Socket Connection

class UnixSocketConnection {
    let path: String
    private var stream: FileHandle?

    init(path: String) {
        self.path = path
    }

    func connect() async throws {
        // Use a pipe approach: connect to the Unix socket.
        let url = URL(fileURLWithPath: path)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var readHandle: FileHandle?
            var writeHandle: FileHandle?

            // On macOS, use CFSocket/URLSession for Unix domain sockets.
            // For simplicity, we use a Task to handle the connection.
            Task {
                do {
                    let (r, w) = try await Darwin.connectToUnixSocket(path: self.path)
                    self.stream = r
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func write(_ data: String) async throws {
        guard let stream = stream else { throw IpcError(message: "Not connected") }
        try await stream.write(contentsOf: data.data(using: .utf8)!)
    }

    func readLine() async throws -> String {
        guard let stream = stream else { throw IpcError(message: "Not connected") }
        return try await stream.readLine()
    }
}

struct IpcError: Error {
    let message: String
}
