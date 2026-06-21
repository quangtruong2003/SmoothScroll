import AppKit
import os

class AppDelegate: NSObject, NSApplicationDelegate {
    private var menuBarController: MenuBarController?
    private var reconnectionManager: ReconnectionManager?
    private var activity: NSObjectProtocol?
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "AppDelegate")

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Keep process alive (idle-level — UI-only app doesn't need .userInitiated)
        activity = ProcessInfo.processInfo.beginActivity(
            options: .idleSystemSleepDisabled,
            reason: "SmoothScroll menu bar app active"
        )

        // Setup menu bar (includes NSMenu for ⌘Q)
        menuBarController = MenuBarController()
        menuBarController?.setup()

        // Start ReconnectionManager for auto-reconnect
        reconnectionManager = ReconnectionManager()
        reconnectionManager?.start()

        // Connect to Rust backend
        Task {
            await SettingsStore.shared.loadInitialState()
            // Post notification so MenuBarController updates icon
            NotificationCenter.default.post(name: .scrollStateDidChange, object: nil)
        }
    }

    /// Graceful shutdown: send IPC quit to Rust, wait briefly, then terminate.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        Task {
            do {
                try await IPCClient.shared.send("quit") as Bool
            } catch {
                self.logger.warning("IPC quit failed: \(error.localizedDescription)")
            }
            // Give Rust time to process quit
            try? await Task.sleep(for: .milliseconds(500))
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Stop reconnection manager first
        reconnectionManager?.stop()
        
        menuBarController?.teardown()
        Task {
            await IPCClient.shared.disconnect()
        }
        if let activity {
            ProcessInfo.processInfo.endActivity(activity)
        }
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }
}
