import Foundation
import Darwin

actor IPCClient {
    static let shared = IPCClient()

    private var socketFd: Int32 = -1
    private var isConnected = false
    private var nextId = 1

    private let socketPath: String

    private init() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        self.socketPath = "\(home)/.smoothscroll/socket"
    }

    func connect() async throws {
        guard !isConnected else { return }

        let fd = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { throw IpcError(message: "socket() failed") }

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
            throw IpcError(message: "connect() failed: \(String(cString: strerror(errno)))")
        }

        self.socketFd = fd
        self.isConnected = true

        Task {
            await readLoop()
        }
    }

    func disconnect() async throws {
        isConnected = false
        if socketFd >= 0 {
            close(socketFd)
            socketFd = -1
        }
    }

    private func readLoop() async {
        guard socketFd >= 0 else { return }

        while isConnected {
            var buffer = [CChar](repeating: 0, count: 4096)
            let n = read(socketFd, &buffer, buffer.count)
            if n <= 0 {
                isConnected = false
                break
            }
            let line = String(decoding: buffer[0..<n], as: UTF8.self)
            if let data = line.data(using: .utf8),
               let event = try? JSONDecoder().decode(IpcEvent.self, from: data) {
                await handleEvent(event)
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
        guard socketFd >= 0 else {
            throw IpcError(message: "Not connected")
        }

        let id = nextId
        nextId += 1

        let (method, params) = requestToMethodAndParams(request)
        let message = IpcRequestMessage(id: id, method: method, params: params)
        let data = try JSONEncoder().encode(message)
        let line = String(data: data, encoding: .utf8)! + "\n"

        try writeLine(line)

        throw IpcError(message: "Request/response not implemented — use events for state sync")
    }

    private func writeLine(_ line: String) throws {
        guard socketFd >= 0 else { throw IpcError(message: "Not connected") }
        let bytes = Array(line.utf8)
        var sent = 0
        while sent < bytes.count {
            let n = bytes.withUnsafeBytes { rawBuf in
                let base = rawBuf.bindMemory(to: UInt8.self).baseAddress!
                return Darwin.write(socketFd, base.advanced(by: sent), bytes.count - sent)
            }
            if n < 0 {
                throw IpcError(message: "write() failed: \(String(cString: strerror(errno)))")
            }
            sent += n
        }
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
        let line = "{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_scroll_enabled\",\"params\":{\"enabled\":\(enabled)}}\n"
        nextId += 1
        try writeLine(line)
    }

    func setDirectionSyncEnabled(_ enabled: Bool) async throws {
        guard isConnected else { return }
        let line = "{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_direction_sync_enabled\",\"params\":{\"enabled\":\(enabled)}}\n"
        nextId += 1
        try writeLine(line)
    }

    func setPreset(_ preset: String) async throws {
        guard isConnected else { return }
        let line = "{\"jsonrpc\":\"2.0\",\"id\":\(nextId),\"method\":\"set_preset\",\"params\":{\"preset\":\"\(preset)\"}}\n"
        nextId += 1
        try writeLine(line)
    }
}

struct IpcError: Error {
    let message: String
}
