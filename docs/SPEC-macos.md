# SmoothScroll macOS — Specification

> **Date:** June 2026
> **Status:** Draft

---

## 1. Overview

SmoothScroll macOS is a Menu Bar utility app that intercepts scroll events at the macOS layer and applies smooth-scrolling physics — matching the behavior of the existing Windows Tauri app, but implemented as a native macOS application using a hybrid Rust/Swift architecture.

### Goals

- Smooth scrolling acceleration on macOS (trackpad + mouse)
- Direction Sync: unify trackpad and mouse scroll direction (fixes the "natural scrolling" mismatch)
- Menu Bar-only UI: no Dock icon, no separate settings window, preferences link to System Settings
- Shared Rust scroll engine with Windows build
- Native macOS look-and-feel using SwiftUI + AppKit

### Non-Goals

- Settings window (Preferences → System Settings)
- Windows-style system tray window (use macOS Menu Bar Popover)
- Full onboarding wizard in-app (link to docs)
- Cross-compilation from Windows (build on macOS for macOS)

---

## 2. Architecture

### Hybrid: Rust Backend + SwiftUI Menu Bar App

```
┌─────────────────────────────────────────────────────────┐
│                    macOS Menu Bar                       │
│                                                          │
│   [🐭 SmoothScroll]  ← NSStatusItem (always visible)    │
│         │                                               │
│         ▼ (click)                                       │
│   [NSPopover + SwiftUI PopoverView]                    │
│         │                                               │
│         │ Tauri IPC (invoke/emit over Unix socket)      │
│         ▼                                               │
│   [Rust: SmoothScroll Engine + CGEventTap]              │
│                                                          │
└─────────────────────────────────────────────────────────┘

Key difference from Windows: macOS uses a SEPARATE Swift menu bar
app that communicates with the Rust engine via Tauri IPC — not embedded
in a WebView like the Windows app.
```

### Why Separate Swift App vs. Tauri WebView?

| Approach | Pros | Cons |
|---|---|---|
| **Tauri WebView** (like Windows) | Single binary, shared UI code | WebView popup looks "off" in macOS Menu Bar context |
| **Separate Swift app** | Native popover, vibrancy, AppKit gestures | Two processes, IPC complexity |

Decision: **Separate Swift app** — the native Menu Bar popover with `NSVisualEffectView` vibrancy is the core UX feature. A WebView can't replicate this.

### Communication: Swift ↔ Rust

Two options for IPC between the Swift Menu Bar app and Rust engine:

| Option | Mechanism | Complexity |
|---|---|---|
| **A) Tauri IPC** | Same `invoke()`/`emit()` pattern used by Windows frontend. Swift uses `Tauri IPC Protocol` over Unix domain socket. Requires embedding Tauri IPC client in Swift. | Medium |
| **B) Unix Domain Socket** | Rust exposes a simple JSON-RPC socket server. Swift connects via `NWConnection`. Clean, no Tauri coupling. | Low |
| **C) App Groups + File** | Swift writes to shared UserDefaults (App Group). Rust reads and reacts. Polling-based. | Lowest |

Decision: **Option B (Unix Domain Socket)** — cleanest separation, no Tauri coupling on Swift side, simple JSON-RPC protocol over a Unix socket at `~/.smoothscroll/socket`.

Alternative: If Tauri supports embedded-mode (Rust library + Swift binary), we could use Tauri IPC directly.

---

## 3. User Experience

### 3.1 Menu Bar Extra (NSStatusItem)

- **Icon:** Template image `scroll.fill` (SF Symbol) — adapts to light/dark automatically
- **Click action:** Opens NSPopover below the status item
- **Status indicator:** Small colored dot overlay when engine is active:
  - Green dot → Smooth Scroll ON
  - Orange dot → Direction Sync ON (scroll disabled or partial)
  - No dot → Smooth Scroll OFF

### 3.2 Popover Layout

