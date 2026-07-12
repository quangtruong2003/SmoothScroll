import AppKit
import os

class AppDelegate: NSObject, NSApplicationDelegate {
    private var menuBarController: MenuBarController?
    private var reconnectionManager: ReconnectionManager?
    private var activity: NSObjectProtocol?
    private var settingsObserver: NSObjectProtocol?
    private var engineProcess: Process?
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "AppDelegate")

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Keep process alive (idle-level — UI-only app doesn't need .userInitiated)
        activity = ProcessInfo.processInfo.beginActivity(
            options: .idleSystemSleepDisabled,
            reason: "SmoothScroll menu bar app active"
        )

        // Launch Rust engine binary from app bundle
        launchEngine()

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

        // Notification observer — lives in AppDelegate (which is @MainActor via NSApplicationDelegate)
        // to avoid Sendable capture issues with MenuBarController's non-Sendable stored properties.
        settingsObserver = NotificationCenter.default.addObserver(
            forName: .scrollStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                let enabled = SettingsStore.shared.scrollEnabled
                self?.menuBarController?.updateIcon(scrollEnabled: enabled)
                self?.menuBarController?.updateAccessibilityValue(scrollEnabled: enabled)
            }
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
        // Remove notification observer
        if let observer = settingsObserver {
            NotificationCenter.default.removeObserver(observer)
        }

        // Stop engine process
        if let proc = engineProcess {
            proc.terminate()
        }

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

    private func launchEngine() {
        // Engine binary is bundled in Contents/MacOS/ alongside the main app binary
        let enginePath = Bundle.main.bundlePath
            .appending("/Contents/MacOS/smoothscroll-engine")

        guard FileManager.default.fileExists(atPath: enginePath) else {
            logger.error("smoothscroll-engine not found at \(enginePath)")
            return
        }

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: enginePath)
        proc.standardOutput = nil
        proc.standardError = nil

        do {
            try proc.run()
            engineProcess = proc
            logger.info("Engine launched (PID \(proc.processIdentifier))")
        } catch {
            logger.error("Failed to launch engine: \(error.localizedDescription)")
        }
    }
}
