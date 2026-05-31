import SwiftUI

struct SmoothScrollSection: View {
    @ObservedObject var settings: SettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("🌊")
                    .font(.system(size: 14))
                Text("Smooth Scroll")
                    .font(.system(size: 12, weight: .semibold))
                Spacer()
            }

            SettingsRow(
                icon: "",
                title: "Enable",
                isOn: $settings.scrollEnabled
            )
            .onChange(of: settings.scrollEnabled) { _, newValue in
                Task {
                    try? await IPCClient.shared.setScrollEnabled(newValue)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Speed")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(settings.speedLabel)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                Slider(
                    value: $settings.speedValue,
                    in: 0...2,
                    step: 1
                ) {
                    Text("Speed")
                }
                .onChange(of: settings.speedValue) { _, _ in
                    Task {
                        try? await IPCClient.shared.setPreset(settings.speedPreset)
                    }
                }
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
        .cornerRadius(8)
    }
}