```
┌─────────────────────────────────────────────────┐
│ 🐭 SmoothScroll                    v1.3.1  [◉] │  ← Header (green dot = ON)
├─────────────────────────────────────────────────┤
│                                                 │
│  🌊 Smooth Scroll                               │  ← Section 1
│  ┌───────────────────────────────────────────┐  │
│  │ Enable                             [═══◉] │  │  ← Toggle
│  │ Speed                               ●──○  │  │  ← Slider
│  └───────────────────────────────────────────┘  │
│                                                 │
│  🔄 Direction Sync                              │  ← Section 2
│  ┌───────────────────────────────────────────┐  │
│  │ Sync Trackpad & Mouse               [◉──] │  │  ← Toggle
│  │                                           │  │
│  │  💻 Trackpad         🖱️ Mouse           │  │  ← Visual
│  │  Natural ◉────────   ────────○ Synced    │  │  ← Comparison
│  └───────────────────────────────────────────┘  │
│                                                 │
├─────────────────────────────────────────────────┤
│  ⌘1 Balanced  ⌘2 Snappy  ⌘3 Glide             │  ← Preset shortcuts
│  ⌘D DirSync  ⌘, Prefs  ⌘Q Quit              │  ← Action shortcuts
└─────────────────────────────────────────────────┘
```

- **Width:** 300pt
- **Height:** ~340pt (auto-sizing)
- **Background:** `NSVisualEffectView` with `.popover` material (vibrancy blur)
- **Corner radius:** System default for NSPopover

### 3.3 Keyboard Shortcuts (Global)

| Shortcut | Action |
|---|---|
| `⌘1` | Set Balanced preset |
| `⌘2` | Set Snappy preset |
| `⌘3` | Set Glide preset |
| `⌘D` | Toggle Direction Sync |
| `⌘,` | Open System Settings |
| `⌘Q` | Quit SmoothScroll |
| `Escape` | Close popover |

These are **global hotkeys** — work even when app is in background.

### 3.4 Direction Sync UX

The core pain point this app solves:

1. macOS "Natural Scrolling" makes trackpad scroll direction match physical finger direction (swipe up → content up)
2. Mouse scroll wheel works the OPPOSITE way (scroll down → content up)
3. This creates cognitive dissonance when switching between trackpad and mouse

**When Direction Sync is ON:**
- Both trackpad and mouse scroll in the same direction
- macOS `CGEventTap` detects whether the event came from trackpad or mouse
- Trackpad: pass through (natural scrolling = ON in System Settings)
- Mouse: invert the scroll direction so it matches trackpad
- **User experience:** scroll direction feels consistent regardless of input device

**Visual feedback:**
- Show a comparison diagram in the popover
- Each device shows its current scroll direction mode
- Toggle changes both visual state and applies immediately

---

## 4. Rust Backend — macOS Implementation

### 4.1 Architecture

The Rust engine (`crates/core`) is platform-agnostic. The macOS-specific layer lives in `crates/platform/src/macos/`, replacing the stub implementations.

```
crates/
  core/                    # Platform-agnostic scroll engine
    src/
      engine.rs           # SmoothScrollEngine (unchanged)
      settings.rs         # AppSettings, EffectiveSettings (unchanged)
      easing.rs           # Easing curves (unchanged)
      ...
  platform/                # OS-specific implementations
    src/
      traits.rs           # Platform traits (unchanged)
      types.rs            # Shared types (unchanged)
      macos/
        mod.rs            # macos::build() — wires traits to real impls
        event_tap.rs      # CGEventTap for scroll interception
        wheel_emitter.rs  # CGEvent/postEvent for wheel emission
        hotkey.rs         # Carbon RegisterEventHotKey (global hotkeys)
        process_query.rs  # NSRunningApplication for foreground app
        autostart.rs      # LSSharedFileList / SMAppService for login item
        fullscreen.rs     # CGWindowList for fullscreen detection
        window_geom.rs    # CGWindowList for window geometry
        permissions.rs    # AXIsProcessTrustedWithOptions (ALREADY IMPLEMENTED)
```

