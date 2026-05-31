import Foundation

// MARK: - Requests (Swift -> Rust)

enum IpcRequest: Codable {
    case getScrollEnabled
    case setScrollEnabled(enabled: Bool)
    case getDirectionSyncEnabled
    case setDirectionSyncEnabled(enabled: Bool)
    case getPreset
    case setPreset(preset: String)
    case getSettings
    case saveSettings(settings: [String: AnyCodable])
    case quit
}

struct IpcRequestMessage: Codable {
    let jsonrpc: String = "2.0"
    let id: Int?
    let method: String
    let params: [String: AnyCodable]?
}

// MARK: - Responses

struct IpcResponse: Codable {
    let jsonrpc: String
    let id: Int?
    let result: AnyCodable?
    let error: IpcErrorStruct?
}

struct IpcErrorStruct: Codable {
    let code: Int
    let message: String
}

// MARK: - Events (Rust -> Swift)

enum IpcEvent: Codable {
    case scrollStateChanged(enabled: Bool)
    case directionSyncChanged(enabled: Bool)
    case presetChanged(preset: String)
}

// MARK: - AnyCodable helper

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

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
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let bool = value as? Bool {
            try container.encode(bool)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let string = value as? String {
            try container.encode(string)
        } else {
            try container.encodeNil()
        }
    }
}
