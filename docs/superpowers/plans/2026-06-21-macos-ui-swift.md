# SmoothScroll macOS — Plan 3: Swift UI Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the SwiftUI menu bar app: SettingsStore with proper state management, SmoothScrollPopover with connection status UI, MenuBarController with AppKit lifecycle, AppDelegate with graceful shutdown, and configuration files.

**Architecture:** The menu bar app uses `NSStatusItem` for the tray icon, `NSPopover` for the UI, and `SwiftUI` for the popover content. `SettingsStore` is the single source of truth, updating via IPC and local user interactions. All controls are disabled when disconnected.

**Tech Stack:** Swift 5.9+, SwiftUI, AppKit (NSStatusItem, NSPopover, NSMenu), os.log

---

## File Structure

```
macos/SmoothScrollMenuBar/Sources/
├── Settings/
│   ├── SettingsStore.swift    (MOD)  @MainActor state with rollback
│   └── ScrollPreset.swift     (NEW)  Preset enum
├── MenuBar/
│   └── MenuBarController.swift   (NEW)  NSStatusItem + NSPopover
├── Views/
│   └── SmoothScrollPopover.swift  (NEW)  Main popover view
├── App/
│   └── AppDelegate.swift        (NEW)  App lifecycle
├── Resources/
│   ├── Info.plist              (MOD)  LSUIElement = true
│   └── SmoothScrollMenuBar.entitlements  (MOD)  Sandbox disabled
└── (Keep) main.swift           (KEEP) Entry point
```

---

## Task 1: Create ScrollPreset.swift

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/Settings/ScrollPreset.swift`

Defines the speed preset enum that maps to Rust profile IDs.

- [ ] **Step 1: Create the file**

```swift
import Foundation

/// Speed presets that map to Rust profile IDs.
enum ScrollPreset: String, CaseIterable, Identifiable, Sendable {
    case balanced = "balanced"
    case snappy = "snappy"
    case glide = "glide"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .balanced: return "Balanced"
        case .snappy: return "Snappy"
        case .glide: return "Glide"
        }
    }
}
```

- [ ] **Step 2: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/Settings/ScrollPreset.swift`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/Settings/ScrollPreset.swift
git commit -m "feat(macos-ui): add ScrollPreset enum"
```

---

## Task 2: Create SettingsStore.swift

**Files:**
- Modify: `macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift`

The `SettingsStore` is the single source of truth for UI state. Key design decisions:
- `@MainActor` — all `@Published` mutations happen on main thread
- `UpdateSource` enum — prevents echo loops between local changes and remote events
- `isMutating` guard — prevents concurrent saves
- Rollback on error — failed mutations revert to previous value

- [ ] **Step 1: Create SettingsStore with connection state**

```swift
import Foundation
import Combine
import os

@MainActor
final class SettingsStore: ObservableObject, Sendable {
    static let shared = SettingsStore()

    // MARK: - Connection State
    @Published private(set) var connectionState: ConnectionState = .disconnected
    
    enum ConnectionState: Sendable, Equatable {
        case disconnected
        case connecting
        case connected
        case reconnecting(attempt: Int)
        case failed(String)
        
        static func == (lhs: ConnectionState, rhs: ConnectionState) -> Bool {
            switch (lhs, rhs) {
            case (.disconnected, .disconnected),
                 (.connecting, .connecting),
                 (.connected, .connected):
                return true
            case let (.reconnecting(a), .reconnecting(b)):
                return a == b
            case let (.failed(a), .failed(b)):
                return a == b
            default:
                return false
            }
        }
    }

    // MARK: - Settings
    @Published private(set) var scrollEnabled: Bool = false
    @Published private(set) var speedPreset: ScrollPreset = .balanced
    @Published var horizontalEnabled: Bool = false {
        didSet { Task { await saveSettingsSnapshot() } }
    }
    @Published var zoomEnabled: Bool = false {
        didSet { Task { await saveSettingsSnapshot() } }
    }
    @Published var directionSyncEnabled: Bool = false  // Coming Soon — disabled in UI
    
    /// True while a settings mutation is in progress to prevent concurrent saves.
    @Published private(set) var isMutating: Bool = false

    /// Tracks where the last update came from to prevent echo loops.
    private var lastUpdateSource: UpdateSource = .local
    private enum UpdateSource { case local, remote }

    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "SettingsStore")

    private init() {}