### 4.2 Event Tap (Scroll Interception)

```swift
// Concept: Use CGEventTap to intercept wheel events at HID level
// Location: crates/platform/src/macos/event_tap.rs

// Process:
// 1. Request accessibility permission via AXIsProcessTrustedWithOptions
// 2. Create CGEventTap at kHIDSystemDefinedScroll granularity
// 3. In callback:
//    - Classify input source (trackpad vs mouse) by event flags
//    - Pass to SmoothScrollEngine for smooth animation
//    - If engine has pending steps: CREATE new wheel events to replace real ones
//    - If no engine work: return original event unchanged
// 4. Event tap runs at kCGHIDEventTap (system-wide)
```

**Key APIs:**
- `CGEvent.tapCreate()` — create event tap at `kCGHIDEventTap`
- `CGEvent(source: nil, eventRef: ptr)` — create new events
- `CGEvent.post(tap: 0, event:)` — inject wheel events
- `CGEvent.getIntegerValueField(.scrollWheelEventPointDeltaAxis1)` — read delta

**Event Classification (Trackpad vs Mouse):**
- macOS marks trackpad scroll with `kCGScrollWheelEventIsContinuous`
- Mouse wheel events have `deltaAxis1/2` in "notch" units (not pixels)
- High-resolution trackpad uses `kCGScrollWheelEventIsContinuous` + fractional deltas
- Use event source process ID (`kCGEventSourceUserData`) to check for AppleHIDUsagePage

### 4.3 Wheel Emitter (Event Injection)

```swift
// Concept: Post CGEvent wheel events to replace real ones
// Location: crates/platform/src/macos/wheel_emitter.rs

// Process:
// 1. Take accumulated scroll steps from SmoothScrollEngine
// 2. Convert to CGEvent with appropriate delta
// 3. Post via CGEvent.post(tap: kCGHIDEventTap, event:)
// 4. Zero out original event's delta (or let it pass with swallow)

// Key challenge: We need to SAMPLE the event before forwarding it,
// then EMIT replacement events. With CGEventTap this is possible
// at kCGSessionEventTap with kCGHeadInsertEventTap mode.
```

### 4.4 Global Hotkeys

Use **Carbon's `RegisterEventHotKey`** (cross-process, works from background app) or modern **Media Keys service** via `AXUIElement`.

Note: macOS 14+ has `CGEventTap` for key events, but simpler is `CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap)`.

### 4.5 Settings Persistence

Same approach as Windows: JSON file at `~/Library/Application Support/SmoothScroll/settings.json`.

Rust reads/writes via `directories` crate. Swift reads via AppKit `UserDefaults` or file read.

**IPC Socket Server (Rust side):**
```
~/.smoothscroll/socket  (Unix domain socket)
Protocol: JSON-RPC 2.0
Methods:
  - get_scroll_enabled() → bool
  - set_scroll_enabled(bool)
  - get_direction_sync_enabled() → bool
  - set_direction_sync_enabled(bool)
  - get_preset() → str
  - set_preset("balanced" | "snappy" | "glide")
  - get_settings() → AppSettings JSON
  - save_settings(AppSettings JSON)
  - quit()
Events (server → client):
  - scroll_state_changed { enabled: bool }
  - direction_sync_changed { enabled: bool }
  - preset_changed { preset: str }
```

### 4.6 Accessibility Permission Flow

1. On first launch, check `AXIsProcessTrustedWithOptions()`
2. If not trusted: show system permission dialog (standard macOS flow)
3. If denied: app shows limited UI (no smooth scroll, can still toggle direction sync)
4. Settings link opens **System Settings → Privacy & Security → Accessibility**

---

## 5. Swift Menu Bar App

### 5.1 Project Structure

