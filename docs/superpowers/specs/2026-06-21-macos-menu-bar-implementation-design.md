# SmoothScroll macOS — Implementation Spec

> **Date:** June 21, 2026
> **Status:** Implementation Guide (v2 - Fixed)
> **Goal:** Fix all critical bugs + implement clean native macOS menu bar UI

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              macOS Menu Bar (NSStatusItem)              │
│                                                          │
│   [● SmoothScroll]  ← Status dot + Click → NSPopover    │
│                            │                            │
│                            ▼                            │
│   [SwiftUI PopoverView] ◄──► [Rust IPC Socket]         │
│                            │     (Unix Domain Socket)    │
│                            ▼                            │
│   [Rust Engine + CGEventTap]                            │
│   - Smooth scroll, horizontal, zoom                      │
│   - Direction sync                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. UI Specification

### 2.1 macOS Conventions

| Element | Standard macOS Pattern |
|---------|----------------------|
| Quit | Menu bar dropdown menu (NSMenu) |
| Status indicator | Menu bar icon dot (green/gray) |
| Settings | NSPopover |
| Controls | Native SwiftUI Toggle, Picker |

### 2.2 Menu Bar Icon

- **Enabled:** Green dot `●` (filled circle)
- **Disabled:** Gray dot `○` (outline circle)

This replaces any text or emoji in the menu bar.

### 2.3 Popover Dimensions
- **Width:** 280pt (standard macOS popover)
- **Height:** Auto-sizing, ~180pt content

### 2.4 Visual Design

| Element | Style |
|---------|-------|
| Background | `.ultraThinMaterial` (native vibrancy) |
| Typography | System font, sizes: 13pt (title), 12pt (labels) |
| Spacing | 8pt grid, 12pt horizontal padding, 8pt vertical spacing |
| Colors | `.primary`, `.secondary` — system colors |
| Toggle | `.toggleStyle(.switch)` |
| Preset Picker | `.pickerStyle(.segmented)` |

### 2.5 Layout Structure

```
┌──────────────────────────────────────────────┐
│ SmoothScroll                                   │  ← Header (no dot - dot is in menu bar)
├──────────────────────────────────────────────┤
│                                              │
│  Smooth Scroll                        [  ●  ] │  ← Toggle
│                                              │
│  Speed                  [Balanced|Snappy|Glide] │  ← Segmented Picker
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  Horizontal Scroll                     [  ●  ] │  ← Toggle
│  Zoom                                   [  ●  ] │  ← Toggle
│  Direction Sync                         [  ●  ] │  ← Toggle
│                                              │
└──────────────────────────────────────────────┘

Menu Bar Dropdown (standard macOS):
┌────────────────────────────┐
│ About SmoothScroll          │
│ ────────────────────────── │
│ Quit SmoothScroll      ⌘Q  │
└────────────────────────────┘
```

### 2.6 NO Icons Policy
- Không dùng emoji hoặc SF Symbols cho các toggle items
- Status indicator là dot trong menu bar icon (cần thiết cho visual feedback)
- Quit được đặt trong menu bar dropdown (chuẩn macOS)

---

## 3. Functionality Specification

### 3.1 Core Features

| Feature | Implementation | IPC Command |
|---------|---------------|-------------|
| Smooth Scroll Toggle | `scrollEnabled` state | `set_scroll_enabled(bool)` |
| Speed Preset | `activeProfile` setting | `set_preset(string)` |
| Horizontal Scroll | `enableHorizontal` setting | `set_enable_horizontal(bool)` |
| Zoom | `enableZoom` setting | `set_enable_zoom(bool)` |
| Direction Sync | `reverseWheelDirection` setting | `set_direction_sync(bool)` |
| Quit | NSApplication.terminate() via menu | `quit()` |

### 3.2 State Sync Flow

```
App Launch:
  Swift ──connect()──► Rust IPC
                         │
                         ▼
  Swift ◄──init state─── Rust (via get_* queries)
                         │
                         ▼
  SettingsStore.load() ◄──

User Interaction:
  Swift UI ──user changes──► SettingsStore
                                   │
                                   ▼
                           IPCClient.send()
                                   │
                                   ▼
                             Rust receives
                                   │
                                   ▼
                             Engine + Settings save
                                   │
                                   ▼
                             Broadcast event to all clients
                                   │
                                   ▼
                             All Swift clients update
```

