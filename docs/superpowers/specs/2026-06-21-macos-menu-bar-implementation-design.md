# SmoothScroll macOS — Implementation Spec

> **Date:** June 21, 2026
> **Status:** Implementation Guide
> **Goal:** Fix all critical bugs + implement clean macOS menu bar UI

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              macOS Menu Bar (NSStatusItem)              │
│                                                          │
│   [SmoothScroll]  ← Click → NSPopover                   │
│                            │                            │
│                            ▼                            │
│   [SwiftUI PopoverView] ◄──► [Rust IPC Socket]         │
│                            │     (Unix Domain Socket)    │
│                            ▼                            │
│   [Rust Engine + CGEventTap]                            │
│   - Smooth scroll, horizontal, zoom                      │
│   - Direction sync                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. UI Specification

### 2.1 Popover Dimensions
- **Width:** 280pt (standard macOS popover)
- **Height:** Auto-sizing, ~220pt content

### 2.2 Visual Design

| Element | Style |
|---------|-------|
| Background | `VisualEffectView(material: .popover)` — native vibrancy |
| Typography | System font, sizes: 13pt (title), 12pt (labels) |
| Spacing | 8pt grid, 12pt horizontal padding, 10pt vertical spacing |
| Colors | `.primary`, `.secondary`, `.accentColor` — system colors |
| Corner radius | System default (NSPopover handles this) |

### 2.3 Layout Structure

```
┌──────────────────────────────────────────────┐
│ SmoothScroll                           ●     │  ← Status dot (green=enabled, gray=disabled)
├──────────────────────────────────────────────┤
│                                              │
│  Smooth Scroll                        [  ●  ] │  ← Toggle
│                                              │
│  Speed                  [Balanced|Snappy|Glide] │  ← Segmented Picker
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  Horizontal Scroll                     [  ●  ] │  ← Toggle
│  Zoom                                    [  ●  ] │  ← Toggle
│  Direction Sync                          [  ●  ] │  ← Toggle
│                                              │
├──────────────────────────────────────────────┤
│  Quit                                          │  ← Button
└──────────────────────────────────────────────┘
```

### 2.4 NO Icons Policy
- Không dùng emoji hoặc icon cho các toggle items
- Không có icon trong header
- Status indicator là dot duy nhất (cần thiết để biết ON/OFF từ xa)

---

## 3. Functionality Specification

### 3.1 Core Features

| Feature | Implementation | IPC Command |
|---------|---------------|-------------|
| Smooth Scroll Toggle | `enabled` state | `set_enabled(bool)` |
| Speed Preset | `active_profile` setting | `set_preset("balanced"\|"snappy"\|"glide")` |
| Horizontal Scroll | `enable_horizontal` setting | `set_enable_horizontal(bool)` |
| Zoom | `enable_zoom` setting | `set_enable_zoom(bool)` |
| Direction Sync | `reverse_wheel_direction` setting | `set_direction_sync(bool)` |
| Quit | Terminate app | `quit()` |

### 3.2 State Sync Flow

```
App Launch:
  Swift ──connect()──► Rust IPC
                         │
                         ▼
  Swift ◄──init state─── Rust (event: scroll_state_changed, etc.)
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
                             Engine updates
                                   │
                                   ▼
                             Broadcast event to all clients
```

### 3.3 Status Indicator Logic

| State | Dot Color | When |
|-------|-----------|------|
| Enabled | `.green` | `scrollEnabled == true` |
| Disabled | `.gray` | `scrollEnabled == false` |

---

## 4. File Changes

### 4.1 New/Modified Swift Files

| File | Action | Changes |
|------|--------|---------|
| `SmoothScrollPopover.swift` | Replace | New layout với native macOS controls |
| `PopoverHeader.swift` | Replace | Simple header với status dot |
| `SettingsStore.swift` | Replace | Full state management với IPC sync |
| `IPCClient.swift` | Replace | Auto-connect on init, proper error handling |
| `MenuBarController.swift` | Modify | Connect IPC on setup |
| `DirectionSyncSection.swift` | Delete | Not needed — inline vào popover |
| `SmoothScrollSection.swift` | Delete | Not needed — inline vào popover |
| `PresetShortcutsView.swift` | Delete | Not needed |
| `SettingsRow.swift` | Delete | Not needed |
| `DeviceDirectionCard.swift` | Delete | Not needed |

### 4.2 Rust IPC Changes

| File | Changes |
|------|---------|
| `ipc_socket_server.rs` | Fix socket path, implement direction sync, add horizontal/zoom setters |
| `commands.rs` | Add `set_enable_horizontal`, `set_enable_zoom`, `set_direction_sync` commands |

### 4.3 Socket Path Convention

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/SmoothScroll/socket` |
| Linux | `~/.config/smoothscroll/socket` (existing) |
| Windows | `%APPDATA%/com.SmoothScroll/SmoothScroll/socket` (existing) |

**Implementation note:** Use `directories` crate for cross-platform path:

```rust
// macOS: ~/Library/Application Support/SmoothScroll/
let socket_path = directories
    .data_local_dir()
    .join("SmoothScroll")
    .join("socket");