```
macos/
  SmoothScrollMenuBar/
    project.yml              # XcodeGen project definition
    Sources/
      App/
        main.swift           # Application entry point
        AppDelegate.swift    # NSApplicationDelegate
      MenuBar/
        MenuBarController.swift      # NSStatusItem management
        PopoverViewController.swift  # NSPopover hosting
      Views/
        SmoothScrollPopover.swift    # Main popover SwiftUI view
        SmoothScrollSection.swift    # Section 1: Smooth Scroll toggle + slider
        DirectionSyncSection.swift  # Section 2: Direction Sync toggle + visual
        PresetShortcutsView.swift    # Footer with keyboard shortcuts
        SettingsRow.swift           # Reusable toggle row
      IPC/
        IPCClient.swift              # Unix socket JSON-RPC client
        IPCProtocol.swift            # IPC message types
      Settings/
        SettingsStore.swift          # Observable settings state
      Resources/
        Assets.xcassets/             # App icon, status bar icons
        SmoothScrollMenuBar.entitlements
    SmoothScrollMenuBar.entitlements
```

### 5.2 SwiftUI Popover View

```swift
struct SmoothScrollPopover: View {
    @StateObject private var settings = SettingsStore()
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 0) {
            PopoverHeader()

            Divider()

            SmoothScrollSection(
                enabled: $settings.scrollEnabled,
                speed: $settings.speed
            )

            Divider()

            DirectionSyncSection(
                enabled: $settings.directionSyncEnabled
            )

            Divider()

            PresetShortcutsFooter()
        }
        .frame(width: 300)
        .padding(16)
        .background(
            VisualEffectBlur(material: .popover, blendingMode: .behindWindow)
        )
    }
}

// NSVisualEffectView wrapper
struct VisualEffectBlur: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    let blendingMode: NSVisualEffectView.BlendingMode
    // ...
}
```

### 5.3 IPC Client (Swift)

```swift
class IPCClient: ObservableObject {
    private var socket: UnixSocketConnection?
    private let socketPath = FileManager.default
        .homeDirectoryForCurrentUser
        .appendingPathComponent(".smoothscroll/socket")

    func invoke<T: Decodable>(_ method: String, params: [String: Any] = [:]) async throws -> T
    func send(_ method: String, params: [String: Any] = [:]) async throws

    // Convenience methods
    func getScrollEnabled() async throws -> Bool
    func setScrollEnabled(_ enabled: Bool) async throws
    func getDirectionSyncEnabled() async throws -> Bool
    func setDirectionSyncEnabled(_ enabled: Bool) async throws
    func setPreset(_ preset: Preset) async throws
}
```

### 5.4 App Lifecycle

1. **Launch** → `main.swift` → `NSApplication.shared.run()` → `AppDelegate`
2. **`applicationDidFinishLaunching`** → `MenuBarController.shared.setup()`
3. **Menu Bar Icon appears** → NSStatusItem in system menu bar
4. **App is agent** (LSUIElement = true) → no Dock icon
5. **Click icon** → NSPopover slides down
6. **Quit** → `⌘Q` → cleanup → exit

**Info.plist entries:**
```xml
<key>LSUIElement</key>
<true/>
<key>NSAppleEventsUsageDescription</key>
<string>SmoothScroll needs accessibility access to intercept scroll events.</string>
```

### 5.5 Entitlements

```
com.apple.security.app-sandbox = false  (for CGEventTap, requires system extension OR disabled sandbox)
```

**Alternative (sandboxed):**
- Use `com.apple.security.temporary-exception.mach-lookup.global-name` for event tap
- Or: Don't sandbox (CGEventTap requires it anyway)

---

## 6. Build System

### 6.1 Build Pipeline

