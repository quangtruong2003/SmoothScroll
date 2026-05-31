import AppKit
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    private var menuBarController: MenuBarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Prevent App Nap from throttling our scroll interception.
        ProcessInfo.processInfo.beginActivity(
            options: .userInitiated,
            reason: "SmoothScroll scroll event interception active"
        )

        // Initialize the menu bar.
        menuBarController = MenuBarController()
        menuBarController?.setup()

        // Connect to the Rust IPC socket.
        Task {
            do {
                try await IPCClient.shared.connect()
            } catch {
                print("Failed to connect to SmoothScroll engine: \(error)")
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        Task {
            try? await IPCClient.shared.disconnect()
        }
    }
}
