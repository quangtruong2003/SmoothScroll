import SwiftUI

struct SettingsRow: View {
    let icon: String
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: ) {
            HStack(spacing: 8) {
                Text(icon)
                    .font(.system(size: 14))
                Text(title)
                    .font(.system(size: 12))
                    .foregroundColor(.primary)
            }
        }
        .toggleStyle(.switch)
        .controlSize(.small)
    }
}
