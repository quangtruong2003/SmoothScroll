import Foundation
import Combine

@MainActor
class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    @Published var scrollEnabled: Bool = true {
        didSet { objectWillChange.send() }
    }
    @Published var directionSyncEnabled: Bool = false {
        didSet { objectWillChange.send() }
    }
    @Published var speedPreset: String = "balanced" {
        didSet { objectWillChange.send() }
    }
    @Published var speedValue: Double = 1 {
        didSet { objectWillChange.send() }
    }

    var speedLabel: String {
        switch speedPreset {
        case "snappy": return "Snappy"
        case "glide": return "Glide"
        default: return "Balanced"
        }
    }

    private init() {}
}
