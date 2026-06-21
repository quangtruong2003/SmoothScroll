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

    func send<T: Decodable>(_ method: String, params: (any Encodable)? = nil) async throws -> T {
        guard io.fd >= 0 else { throw IpcError.message("Not connected") }

        let id = nextId; nextId += 1
        let request = JSONRPCRequest(
            id: id,
            method: method,
            params: params.map { AnyEncodable($0) }
        )

        let jsonData = try JSONEncoder().encode(request)
        guard var lineData = jsonData.data(using: .utf8) else {
            throw IpcError.message("Failed to encode request")
        }
        lineData.append(0x0A) // newline

        // Store continuation FIRST (synchronous, no Task hop)
        let response: IpcResponse = try await withCheckedThrowingContinuation { cont in
            pendingRequests[id] = cont
        }

        // Write request (on IO queue to avoid blocking actor)
        do {
            try io.queue.sync { try io.write(lineData) }
        } catch {
            pendingRequests.removeValue(forKey: id)?
                .resume(throwing: IpcError.message("Write failed: \(error.localizedDescription)"))
            throw error
        }

        // Decode result
        if let error = response.error {
            throw IpcError.message(error.message)
        }
        guard let result = response.result else {
            return try JSONDecoder().decode(T.self, from: Data("true".utf8))
        }
        let resultData = try JSONSerialization.data(withJSONObject: result.value)
        return try JSONDecoder().decode(T.self, from: resultData)
    }

    // MARK: - Read Loop

    private func readLoop() async {
        while !Task.isCancelled {
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
            if let event = try? JSONDecoder().decode(IpcEvent.self, from: data) {
                Task { @MainActor in
                    SettingsStore.shared.handleEvent(event)
                }
            }
            return
        }

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
