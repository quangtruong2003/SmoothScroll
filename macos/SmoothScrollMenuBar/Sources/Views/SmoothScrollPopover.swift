import SwiftUI

struct SmoothScrollPopover: View {
    @StateObject private var settings = SettingsStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            PopoverHeader()

            Divider()

            VStack(alignment: .leading, spacing: 12) {
                // Full connection state UI
                connectionStatusView

                // All controls disabled when disconnected
                let isEnabled = settings.connectionState == .connected

                // Smooth Scroll toggle
                Toggle("Smooth Scroll", isOn: Binding(
                    get: { settings.scrollEnabled },
                    set: { newValue in
                        Task { await settings.setScrollEnabled(newValue) }
                    }
                ))
                .toggleStyle(.switch)
                .disabled(!isEnabled)

                // Speed preset
                VStack(alignment: .leading, spacing: 4) {
                    Text("Speed")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                    Picker("Speed", selection: Binding(
                        get: { settings.speedPreset },
                        set: { newValue in
                            Task { await settings.setPreset(newValue) }
                        }
                    )) {
                        ForEach(ScrollPreset.allCases) { preset in
                            Text(preset.displayName).tag(preset)
                        }
                    }
                    .pickerStyle(.segmented)
                    .disabled(!isEnabled)
                }

                Divider()

                // Horizontal Scroll
                Toggle("Horizontal Scroll", isOn: $settings.horizontalEnabled)
                    .toggleStyle(.switch)
                    .disabled(!isEnabled)

                // Zoom
                Toggle("Zoom", isOn: $settings.zoomEnabled)
                    .toggleStyle(.switch)
                    .disabled(!isEnabled)

                // Direction Sync — Coming Soon
                Toggle("Direction Sync", isOn: $settings.directionSyncEnabled)
                    .toggleStyle(.switch)
                    .disabled(true)
                
                Text("Coming Soon")
                    .font(.system(size: 9))
                    .foregroundStyle(.tertiary)
                    .padding(.leading, 36)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .frame(width: 280)
        .background(
            VisualEffectBlur(material: .popover, blendingMode: .behindWindow)
                .ignoresSafeArea()
        )
    }
    
    @ViewBuilder
    private var connectionStatusView: some View {
        switch settings.connectionState {
        case .connecting:
            HStack(spacing: 6) {
                ProgressView()
                    .controlSize(.small)
                Text("Connecting...")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(6)
            
        case .reconnecting(let attempt):
            HStack(spacing: 6) {
                ProgressView()
                    .controlSize(.small)
                Text("Reconnecting... (attempt \(attempt))")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.blue.opacity(0.1))
            .cornerRadius(6)
            
        case .failed(let message):
            ConnectionBanner(message: message)
            
        case .disconnected:
            HStack(spacing: 6) {
                Image(systemName: "wifi.slash")
                    .foregroundStyle(.secondary)
                Text("Disconnected")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.gray.opacity(0.1))
            .cornerRadius(6)
            
        case .connected:
            EmptyView()
        }
    }
}

struct PopoverHeader: View {
    private var version: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
    }

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                Text("SmoothScroll")
                    .font(.system(size: 13, weight: .semibold))
                if !version.isEmpty {
                    Text("v\(version)")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
}

struct ConnectionBanner: View {
    let message: String
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.1))
        .cornerRadius(6)
    }
}
