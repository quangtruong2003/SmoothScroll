import SwiftUI

struct SmoothScrollPopover: View {
    @StateObject private var settings = SettingsStore()

    var body: some View {
        VStack(spacing: 0) {
            // Header.
            PopoverHeader()

            Divider()

            // Section 1: Smooth Scroll.
            SmoothScrollSection(settings: settings)
                .padding(.horizontal, 12)
                .padding(.top, 12)

            // Section 2: Direction Sync.
            DirectionSyncSection(settings: settings)
                .padding(.horizontal, 12)
                .padding(.top, 8)

            Divider()
                .padding(.top, 8)

            // Footer shortcuts.
            PresetShortcutsView(settings: settings)
                .padding(12)
        }
        .frame(width: 300)
        .background(
            VisualEffectBlur(material: .popover, blendingMode: .behindWindow)
                .ignoresSafeArea()
        )
    }
}

struct PopoverHeader: View {
    var body: some View {
        HStack(spacing: 8) {
            Text("U{1F42D}")
                .font(.system(size: 16))
            VStack(alignment: .leading, spacing: 0) {
                Text("SmoothScroll")
                    .font(.system(size: 13, weight: .semibold))
                Text("v1.3.1")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            Spacer()
            Circle()
                .fill(Color.green)
                .frame(width: 8, height: 8)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}