```

- [ ] **Step 2: Add loadInitialState with isConnected check**

```swift
    // MARK: - Initial State Loading

    /// Load all settings from Rust backend after IPC connects.
    func loadInitialState() async {
        connectionState = .connecting
        
        do {
            // Check if already connected before trying to connect
            if await IPCClient.shared.isConnected {
                logger.info("Already connected, fetching settings")
            } else {
                try await IPCClient.shared.connect()
            }
            
            connectionState = .connected

            let settings: AppSettingsResponse = try await IPCClient.shared.send("get_settings")
            applySettings(settings, source: .remote)
            
            logger.info("Settings loaded successfully")
        } catch {
            logger.error("Failed to load initial state: \(error.localizedDescription)")
            connectionState = .failed(error.localizedDescription)
        }
    }
```

- [ ] **Step 3: Add mutation methods with rollback**

```swift
    // MARK: - Scroll Enabled (with rollback on error)

    func setScrollEnabled(_ enabled: Bool) async {
        let previousValue = scrollEnabled
        scrollEnabled = enabled
        
        do {
            try await IPCClient.shared.send("set_scroll_enabled", params: SetEnabledParams(enabled: enabled))
        } catch {
            logger.error("setScrollEnabled failed, rolling back: \(error.localizedDescription)")
            scrollEnabled = previousValue
        }
    }

    // MARK: - Preset (with rollback on error)

    func setPreset(_ preset: ScrollPreset) async {
        let previousValue = speedPreset
        speedPreset = preset
        
        do {
            try await IPCClient.shared.send("set_preset", params: SetPresetParams(preset: preset.rawValue))
        } catch {
            logger.error("setPreset failed, rolling back: \(error.localizedDescription)")
            speedPreset = previousValue
        }
    }
```

- [ ] **Step 4: Add saveSettingsSnapshot with isMutating guard**

```swift
    // MARK: - Settings Snapshot (with mutation guard)

    /// Always fetch→modify→save full settings to prevent partial overwrite.
    private func saveSettingsSnapshot() async {
        guard !isMutating else {
            logger.warning("saveSettingsSnapshot skipped — mutation already in progress")
            return
        }
        
        isMutating = true
        defer { isMutating = false }
        
        do {
            // 1. Fetch current full settings from backend
            let current: AppSettingsResponse = try await IPCClient.shared.send("get_settings")

            // 2. Apply local overrides
            let updated = AppSettingsResponse(
                enabled: scrollEnabled,
                activeProfile: speedPreset.rawValue,
                stepSizePx: current.stepSizePx,
                animationTimeMs: current.animationTimeMs,
                accelerationDeltaMs: current.accelerationDeltaMs,
                accelerationMax: current.accelerationMax,
                tailToHeadRatio: current.tailToHeadRatio,
                animationEasing: current.animationEasing,
                easingMode: current.easingMode,
                horizontalSmoothness: horizontalEnabled,
                horizontalInvert: current.horizontalInvert,
                reverseWheelDirection: current.reverseWheelDirection,
                smoothZoom: zoomEnabled,
                zoomInvert: current.zoomInvert,
                zoomSensitivity: current.zoomSensitivity,
                profiles: current.profiles,
                appProfiles: current.appProfiles,
                gameModeEnabled: current.gameModeEnabled
            )

            // 3. Save full snapshot
            try await IPCClient.shared.send("save_settings", params: SaveSettingsParams(settings: updated))
            logger.info("Settings saved successfully")
        } catch {
            logger.error("saveSettings failed: \(error.localizedDescription)")
        }
    }
```

- [ ] **Step 5: Add event handling and helpers**

```swift
    // MARK: - Event Handling

    /// Apply settings from backend. Skips if update originated locally (prevents echo).
    func handleEvent(_ event: IpcEvent) {
        guard lastUpdateSource == .local else { return }
        lastUpdateSource = .remote
        defer { lastUpdateSource = .local }

        switch event {
        case .scrollStateChanged(let enabled):
            scrollEnabled = enabled
        case .presetChanged(let preset):
            speedPreset = ScrollPreset(rawValue: preset) ?? .balanced
        case .settingsChanged(let settings):
            applySettings(settings, source: .remote)
        }
    }

    private func applySettings(_ settings: AppSettingsResponse, source: UpdateSource) {
        lastUpdateSource = source
        defer { lastUpdateSource = .local }

        scrollEnabled = settings.enabled
        speedPreset = ScrollPreset(rawValue: settings.activeProfile) ?? .balanced
        horizontalEnabled = settings.horizontalSmoothness
        zoomEnabled = settings.smoothZoom
    }
    
    // MARK: - Connection State Helpers
    
    func updateConnectionState(_ state: ConnectionState) {
        connectionState = state
    }
}
```

- [ ] **Step 6: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift`
Expected: No syntax errors