```

---

## 5. IPC Protocol

### 5.1 Commands (Swift → Rust)

| Method | Params | Returns |
|--------|--------|---------|
| `get_enabled` | none | `bool` |
| `set_enabled` | `{ enabled: bool }` | `bool` |
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

---

## 6. Implementation Steps

### Phase 1: Fix Critical Bugs

1. **Fix socket path mismatch**
   - Swift: `~/.smoothscroll/socket` → `~/Library/Application Support/SmoothScroll/socket`
   - Rust: Update to use `directories` crate

2. **Auto-connect IPC on app start**
   - `MenuBarController.setup()` → call `IPCClient.shared.connect()`
   - Handle connection errors gracefully

3. **Implement Direction Sync**
   - Rust: Wire `reverse_wheel_direction` to IPC
   - Swift: Add `directionSyncEnabled` to SettingsStore

4. **Add Horizontal Scroll + Zoom IPC**
   - Rust: Add commands for `enable_horizontal` and `enable_zoom`
   - Swift: Add to SettingsStore

### Phase 2: UI Rewrite

1. **New SmoothScrollPopover.swift**
   - Native SwiftUI layout
   - No icons, no emojis
   - Use `Toggle` with `.toggleStyle(.switch)`
   - Use `Picker` with `.pickerStyle(.segmented)`

2. **Simplified PopoverHeader**
   - App name only
   - Status dot (green/gray based on enabled state)

3. **Delete unused views**
   - Remove all emoji/icon usage
   - Remove complex card layouts

### Phase 3: Polish

1. **Status indicator sync**
   - Header dot updates when `scrollEnabled` changes

2. **Settings persistence**
   - On change → IPC → Rust saves to disk

3. **Quit functionality**
   - `quit()` command → graceful shutdown

---

## 7. Code Examples

### 7.1 New Popover Layout

```swift
struct SmoothScrollPopover: View {
    @StateObject private var settings = SettingsStore.shared

    var body: some View {
        VStack(spacing: 0) {
            // Header
            PopoverHeader(isEnabled: settings.scrollEnabled)
                .padding(.horizontal, 12)
                .padding(.top, 12)
                .padding(.bottom, 8)

            Divider()
                .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 12) {
                // Smooth Scroll Toggle
                Toggle("Smooth Scroll", isOn: $settings.scrollEnabled)
                    .toggleStyle(.switch)

                // Speed Preset
                VStack(alignment: .leading, spacing: 4) {
                    Text("Speed")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    Picker("", selection: $settings.speedPreset) {
                        Text("Balanced").tag("balanced")
                        Text("Snappy").tag("snappy")
                        Text("Glide").tag("glide")
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: settings.speedPreset) { _, newValue in
                        Task { try? await IPCClient.shared.setPreset(newValue) }
                    }
                }

                Divider()

                // Horizontal Scroll
                Toggle("Horizontal Scroll", isOn: $settings.horizontalEnabled)
                    .toggleStyle(.switch)

                // Zoom
                Toggle("Zoom", isOn: $settings.zoomEnabled)
                    .toggleStyle(.switch)

                // Direction Sync
                Toggle("Direction Sync", isOn: $settings.directionSyncEnabled)
                    .toggleStyle(.switch)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider()

            // Quit Button
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .frame(width: 280)
        .padding(.bottom, 4)
        .background(VisualEffectBlur(material: .popover, blendingMode: .behindWindow))
    }
}
```

### 7.2 Simplified Header

```swift
struct PopoverHeader: View {
    let isEnabled: Bool

    var body: some View {
        HStack {
            Text("SmoothScroll")
                .font(.system(size: 13, weight: .semibold))
            Spacer()
            Circle()
                .fill(isEnabled ? Color.green : Color.gray)
                .frame(width: 8, height: 8)
        }
    }
}
```

### 7.3 SettingsStore (Full)

```swift
@MainActor
class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    @Published var scrollEnabled: Bool = false
    @Published var speedPreset: String = "balanced"
    @Published var horizontalEnabled: Bool = false
    @Published var zoomEnabled: Bool = false
    @Published var directionSyncEnabled: Bool = false

    private init() {
        Task {
            await connectAndLoad()
        }
    }

    func connectAndLoad() async {
        do {
            try await IPCClient.shared.connect()
            // Initial state will come via events
        } catch {
            print("IPC connect failed: \(error)")
        }
    }
}
```

---

## 8. Testing Checklist

- [ ] Popover opens on menu bar click
- [ ] Popover closes on click outside
- [ ] Smooth Scroll toggle works (IPC → Rust)
- [ ] Speed preset picker works
- [ ] Horizontal Scroll toggle works
- [ ] Zoom toggle works
- [ ] Direction Sync toggle works
- [ ] Quit terminates app
- [ ] Status dot updates on toggle
- [ ] State persists after app restart

---

## 9. Files to Delete

```
macos/SmoothScrollMenuBar/Sources/Views/
  - DirectionSyncSection.swift  ← DELETE
  - SmoothScrollSection.swift    ← DELETE
  - PresetShortcutsView.swift    ← DELETE
  - SettingsRow.swift             ← DELETE
  - DeviceDirectionCard.swift    ← DELETE
  - VisualEffectBlur.swift       ← KEEP (still needed)
```

---

## 10. Summary of Changes

| Category | Changes |
|----------|---------|
| UI | Rewrite to native macOS, remove all icons/emojis |
| IPC | Fix socket path, add missing commands |
| State | Proper sync between Swift ↔ Rust |
| Features | Add horizontal scroll, zoom, direction sync IPC |
| Code | Delete 5 unused view files |