### 3.3 Status Indicator Logic

| State | Menu Bar Icon | When |
|-------|--------------|------|
| Enabled | ● (green filled) | `scrollEnabled == true` |
| Disabled | ○ (gray outline) | `scrollEnabled == false` |

---

## 4. File Changes

### 4.1 Swift File Structure

```
macos/SmoothScrollMenuBar/Sources/
├── main.swift                          # App entry point
├── AppDelegate.swift                   # App lifecycle + menu bar setup
├── MenuBarController.swift             # NSStatusItem + NSPopover management
├── Views/
│   ├── SmoothScrollPopover.swift       # Main popover content (NEW - replace)
│   └── VisualEffectBlur.swift          # Keep (for .ultraThinMaterial support)
├── Stores/
│   └── SettingsStore.swift             # State management (REPLACE)
├── Services/
│   └── IPCClient.swift                 # IPC communication (REPLACE)
└── Models/
    └── ScrollSettings.swift            # Preset enum (NEW)
```

### 4.2 Files to DELETE

```
macos/SmoothScrollMenuBar/Sources/Views/
  - DirectionSyncSection.swift      ← DELETE
  - SmoothScrollSection.swift        ← DELETE
  - PresetShortcutsView.swift        ← DELETE
  - SettingsRow.swift                 ← DELETE
  - DeviceDirectionCard.swift        ← DELETE
```

### 4.3 Rust IPC Changes

| File | Changes |
|------|---------|
| `ipc_socket_server.rs` | Fix socket path, add horizontal/zoom/direction sync commands |
| `commands.rs` | Sync method names: `set_scroll_enabled`, `get_scroll_enabled` |

