import Foundation
import os

@MainActor
final class ReconnectionManager {
    private let client: IPCClient
    private let settings: SettingsStore
    private var task: Task<Void, Never>?
    private var retryCount = 0
    private let maxRetryCount = 10
    private let baseDelay: UInt64 = 1_000_000_000

    init(client: IPCClient = .shared, settings: SettingsStore = .shared) {
        self.client = client
        self.settings = settings
    }

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
            guard let self else { return }
            for await _ in await self.client.connectionLost {
                guard !Task.isCancelled else { return }
                await self.handleDisconnect()
            }
        }
    }

    private func handleDisconnect() async {
        retryCount += 1
        settings.updateConnectionState(.reconnecting(attempt: retryCount))

        while retryCount <= maxRetryCount && !Task.isCancelled {
            let exponent = min(retryCount - 1, 5)
            let delay = min(baseDelay * UInt64(1 << exponent), UInt64(30_000_000_000))
            do {
                try await Task.sleep(nanoseconds: delay)
            } catch {
                return
            }

            do {
                try await client.connect()
                await settings.loadInitialState()
                guard settings.connectionState == .connected else {
                    throw IpcError.message("Initial state load failed")
                }
                retryCount = 0
                return
            } catch {
                settings.updateConnectionState(.failed(error.localizedDescription))
            }
        }
        settings.updateConnectionState(.failed("Unable to reconnect to SmoothScroll engine"))
        retryCount = 0
    }

    func stop() {
        task?.cancel()
        task = nil
    }
}
