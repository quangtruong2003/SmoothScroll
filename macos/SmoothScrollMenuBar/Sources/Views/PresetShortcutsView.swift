import SwiftUI

struct PresetShortcutsView: View {
    @ObservedObject var settings: SettingsStore

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                PresetButton(label: "Balanced", shortcut: "⌘1", isActive: settings.speedPreset == "balanced") {
                    Task { try? await IPCClient.shared.setPreset("balanced") }
                }
                PresetButton(label: "Snappy", shortcut: "⌘2", isActive: settings.speedPreset == "snappy") {
                    Task { try? await IPCClient.shared.setPreset("snappy") }
                }
                PresetButton(label: "Glide", shortcut: "⌘3", isActive: settings.speedPreset == "glide") {
                    Task { try? await IPCClient.shared.setPreset("glide") }
                }
            }

            Divider()

            HStack {
                ActionShortcut(label: "⌘D DirSync", action: "Toggle") {
                    settings.directionSyncEnabled.toggle()
                    Task { try? await IPCClient.shared.setDirectionSyncEnabled(settings.directionSyncEnabled) }
                }
                Spacer()
                ActionShortcut(label: "⌘, Prefs", action: "System Settings") {
                    if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
                        NSWorkspace.shared.open(url)
                    }
                }
                Spacer()
                Button("⌘Q Quit") {
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.plain)
                .foregroundColor(.secondary)
                .font(.system(size: 11))
            }
        }
    }
}

struct PresetButton: View {
    let label: String
    let shortcut: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(shortcut)
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(4)
                Text(label)
                    .font(.system(size: 11))
            }
            .foregroundColor(isActive ? .accentColor : .primary)
        }
        .buttonStyle(.plain)
    }
}

struct ActionShortcut: View {
    let label: String
    let action: String
    let callback: () -> Void

    var body: some View {
        Button(action: callback) {
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.secondary)
        }
        .buttonStyle(.plain)
    }
}