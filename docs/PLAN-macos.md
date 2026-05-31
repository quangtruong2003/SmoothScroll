# macOS Menu Bar App — Implementation Plan

> **Goal:** Implement macOS Menu Bar app with full Smooth Scroll + Direction Sync support.
> **Based on:** `docs/SPEC-macos.md`

---

## Phase 0: Preparation

### 0.1 Create macOS directory scaffold

```
macos/
  SmoothScrollMenuBar/
    project.yml              # XcodeGen
    Sources/
      App/
        main.swift
        AppDelegate.swift
      MenuBar/
        MenuBarController.swift
      Views/
        SmoothScrollPopover.swift
        SmoothScrollSection.swift
        DirectionSyncSection.swift
        PresetShortcutsView.swift
        SettingsRow.swift
        VisualEffectBlur.swift
      IPC/
        IPCClient.swift
        IPCProtocol.swift
      Settings/
        SettingsStore.swift
      Resources/
        Info.plist
        SmoothScrollMenuBar.entitlements
```

### 0.2 Create macOS Rust IPC socket server

The Rust engine needs to expose a Unix domain socket for the Swift app to communicate with. This is a new module added to `src-tauri/`.

```
src-tauri/src/
  ipc_socket_server.rs    # NEW: Unix socket JSON-RPC server
```

The Swift app connects to this socket to:
- Read/write settings
- Toggle smooth scroll
- Toggle direction sync
- Get preset info

---

## Phase 1: Rust macOS Platform Layer

**Files to modify:**

### 1.1 `crates/platform/src/macos/event_tap.rs` (NEW)
- `CGEventTap` for scroll interception at `kCGHIDEventTap`
- Classify trackpad vs mouse from event flags
- Route to `HookEventSink` with `InputSource` classification
- Emit synthetic wheel events via `CGEvent` + `CGEvent.post()`
- Handle accessibility permission check first

**Key APIs:**
- `CGEvent.tapCreate()` with `kCGHIDEventTap` location, `kCGHeadInsertEventTap` placement
- Event types: `kCGEventScrollWheel`, `kCGEventTabletPointer`
- `CGEvent.getIntegerValueField(.scrollWheelEventPointDeltaAxis1)` for delta
- `CGEvent.getIntegerValueField(.scrollWheelEventIsContinuous)` for trackpad detection

### 1.2 `crates/platform/src/macos/wheel_emitter.rs`
- Replace stub with real implementation using `CGEvent.post()` for wheel injection
- `CGEvent` with `kCGEventScrollWheel` type
- Set `scrollingDeltaX` / `scrollingDeltaY` for pixel-accurate emission

### 1.3 `crates/platform/src/macos/mouse_hook.rs`
- Wrap `event_tap.rs` implementation to implement `MouseHook` trait
- `install(sink)` → creates event tap, wires to sink
- RAII: drop event tap on `HookHandle` drop

### 1.4 `crates/platform/src/macos/permissions.rs`
- `AXIsProcessTrustedWithOptions()` via objc2
- Request permission if `_prompt = true`
- Return trust status

### 1.5 `crates/platform/src/macos/process_query.rs`
- Already has `foreground_process_name()` via objc2
- Add `process_name_under_cursor()` using `NSWorkspace.shared().frontmostApplication`
- Add `foreground_process_id()`
- Add `list_visible_processes()` using `NSWorkspace.shared().runningApplications`

### 1.6 `crates/platform/src/macos/fullscreen.rs`
- Use `CGWindowListCopyWindowInfo()` to detect fullscreen windows
- Check if foreground app's main window has fullscreen option set

### 1.7 `crates/platform/src/macos/window_geom.rs`
- Use `NSWorkspace.shared().frontmostApplication` for window info
- Use `NSScreen.main` for cursor position
- Or use `CGEvent` for cursor position

### 1.8 `crates/platform/Cargo.toml` (MODIFY)
Add new dependencies for macOS:
```toml
[target.'cfg(target_os = "macos")'.dependencies]
# Existing:
objc2 = { version = "0.5", default-features = false, features = ["std"] }
objc2-app-kit = { version = "0.2", default-features = false, features = ["std", "NSWorkspace", "NSRunningApplication", "NSResponder"] }
objc2-foundation = { version = "0.2", default-features = false, features = ["std", "NSString"] }

# NEW:
core-foundation = "0.10"
core-graphics = "0.19"
dispatch = "2"
```

### 1.9 `crates/platform/src/lib.rs` (MODIFY)
Add `ZoomEmitter` implementation to macOS `Platform` bundle. Currently missing from `build()`.

---