### 4.4 Socket Path Convention

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/SmoothScroll/socket` |
| Linux | `~/.config/smoothscroll/socket` (existing) |
| Windows | `%APPDATA%/com.SmoothScroll/SmoothScroll/socket` (existing) |

---

## 5. IPC Protocol

### 5.1 Commands (Swift → Rust)

| Method | Params | Returns |
|--------|--------|---------|
| `get_scroll_enabled` | none | `bool` |
| `set_scroll_enabled` | `{ enabled: bool }` | `bool` |
| `get_preset` | none | `string` |
| `set_preset` | `{ preset: string }` | `bool` |
| `get_enable_horizontal` | none | `bool` |
| `set_enable_horizontal` | `{ enabled: bool }` | `bool` |
| `get_enable_zoom` | none | `bool` |
| `set_enable_zoom` | `{ enabled: bool }` | `bool` |
| `get_direction_sync` | none | `bool` |
| `set_direction_sync` | `{ enabled: bool }` | `bool` |
| `quit` | none | `bool` |

### 5.2 Events (Rust → Swift)

| Event | Payload | When |
|-------|---------|------|
| `scroll_state_changed` | `{ enabled: bool }` | Smooth scroll toggled |
| `preset_changed` | `{ preset: string }` | Speed changed |
| `horizontal_changed` | `{ enabled: bool }` | Horizontal scroll toggled |
| `zoom_changed` | `{ enabled: bool }` | Zoom toggled |
| `direction_sync_changed` | `{ enabled: bool }` | Direction sync toggled |

### 5.3 Auto-Reconnect Logic

```swift
// IPCClient.swift
actor IPCClient {
    private var isReconnecting = false
    
    func connect() async throws {
        // ... establish connection ...
        
        // Handle disconnect with auto-reconnect
        Task {
            await handleReconnectLoop()
        }
    }
    
    private func handleReconnectLoop() async {
        while !Task.isCancelled {
            let disconnected = await waitForDisconnect()
            if disconnected {
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1s delay
                try? await self.connect()
            }
        }
    }
}
```

---

## 6. Implementation Steps

### Phase 1: Fix Critical Bugs

1. **Fix socket path mismatch**
   - Swift: Update to `~/Library/Application Support/SmoothScroll/socket`
   - Rust: Use `directories` crate for cross-platform path

2. **Auto-connect IPC on app start**
   - `AppDelegate.applicationDidFinishLaunching` → connect IPC
   - Handle connection errors gracefully

3. **Implement all IPC commands**
   - Add `set_enable_horizontal`, `set_enable_zoom`, `set_direction_sync`
   - Wire Rust settings to IPC

4. **Menu bar icon update**
   - Green dot when enabled, gray outline when disabled
   - Update on `scroll_state_changed` event

### Phase 2: UI Rewrite

1. **New SmoothScrollPopover.swift**
   - Native SwiftUI layout
   - No icons/emojis
   - `@ObservedObject` for singleton (NOT `@StateObject`)
   - `.ultraThinMaterial` background

2. **AppDelegate with standard menu**
   - About, Quit in menu bar dropdown
   - ⌘Q shortcut for Quit

3. **Delete unused views**
   - Remove all emoji/icon usage

### Phase 3: Polish

1. **State persistence**
   - On change → IPC → Rust saves to disk

2. **Quit functionality**
   - Menu bar Quit menu item
   - ⌘Q keyboard shortcut

---

## 7. Code Examples (Fixed)

### 7.1 Preset Enum

```swift
// ScrollSettings.swift
enum ScrollPreset: String, CaseIterable, Identifiable {
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

### 7.2 SettingsStore (Fixed)

```swift
// SettingsStore.swift
@MainActor
class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    @Published var scrollEnabled: Bool = false
    @Published var speedPreset: ScrollPreset = .balanced
    @Published var horizontalEnabled: Bool = false
    @Published var zoomEnabled: Bool = false
    @Published var directionSyncEnabled: Bool = false

    private var isInitializing = true

    private init() {}

    func loadInitialState() async {
        do {
            try await IPCClient.shared.connect()

            // Load all settings from Rust
            scrollEnabled = try await IPCClient.shared.getScrollEnabled()
            speedPreset = ScrollPreset(rawValue: try await IPCClient.shared.getPreset()) ?? .balanced
            horizontalEnabled = try await IPCClient.shared.getEnableHorizontal()
            zoomEnabled = try await IPCClient.shared.getEnableZoom()
            directionSyncEnabled = try await IPCClient.shared.getDirectionSync()

            isInitializing = false
        } catch {
            print("Failed to load initial state: \(error)")
        }
    }

    func setScrollEnabled(_ enabled: Bool) async {
        guard !isInitializing else { return }
        scrollEnabled = enabled
        try? await IPCClient.shared.setScrollEnabled(enabled)
    }

    func setPreset(_ preset: ScrollPreset) async {
        guard !isInitializing else { return }
        speedPreset = preset
        try? await IPCClient.shared.setPreset(preset.rawValue)
    }
}
```

### 7.3 New Popover Layout (Fixed)

```swift
// SmoothScrollPopover.swift
struct SmoothScrollPopover: View {
    @ObservedObject private var settings = SettingsStore.shared

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("SmoothScroll")
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            Divider()
                .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 12) {
                // Smooth Scroll Toggle
                Toggle("Smooth Scroll", isOn: Binding(
                    get: { settings.scrollEnabled },
                    set: { newValue in
                        Task { await settings.setScrollEnabled(newValue) }
                    }
                ))
                .toggleStyle(.switch)

                // Speed Preset
                VStack(alignment: .leading, spacing: 4) {
                    Text("Speed")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    Picker("", selection: Binding(
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
                }

                Divider()

                // Horizontal Scroll
                Toggle("Horizontal Scroll", isOn: Binding(
                    get: { settings.horizontalEnabled },
                    set: { newValue in
                        Task { await settings.setHorizontalEnabled(newValue) }
                    }
                ))
                .toggleStyle(.switch)

                // Zoom
                Toggle("Zoom", isOn: Binding(
                    get: { settings.zoomEnabled },
                    set: { newValue in
                        Task { await settings.setZoomEnabled(newValue) }
                    }
                ))
                .toggleStyle(.switch)

                // Direction Sync
                Toggle("Direction Sync", isOn: Binding(
                    get: { settings.directionSyncEnabled },
                    set: { newValue in
                        Task { await settings.setDirectionSyncEnabled(newValue) }
                    }
                ))
                .toggleStyle(.switch)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .frame(width: 280)
        .background(.ultraThinMaterial)
    }
}
```

### 7.4 AppDelegate with Standard Menu

```swift
// AppDelegate.swift
class AppDelegate: NSObject, NSApplicationDelegate {
    var menuBarController: MenuBarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Build standard macOS menu
        setupMenuBar()

        // Setup menu bar icon + popover
        menuBarController = MenuBarController()

        // Load initial state
        Task {
            await SettingsStore.shared.loadInitialState()
        }
    }

    func setupMenuBar() {
        let mainMenu = NSMenu()

        // App menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)

        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu

        appMenu.addItem(NSMenuItem(
            title: "About SmoothScroll",
            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
            keyEquivalent: ""
        ))
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(NSMenuItem(
            title: "Quit SmoothScroll",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        ))

        NSApplication.shared.mainMenu = mainMenu
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
}
```

### 7.5 Menu Bar Icon (Status Dot)

```swift
// MenuBarController.swift
class MenuBarController: NSObject {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!

    override init() {
        super.init()
        setupStatusItem()
        setupPopover()
    }

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            button.action = #selector(togglePopover)
            button.target = self
            updateIcon(isEnabled: false)
        }

        // Observe scroll state changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(scrollStateDidChange),
            name: .scrollStateDidChange,
            object: nil
        )
    }

    private func setupPopover() {
        popover = NSPopover()
        popover.contentSize = NSSize(width: 280, height: 180)
        popover.behavior = .transient
        popover.contentViewController = NSHostingController(rootView: SmoothScrollPopover())
    }

    func updateIcon(isEnabled: Bool) {
        guard let button = statusItem.button else { return }

        let config = NSImage.SymbolConfiguration(pointSize: 14, weight: .medium)

        if isEnabled {
            // Green filled circle
            let image = NSImage(systemSymbolName: "circle.fill", accessibilityDescription: "Enabled")
            button.image = image?.withSymbolConfiguration(config)
            button.contentTintColor = .systemGreen
        } else {
            // Gray outline circle
            let image = NSImage(systemSymbolName: "circle", accessibilityDescription: "Disabled")
            button.image = image?.withSymbolConfiguration(config)
            button.contentTintColor = .secondaryLabelColor
        }
    }

    @objc private func togglePopover() {
        if popover.isShown {
            popover.performClose(nil)
        } else {
            if let button = statusItem.button {
                popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            }
        }
    }

    @objc private func scrollStateDidChange(_ notification: Notification) {
        if let isEnabled = notification.userInfo?["isEnabled"] as? Bool {
            updateIcon(isEnabled: isEnabled)
        }
    }
}

// Notification name
extension Notification.Name {
    static let scrollStateDidChange = Notification.Name("scrollStateDidChange")
}
```

---

## 8. Testing Checklist

- [ ] Menu bar icon shows green dot when enabled
- [ ] Menu bar icon shows gray dot when disabled
- [ ] Popover opens on menu bar click
- [ ] Popover closes on click outside (transient behavior)
- [ ] Smooth Scroll toggle works (IPC → Rust)
- [ ] Speed preset picker works
- [ ] Horizontal Scroll toggle works
- [ ] Zoom toggle works
- [ ] Direction Sync toggle works
- [ ] Quit from menu bar works (⌘Q)
- [ ] About panel works
- [ ] State persists after app restart
- [ ] Auto-reconnect after Rust restart

---

## 9. Files to Delete

```
macos/SmoothScrollMenuBar/Sources/Views/
  - DirectionSyncSection.swift      ← DELETE
  - SmoothScrollSection.swift        ← DELETE
  - PresetShortcutsView.swift        ← DELETE
  - SettingsRow.swift                 ← DELETE
  - DeviceDirectionCard.swift        ← DELETE
  - VisualEffectBlur.swift           ← KEEP
```

---

## 10. Summary of Changes

| Category | Changes |
|----------|---------|
| UI | Native macOS popover, `.ultraThinMaterial`, no icons/emojis |
| Menu Bar | Status dot icon (green/gray), standard macOS menu dropdown |
| IPC | Fixed socket path, auto-reconnect, all commands implemented |
| State | Proper sync, `@ObservedObject` for singleton, type-safe enum |
| Code | Delete 5 unused view files, add 1 model file |

---

## 11. Key Fixes from v1

| Issue | Fix |
|-------|-----|
| `@StateObject` with singleton | Changed to `@ObservedObject` |
| `VisualEffectBlur` custom view | Changed to `.ultraThinMaterial` |
| IPC method names mismatch | Fixed to `set_scroll_enabled`, `get_scroll_enabled` |
| Quit in popover | Moved to standard menu bar dropdown |
| Status dot in popover | Moved to menu bar icon |
| No reconnection logic | Added auto-reconnect loop |
| String-based preset | Added `ScrollPreset` enum |
| Async init issues | Added `loadInitialState()` method |
