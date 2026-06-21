import Foundation

// MARK: - JSON-RPC Wire Types

/// JSON-RPC 2.0 request envelope.
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

struct AppSettingsResponse: Codable, Sendable {
    let enabled: Bool
    let activeProfile: String
    let stepSizePx: Int
    let animationTimeMs: Int
    let accelerationDeltaMs: Int
    let accelerationMax: Int
    let tailToHeadRatio: Int
    let animationEasing: Bool
    let easingMode: String
    let horizontalSmoothness: Bool
    let horizontalInvert: Bool
    let reverseWheelDirection: Bool
    let smoothZoom: Bool
    let zoomInvert: Bool
    let zoomSensitivity: Double
    let profiles: [ScrollProfileResponse]
    let appProfiles: [String: String]
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

struct ScrollProfileResponse: Codable, Sendable {
    let id: String
    let name: String
}
