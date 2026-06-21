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