## Phase 2: Rust IPC Socket Server (src-tauri)

### 2.1 `src-tauri/src/ipc_socket_server.rs` (NEW)
- Unix domain socket at `~/.smoothscroll/socket`
- JSON-RPC 2.0 over the socket
- Commands handled:
  - `get_scroll_enabled` / `set_scroll_enabled`
  - `get_direction_sync_enabled` / `set_direction_sync_enabled`
  - `get_preset` / `set_preset`
  - `get_settings` / `save_settings`
  - `quit`
- Events emitted to Swift: `scroll_state_changed`, `direction_sync_changed`, `preset_changed`

### 2.2 `src-tauri/src/lib.rs` (MODIFY)
- Initialize IPC socket server in `run()` after engine is set up
- Spawn server on a dedicated thread

### 2.3 `src-tauri/Cargo.toml` (MODIFY)
Add dependency for Unix socket server:
```toml
# Unix socket IPC
tokio = { version = "1", features = ["net"] }
serde_json = "1"
```

---

## Phase 3: Swift Menu Bar App

### 3.1 `project.yml` (XcodeGen)
- Bundle ID: `com.SmoothScroll.MenuBar`
- LSUIElement = true (no Dock icon)
- Deployment target: macOS 13.0+
- Swift 5.9
- Entitlements file

### 3.2 `Sources/App/main.swift`
- `NSApplication.shared.run()` (no @main)
- Create `AppDelegate`
- Handle `NSApplicationWillTerminateNotification` for cleanup

### 3.3 `Sources/App/AppDelegate.swift`
- `applicationDidFinishLaunching` → setup menu bar
- Store reference to `MenuBarController`
- Handle global hotkey events via `NSEvent.addGlobalMonitorForEvents`

### 3.4 `Sources/MenuBar/MenuBarController.swift`
- `NSStatusItem` with template image
- `NSPopover` with `PopoverViewController`
- Toggle on click
- Status indicator (green dot when active)
- Connect to Rust IPC socket on init

### 3.5 `Sources/Views/SmoothScrollPopover.swift`
- Main SwiftUI view hosting both sections
- `VisualEffectBlur` background
- Width: 300pt, padding: 16pt

### 3.6 `Sources/Views/SmoothScrollSection.swift`
- Toggle switch for smooth scroll
- Speed slider (Balanced/Snappy/Glide)
- Visual speed indicator

### 3.7 `Sources/Views/DirectionSyncSection.swift`
- Toggle for Direction Sync
- Visual diagram: trackpad vs mouse direction
- Real-time visual feedback

### 3.8 `Sources/Views/PresetShortcutsView.swift`
- Footer with ⌘1/2/3 preset buttons
- ⌘D toggle direction sync
- ⌘, open System Settings
- ⌘Q quit

### 3.9 `Sources/IPC/IPCClient.swift`
- Connect to Unix socket at `~/.smoothscroll/socket`
- Send JSON-RPC requests
- Receive events via socket reader thread
- Reconnect on disconnect
- @Published properties for SwiftUI binding

### 3.10 `Sources/Settings/SettingsStore.swift`
- `@Published` properties mirroring Rust settings
- Sync with Rust via IPCClient
- Debounced writes

### 3.11 `Sources/Resources/Info.plist`
```xml
<key>LSUIElement</key>
<true/>
<key>NSAppleEventsUsageDescription</key>
<string>SmoothScroll needs accessibility access to intercept scroll events.</string>
```

### 3.12 `Sources/Resources/SmoothScrollMenuBar.entitlements`
```xml
<key>com.apple.security.app-sandbox</key>
<false/>
<!-- Or use specific exceptions for event tap -->
```

---

## Phase 4: CI/CD

