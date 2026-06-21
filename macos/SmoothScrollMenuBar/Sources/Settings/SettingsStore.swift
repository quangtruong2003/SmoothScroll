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
    @Published var directionSyncEnabled: Bool = false
    
    @Published private(set) var isMutating: Bool = false

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
            
            connectionState = .connected

            let settings: AppSettingsResponse = try await IPCClient.shared.send("get_settings")
            applySettings(settings, source: .remote)
            
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
            scrollEnabled = previousValue
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
            speedPreset = previousValue
        }
    }

    // MARK: - Settings Snapshot

    private func saveSettingsSnapshot() async {
        guard !isMutating else {
            logger.warning("saveSettingsSnapshot skipped — mutation already in progress")
            return
        }
        
        isMutating = true
        defer { isMutating = false }
        
        do {
            let current: AppSettingsResponse = try await IPCClient.shared.send("get_settings")

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
                horizontalSmoothness: horizontalEnabled,
                horizontalInvert: current.horizontalInvert,
                reverseWheelDirection: current.reverseWheelDirection,
                smoothZoom: zoomEnabled,
                zoomInvert: current.zoomInvert,
                zoomSensitivity: current.zoomSensitivity,
                profiles: current.profiles,
                appProfiles: current.appProfiles,
                gameModeEnabled: current.gameModeEnabled
            )

            try await IPCClient.shared.send("save_settings", params: SaveSettingsParams(settings: updated))
            logger.info("Settings saved successfully")
        } catch {
            logger.error("saveSettings failed: \(error.localizedDescription)")
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
    }
    
    func updateConnectionState(_ state: ConnectionState) {
        connectionState = state
    }
}