```
macOS Build (CI):
  1. Install Rust (via rustup)
  2. Build Rust engine: cargo build --release -p smoothscroll-app --features macos
  3. Build Swift app: xcodebuild -project macos/SmoothScrollMenuBar/SmoothScrollMenuBar.xcodeproj
  4. Bundle: productbuild --package for .pkg OR create-dmg for .dmg
  5. Notarize: xcrun notarytool (requires Apple Developer credentials)
  6. Staple: xcrun stapler staple
  7. Output: SmoothScroll_<version>_arm64.dmg, SmoothScroll_<version>_x86_64.dmg
```

### 6.2 Rust Build Configuration

```toml
# Cargo.toml — new feature flag
[features]
default = ["windows"]
macos = ["crates/platform/macos-impl"]
```

### 6.3 XcodeGen

```yaml
# macos/project.yml
name: SmoothScrollMenuBar
options:
  bundleIdPrefix: com.SmoothScroll
  deploymentTarget:
    macOS: "13.0"
targets:
  SmoothScrollMenuBar:
    type: application
    platform: macOS
    sources: [Sources]
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.SmoothScroll.MenuBar
      INFOPLIST_FILE: Sources/Resources/Info.plist
      CODE_SIGN_ENTITLEMENTS: Sources/Resources/SmoothScrollMenuBar.entitlements
      ENABLE_HARDENED_RUNTIME: YES
      CODE_SIGN_IDENTITY: "-"
      SWIFT_VERSION: "5.9"
      MACOSX_DEPLOYMENT_TARGET: "13.0"
    entitlements:
      path: Sources/Resources/SmoothScrollMenuBar.entitlements
```

### 6.4 CI Configuration

Add `build-macos` job to `.github/workflows/auto-release.yml`:

```yaml
build-macos:
  runs-on: macos-14
  strategy:
    matrix:
      include:
        - arch: arm64
          target: aarch64-apple-darwin
        - arch: x64
          target: x86_64-apple-darwin
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
      with:
        targets: ${{ matrix.target }}
    - name: Build Rust
      run: |
        cargo build --release -p smoothscroll-app --features macos --target ${{ matrix.target }}
    - name: Build Swift
      run: |
        brew install xcodegen
        cd macos/SmoothScrollMenuBar
        xcodegen generate
        xcodebuild -project SmoothScrollMenuBar.xcodeproj -scheme SmoothScrollMenuBar -configuration Release -arch ${{ matrix.arch }} build
    - name: Package DMG
      run: |
        # create-dmg script
    - name: Notarize
      run: |
        xcrun notarytool submit --apple-id ${{ secrets.APPLE_ID }} ...
```

---

## 7. macOS-Specific Behavior

### 7.1 Accessibility Permission

- **First launch:** Check via `AXIsProcessTrustedWithOptions()`
- **Not trusted:** Show in-app banner + system dialog
- **Denied:** Limited mode (direction sync only, smooth scroll disabled)
- **Settings link:** Opens `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`

### 7.2 App Nap Prevention

Prevent macOS from throttling the app during idle:
```swift
ProcessInfo.processInfo.beginActivity(options: .userInitiated, reason: "Scroll event interception active")
```

### 7.3 Dark/Light Mode

- Use `NSVisualEffectView` with `.popover` material — system handles light/dark automatically
- No custom color coding — use `NSColor.labelColor`, `NSColor.secondaryLabelColor`, etc.
- SwiftUI: `.foregroundColor(.primary)`, `.foregroundColor(.secondary)`

### 7.4 Multiple Monitors

- Popover appears on the same monitor as the status item
- macOS handles this automatically via `NSPopover.show(relativeTo:of:preferredEdge:)`

### 7.5 System Sleep/Wake

- On wake from sleep: re-verify accessibility permission
- Re-attach CGEventTap if it was invalidated

---

## 8. Settings Data Model

Identical to Windows. JSON file at:
- **macOS:** `~/Library/Application Support/SmoothScroll/settings.json`
- **Windows:** `%APPDATA%/com.SmoothScroll/SmoothScroll/settings.json`

IPC allows Swift to read/write via Unix socket RPC. No duplication of settings logic.