### 4.1 `.github/workflows/auto-release.yml` (MODIFY)
Enable the commented-out `build-macos` job with modifications:
- Remove Tauri build (we're building Swift, not Tauri)
- Add steps to build Rust library + Swift app
- Generate `.dmg` via `create-dmg`
- Notarize with `xcrun notarytool`
- Upload to GitHub Release with `beta.json`

---

## Phase 5: Testing

### 5.1 Local Testing Checklist
- [ ] Menu bar icon appears on launch
- [ ] Popover opens/closes on click
- [ ] Smooth scroll works in Safari, Chrome, Finder
- [ ] Direction sync correctly inverts mouse scroll direction
- [ ] ⌘1/2/3 preset switching works
- [ ] ⌘D toggles direction sync
- [ ] App survives sleep/wake
- [ ] Multiple monitors work correctly
- [ ] Dark/Light mode transitions work

---

## Dependency Order

```
Phase 0 (scaffold)
    │
    ▼
Phase 2 (IPC socket server in Rust)     Phase 1 (macOS Rust platform impl)
    │                                         │
    │    ┌───────────────────────────────────┘
    ▼    ▼
Phase 3 (Swift Menu Bar app)
    │
    ▼
Phase 4 (CI/CD)
    │
    ▼
Phase 5 (Testing)
```

---

## Key Technical Challenges

| Challenge | Solution |
|---|---|
| CGEventTap accessibility requirement | Check `AXIsProcessTrustedWithOptions()` before creating tap. Show system prompt. |
| Wheel event classification (trackpad vs mouse) | Check `kCGScrollWheelEventIsContinuous` + delta granularity |
| Direction sync (invert mouse scroll) | Store original delta, invert sign, emit replacement event |
| Swift ↔ Rust IPC | Unix domain socket with JSON-RPC 2.0 |
| App Nap preventing scroll interception | `ProcessInfo.processInfo.beginActivity(options: .userInitiated)` |
| SwiftUI vibrancy background | `NSVisualEffectView` wrapper with `.popover` material |
| Global hotkeys (background app) | Carbon `RegisterEventHotKey` + `NSEvent.addGlobalMonitorForEvents` |
| No Dock icon | `LSUIElement = true` in Info.plist |
| macOS notarization | `xcrun notarytool` + stapling in CI |
| Settings sync between Rust engine + Swift UI | Unix socket RPC, both sides read same JSON file |

---

## File Manifest

### New files (Phase 1-3)
| File | Phase | Description |
|---|---|---|
| `crates/platform/src/macos/event_tap.rs` | 1 | CGEventTap scroll interception |
| `macos/SmoothScrollMenuBar/project.yml` | 3 | XcodeGen project |
| `macos/SmoothScrollMenuBar/Sources/App/main.swift` | 3 | App entry point |
| `macos/SmoothScrollMenuBar/Sources/App/AppDelegate.swift` | 3 | App lifecycle |
| `macos/SmoothScrollMenuBar/Sources/MenuBar/MenuBarController.swift` | 3 | NSStatusItem + NSPopover |
| `macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollPopover.swift` | 3 | Main popover view |
| `macos/SmoothScrollMenuBar/Sources/Views/SmoothScrollSection.swift` | 3 | Smooth scroll section |
| `macos/SmoothScrollMenuBar/Sources/Views/DirectionSyncSection.swift` | 3 | Direction sync section |
| `macos/SmoothScrollMenuBar/Sources/Views/PresetShortcutsView.swift` | 3 | Shortcuts footer |
| `macos/SmoothScrollMenuBar/Sources/Views/SettingsRow.swift` | 3 | Reusable toggle row |
| `macos/SmoothScrollMenuBar/Sources/Views/VisualEffectBlur.swift` | 3 | Vibrancy wrapper |
| `macos/SmoothScrollMenuBar/Sources/IPC/IPCClient.swift` | 3 | Unix socket client |
| `macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift` | 3 | IPC message types |
| `macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift` | 3 | Settings state |
| `macos/SmoothScrollMenuBar/Sources/Resources/Info.plist` | 3 | App Info.plist |
| `macos/SmoothScrollMenuBar/Sources/Resources/SmoothScrollMenuBar.entitlements` | 3 | Entitlements |
| `src-tauri/src/ipc_socket_server.rs` | 2 | IPC socket server |

### Modified files
| File | Phase | Change |
|---|---|---|
| `crates/platform/src/macos/wheel_emitter.rs` | 1 | Replace stub with real CGEvent emission |
| `crates/platform/src/macos/mouse_hook.rs` | 1 | Wrap event_tap in MouseHook trait |
| `crates/platform/src/macos/permissions.rs` | 1 | Implement `is_trusted()` with AX API |
| `crates/platform/src/macos/process_query.rs` | 1 | Implement remaining methods |
| `crates/platform/src/macos/fullscreen.rs` | 1 | Real fullscreen detection |
| `crates/platform/src/macos/window_geom.rs` | 1 | Real window geometry |
| `crates/platform/src/macos/mod.rs` | 1 | Wire everything together |
| `crates/platform/Cargo.toml` | 1 | Add core-foundation, core-graphics, dispatch |
| `crates/platform/src/lib.rs` | 1 | Add ZoomEmitter to macOS Platform bundle |
| `src-tauri/src/lib.rs` | 2 | Spawn IPC socket server thread |
| `src-tauri/Cargo.toml` | 2 | Add tokio dependency |
| `.github/workflows/auto-release.yml` | 4 | Enable and update build-macos job |