- [ ] **Step 7: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift
git commit -m "feat(macos-ui): add SettingsStore with rollback and mutation guard"
```

---

## Task 3: Create SmoothScrollPopover.swift

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollPopover.swift`

Main popover view with connection status UI, all toggles disabled when disconnected, and "Coming Soon" for direction sync.

- [ ] **Step 1: Create the file with main view**

```swift
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
```

- [ ] **Step 2: Add speed preset picker**

```swift
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
```

- [ ] **Step 3: Add feature toggles and direction sync**

```swift
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
                    .disabled(true)  // Coming Soon
                
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
```

- [ ] **Step 4: Add connection status view**

```swift
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
```

- [ ] **Step 5: Add header and connection banner views**

```swift
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
```

- [ ] **Step 6: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollPopover.swift`
Expected: No syntax errors

- [ ] **Step 7: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollPopover.swift
git commit -m "feat(macos-ui): add SmoothScrollPopover with connection status UI"
```

---

## Task 4: Create MenuBarController.swift

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/MenuBar/MenuBarController.swift`

Manages `NSStatusItem` and `NSPopover`. Key design decisions:
- `Task { @MainActor in }` wrapper in notification callback (thread safety)
- `setupAppMenu()` for ⌘Q support on LSUIElement apps
- Observer stored and removed in `teardown()` (no memory leak)

- [ ] **Step 1: Create the file with class definition**

```swift
import AppKit
import SwiftUI
import os

final class MenuBarController: NSObject {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var hostingController: NSHostingController<SmoothScrollPopover>!
    private var settingsObserver: NSObjectProtocol?
    private let logger = Logger(subsystem: "com.SmoothScroll.MenuBar", category: "MenuBarController")

    func setup() {
        setupAppMenu()  // Must come first — enables ⌘Q
        setupStatusItem()
        setupPopover()
        setupObservers()
    }

    func teardown() {
        if let observer = settingsObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
```

- [ ] **Step 2: Add setupAppMenu**

```swift
    // MARK: - App Menu (enables ⌘Q for LSUIElement apps)

    private func setupAppMenu() {
        // With LSUIElement = true, the default app menu is hidden.
        // We must create a minimal app menu so ⌘Q works.
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About SmoothScroll", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit SmoothScroll", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)
        NSApp.mainMenu = mainMenu
    }
```

- [ ] **Step 3: Add setupStatusItem**

```swift
    // MARK: - Status Item

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "SS"
            }
            button.target = self
            button.action = #selector(togglePopover)

            // Accessibility
            button.setAccessibilityLabel("SmoothScroll")
            button.setAccessibilityRole(.button)
            updateAccessibilityValue()
        }
    }

    private func updateAccessibilityValue() {
        Task { @MainActor in  // SettingsStore is @MainActor
            let enabled = SettingsStore.shared.scrollEnabled
            statusItem.button?.setAccessibilityValue(
                enabled ? "Enabled" : "Disabled"
            )
        }
    }
```

- [ ] **Step 4: Add setupPopover and togglePopover**

```swift
    // MARK: - Popover

    private func setupPopover() {
        hostingController = NSHostingController(rootView: SmoothScrollPopover())

        popover = NSPopover()
        popover.contentSize = NSSize(width: 280, height: 220)
        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = hostingController
    }

    @objc private func togglePopover(_ sender: NSStatusBarButton) {
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }
```

- [ ] **Step 5: Add observers and updateIcon**

```swift
    // MARK: - Observers

    private func setupObservers() {
        settingsObserver = NotificationCenter.default.addObserver(
            forName: .scrollStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            // Thread safety: NotificationCenter callbacks may run on any thread
            Task { @MainActor in
                self?.updateIcon()
                self?.updateAccessibilityValue()
            }
        }
    }

    private func updateIcon() {
        guard let button = statusItem.button else { return }
        Task { @MainActor in  // SettingsStore is @MainActor
            let enabled = SettingsStore.shared.scrollEnabled

            if let image = NSImage(systemSymbolName: "scroll", accessibilityDescription: "SmoothScroll") {
                image.isTemplate = true
                button.image = image
                // Use alpha for enabled/disabled — template images ignore tint on some macOS versions
                button.alphaValue = enabled ? 1.0 : 0.4
            }
        }
    }
}

extension Notification.Name {
    static let scrollStateDidChange = Notification.Name("scrollStateDidChange")
}
```

- [ ] **Step 6: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/MenuBar/MenuBarController.swift`
Expected: No syntax errors

