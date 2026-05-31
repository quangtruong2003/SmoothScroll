import SwiftUI

struct DirectionSyncSection: View {
    @ObservedObject var settings: SettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("U{1F504}")
                    .font(.system(size: 14))
                Text("Direction Sync")
                    .font(.system(size: 12, weight: .semibold))
                Spacer()
            }

            SettingsRow(
                icon: "",
                title: "Sync Trackpad & Mouse",
                isOn: .directionSyncEnabled
            )
            .onChange(of: settings.directionSyncEnabled) { _, newValue in
                Task {
                    try? await IPCClient.shared.setDirectionSyncEnabled(newValue)
                }
            }

            // Visual comparison.
            HStack(spacing: 8) {
                DeviceDirectionCard(
                    device: "U{1F4BB}",
                    label: "Trackpad",
                    direction: "Natural",
                    isActive: !settings.directionSyncEnabled
                )
                DeviceDirectionCard(
                    device: "U{1F5B1}U{FE0F}",
                    label: "Mouse",
                    direction: settings.directionSyncEnabled ? "Synced" : "Reversed",
                    isActive: settings.directionSyncEnabled
                )
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
        .cornerRadius(8)
    }
}

struct DeviceDirectionCard: View {
    let device: String
    let label: String
    let direction: String
    let isActive: Bool

    var body: some View {
        VStack(spacing: 4) {
            Text(device)
                .font(.system(size: 18))
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
            Text(direction)
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(isActive ? .accentColor : .secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color(nsColor: .textBackgroundColor).opacity(0.5))
        .cornerRadius(6)
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(isActive ? Color.accentColor : Color.clear, lineWidth: 1)
        )
    }
}
