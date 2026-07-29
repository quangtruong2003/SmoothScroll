import Foundation
import Combine
import os

@MainActor
final class SettingsStore: ObservableObject, Sendable {
    static let shared = SettingsStore()

    // MARK: - Connection State
    @Published private(set) var connectionState: ConnectionState = .disconnected
    @Published private(set) var accessibilityGranted = false
    @Published private(set) var accessibilityPromptRequested = false
    
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
    @Published private(set) var horizontalEnabled: Bool = false
    @Published private(set) var zoomEnabled: Bool = false
    @Published var directionSyncEnabled: Bool = false

    private var lastUpdateSource: UpdateSource = .local
    private enum UpdateSource { case local, remote }

    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "SettingsStore")

    private init() {}

    // MARK: - Initial State Loading

    func loadInitialState() async {
        connectionState = .connecting
        
        do {
            if await IPCClient.shared.isConnected {
                logger.info("Already connected, fetching settings")
            } else {
                try await IPCClient.shared.connect()
            }
            
            let settings: AppSettingsResponse = try await IPCClient.shared.send("get_settings")
            applySettings(settings, source: .remote)
            accessibilityGranted = try await IPCClient.shared.send("get_accessibility_status")
            connectionState = .connected
            
            logger.info("Settings loaded successfully")
        } catch {
            logger.error("Failed to load initial state: \(error.localizedDescription)")
            connectionState = .failed(error.localizedDescription)
        }
    }

    func requestAccessibilityAccess() async {
        accessibilityPromptRequested = true
        do {
            _ = try await IPCClient.shared.send("request_accessibility_access") as Bool
            try? await Task.sleep(for: .milliseconds(500))
            accessibilityGranted = try await IPCClient.shared.send("get_accessibility_status")
        } catch {
            logger.error("Accessibility request failed: \(error.localizedDescription)")
        }
    }

    func refreshAccessibilityStatus() async {
        do {
            accessibilityGranted = try await IPCClient.shared.send("get_accessibility_status")
        } catch {
            logger.error("Accessibility status refresh failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Scroll Enabled (with rollback on error)

    func setScrollEnabled(_ enabled: Bool) async {
        let previousValue = scrollEnabled
        scrollEnabled = enabled
        
        do {
            try await IPCClient.shared.send("set_scroll_enabled", params: SetEnabledParams(enabled: enabled)) as Bool
        } catch {
            logger.error("setScrollEnabled failed, rolling back: \(error.localizedDescription)")
            scrollEnabled = previousValue
        }
    }

    // MARK: - Preset (with rollback on error)

    func setPreset(_ preset: ScrollPreset) async {
        let previousValue = speedPreset
        speedPreset = preset
        
        do {
            try await IPCClient.shared.send("set_preset", params: SetPresetParams(preset: preset.rawValue)) as Bool
        } catch {
            logger.error("setPreset failed, rolling back: \(error.localizedDescription)")
            speedPreset = previousValue
        }
    }

    // MARK: - Direction Sync

    func setDirectionSyncEnabled(_ enabled: Bool) async {
        let previousValue = directionSyncEnabled
        directionSyncEnabled = enabled

        do {
            try await IPCClient.shared.send(
                "set_direction_sync_enabled",
                params: SetDirectionSyncParams(enabled: enabled)
            ) as Bool
        } catch {
            logger.error("setDirectionSyncEnabled failed, rolling back: \(error.localizedDescription)")
            directionSyncEnabled = previousValue
        }
    }

    func setHorizontalEnabled(_ enabled: Bool) async {
        let previousValue = horizontalEnabled
        horizontalEnabled = enabled

        do {
            try await IPCClient.shared.send(
                "set_horizontal_smoothness",
                params: SetBoolParams(enabled: enabled)
            ) as Bool
        } catch {
            logger.error("setHorizontalEnabled failed, rolling back: \(error.localizedDescription)")
            horizontalEnabled = previousValue
        }
    }

    func setZoomEnabled(_ enabled: Bool) async {
        let previousValue = zoomEnabled
        zoomEnabled = enabled

        do {
            try await IPCClient.shared.send(
                "set_smooth_zoom",
                params: SetBoolParams(enabled: enabled)
            ) as Bool
        } catch {
            logger.error("setZoomEnabled failed, rolling back: \(error.localizedDescription)")
            zoomEnabled = previousValue
        }
    }

    // MARK: - Event Handling

    func handleEvent(_ event: IpcEvent) {
        guard lastUpdateSource == .local else { return }
        lastUpdateSource = .remote
        defer { lastUpdateSource = .local }

        switch event {
        case .scrollStateChanged(let enabled):
            scrollEnabled = enabled
        case .presetChanged(let preset):
            speedPreset = ScrollPreset(rawValue: preset) ?? .balanced
        case .directionSyncChanged(let enabled):
            directionSyncEnabled = enabled
        case .settingsChanged(let settings):
            applySettings(settings, source: .remote)
        }
    }

    private func applySettings(_ settings: AppSettingsResponse, source: UpdateSource) {
        lastUpdateSource = source
        defer { lastUpdateSource = .local }

        scrollEnabled = settings.enabled
        speedPreset = ScrollPreset(rawValue: settings.activeProfile) ?? .balanced
        horizontalEnabled = settings.horizontalSmoothness
        zoomEnabled = settings.smoothZoom
        directionSyncEnabled = settings.directionSyncEnabled
    }
    
    func updateConnectionState(_ state: ConnectionState) {
        connectionState = state
    }
}