- [ ] **Step 7: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/MenuBar/MenuBarController.swift
git commit -m "feat(macos-ui): add MenuBarController with NSStatusItem and NSPopover"
```

---

## Task 5: Create AppDelegate.swift

**Files:**
- Create: `macos/SmoothScrollMenuBar/Sources/App/AppDelegate.swift`

Manages app lifecycle with `ReconnectionManager` and graceful shutdown.

- [ ] **Step 1: Create the file**

```swift
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
```

- [ ] **Step 2: Add applicationShouldTerminate**

```swift
    /// Graceful shutdown: send IPC quit to Rust, wait briefly, then terminate.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        Task {
            do {
                try await IPCClient.shared.send("quit")
            } catch {
                self.logger.warning("IPC quit failed: \(error.localizedDescription)")
            }
            // Give Rust time to process quit
            try? await Task.sleep(for: .milliseconds(500))
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }
```

- [ ] **Step 3: Add applicationWillTerminate and helper**

```swift
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
```

- [ ] **Step 4: Verify Swift compilation**

Run: `swiftc -parse macos/SmoothScrollMenuBar/Sources/App/AppDelegate.swift`
Expected: No syntax errors

- [ ] **Step 5: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/App/AppDelegate.swift
git commit -m "feat(macos-ui): add AppDelegate with graceful shutdown"
```

---

## Task 6: Update Info.plist

**Files:**
- Modify: `macos/SmoothScrollMenuBar/Sources/Resources/Info.plist`

Add `LSUIElement = true` to hide the Dock icon.

- [ ] **Step 1: Update Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Hide Dock icon — we're a menu bar app only -->
    <key>LSUIElement</key>
    <true/>
    
    <!-- App identification -->
    <key>CFBundleIdentifier</key>
    <string>com.SmoothScroll.MenuBar</string>
    <key>CFBundleName</key>
    <string>SmoothScroll</string>
    <key>CFBundleDisplayName</key>
    <string>SmoothScroll</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    
    <!-- App category -->
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.utilities</string>
    
    <!-- Hardened Runtime (required for notarization) -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <false/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <false/>
</dict>
</plist>
```

- [ ] **Step 2: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/Resources/Info.plist
git commit -m "config(macos): add LSUIElement to hide Dock icon"
```

---

## Task 7: Update Entitlements

**Files:**
- Modify: `macos/SmoothScrollMenuBar/Sources/Resources/SmoothScrollMenuBar.entitlements`

Disable App Sandbox (required for Unix socket IPC).

- [ ] **Step 1: Update entitlements**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Sandbox disabled — required for Unix socket IPC -->
    <!-- To enable sandbox later, you need:
         com.apple.security.application-groups = ["group.com.SmoothScroll"] -->
</dict>
</plist>
```

- [ ] **Step 2: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/Resources/SmoothScrollMenuBar.entitlements
git commit -m "config(macos): disable sandbox for Unix socket IPC"
```

---

## Task 8: Delete Unused Files

**Files:**
- Delete: Unused Swift view files

- [ ] **Step 1: Identify files to delete**

From the spec, these files should be deleted:
- `macos/SmoothScrollMenuBar/Sources/Views/DirectionSyncSection.swift`
- `macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollSection.swift`
- `macos/SmoothScrollMenuBar/Sources/Views/PresetShortcutsView.swift`
- `macos/SmoothScrollMenuBar/Sources/Views/SettingsRow.swift`
- `macos/SmoothScrollMenuBar/Sources/Views/DeviceDirectionCard.swift`

- [ ] **Step 2: Delete each file**

```bash
rm macos/SmoothScrollMenuBar/Sources/Views/DirectionSyncSection.swift
rm macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollSection.swift
rm macos/SmoothScrollMenuBar/Sources/Views/PresetShortcutsView.swift
rm macos/SmoothScrollMenuBar/Sources/Views/SettingsRow.swift
rm macos/SmoothScrollMenuBar/Sources/Views/DeviceDirectionCard.swift
```

- [ ] **Step 3: Keep VisualEffectBlur.swift**

This file is still used by SmoothScrollPopover.

- [ ] **Step 4: Commit**

```bash
git add -u  # Stage deletions
git commit -m "chore(macos): delete unused Swift view files"
```

---

## Verification

After completing all tasks:

1. **Compilation:** `xcodebuild build` passes
2. **Menu bar icon:** Shows in menu bar with scroll symbol
3. **Popover opens:** Click on menu bar icon opens popover
4. **Controls disabled:** All toggles disabled when `connectionState != .connected`
5. **Direction sync:** Shows "Coming Soon" label, disabled
6. **⌘Q works:** Quit from menu
7. **Reconnection:** App auto-reconnects when Rust restarts
8. **Accessibility:** VoiceOver can read menu bar icon