```json
{
  "scroll": {
    "step_size_px": 100,
    "animation_time_ms": 150,
    "acceleration_delta_ms": 100,
    "acceleration_max": 5.0,
    "animation_easing": "QuinticOut",
    "easing_mode": "EaseInOut"
  },
  "direction": {
    "reverse_wheel_direction": false
  },
  "ui": {
    "language": "en",
    "theme": "system"
  },
  "onboarding_completed_at": "2026-06-01T00:00:00Z"
}
```

---

## 9. Testing Strategy

### Unit Tests (Rust)
- `crates/core/tests/` — existing engine tests
- Add macOS-specific tests in `crates/platform/tests/macos_tests.rs`

### Integration Tests
- Swift IPC client tests against running Rust socket server
- Settings round-trip tests (Rust → JSON → Swift → display)

### Manual Testing
- [ ] Menu bar icon appears on launch
- [ ] Popover opens on click
- [ ] Smooth scroll works in Safari/Chrome/Finder
- [ ] Direction sync fixes trackpad/mouse mismatch
- [ ] Global hotkeys work in background
- [ ] App survives sleep/wake
- [ ] Multiple monitors: popover on correct monitor
- [ ] Dark/Light mode transitions
- [ ] Accessibility permission flow

---

## 10. Open Questions

| # | Question | Recommendation |
|---|---|---|
| 1 | CGEventTap requires accessibility. App Nap prevention? | CGEventTap is sufficient. App Nap won't throttle event taps. |
| 2 | Binary distribution: DMG + notarization? | Yes. Apple Developer account required for notarization. |
| 3 | Auto-update for macOS? | Use `Sparkle` framework. Tauri updater doesn't work for separate Swift binary. |
| 4 | Crash reporting? | Use `CrashReporter` framework (built-in) or Sentry. |
| 5 | Settings sync between Windows/macOS? | No. Each platform has its own settings file. |
| 6 | Rosetta 2 for x86_64 on Apple Silicon? | Build universal binary (arm64 + x86_64 fat). |

---

## 11. File Changes Summary

### New Files (macOS)

```
macos/
  SmoothScrollMenuBar/
    project.yml
    Sources/
      App/main.swift
      App/AppDelegate.swift
      MenuBar/MenuBarController.swift
      MenuBar/PopoverViewController.swift
      Views/SmoothScrollPopover.swift
      Views/SmoothScrollSection.swift
      Views/DirectionSyncSection.swift
      Views/PresetShortcutsView.swift
      Views/SettingsRow.swift
      Views/VisualEffectBlur.swift
      IPC/IPCClient.swift
      IPC/IPCProtocol.swift
      Settings/SettingsStore.swift
      Resources/
        Assets.xcassets/
        Info.plist
        SmoothScrollMenuBar.entitlements
```

### Modified Files (macOS-enable existing stubs)

```
crates/platform/src/macos/mod.rs          # Replace all stubs with real impls
crates/platform/src/macos/event_tap.rs   # NEW: CGEventTap implementation
crates/platform/src/macos/wheel_emitter.rs # Replace stub with real emission
crates/platform/src/macos/hotkey.rs     # Replace stub with Carbon hotkey
crates/platform/src/macos/process_query.rs # Replace stub with real process query
crates/platform/src/macos/autostart.rs   # Replace stub with SMAppService
crates/platform/src/macos/fullscreen.rs  # Replace stub with real detection
crates/platform/src/macos/window_geom.rs # Replace stub with real geometry

Cargo.toml                              # Add macos feature flag
crates/platform/Cargo.toml              # Add objc2, core-foundation deps
crates/platform/src/lib.rs             # Add #[cfg(macos)] for macos::build()

.github/workflows/auto-release.yml     # Enable/add build-macos job

SPEC.md                                 # This document
```

### No Changes Needed
- `crates/core/**` — already platform-agnostic
- `src/**` — Windows frontend, not shared
- `src-tauri/**` — Windows Tauri app, separate from macOS
