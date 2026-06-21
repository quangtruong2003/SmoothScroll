# macOS Mouse Hook & Direction Sync Implementation Spec

**Date:** 2026-06-22
**Author:** Claude
**Status:** Draft

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Vấn đề 1: macOS Mouse Hook](#2-vấn-đề-1-macos-mouse-hook)
3. [Vấn đề 2: Direction Sync](#3-vấn-đề-2-direction-sync)
4. [Kiến trúc](#4-kiến-trúc)
5. [Implementation Plan](#5-implementation-plan)
6. [Testing](#6-testing)
7. [Edge Cases](#7-edge-cases)

---

## 1. Tổng quan

### 1.1 Mục tiêu

Fix hai vấn đề để macOS smooth scroll hoạt động đầy đủ:

1. **Mouse Hook Stub:** `MacosMouseHook` hiện tại trả về `Unsupported`. Cần implement thực sự dùng `CGEventTap`.
2. **Direction Sync:** IPC handlers không wired vào `AppState`. Cần thêm field và sync đầy đủ.

### 1.2 Background

**Kiến trúc macOS hiện tại:**
```
┌─────────────────────────────────────────────────────────┐
│ Swift Menu Bar App (SmoothScrollMenuBar)                │
│  └─ IPCClient ─── Unix Socket ──► IPCServer (Rust)    │
│                                         └─ AppState    │
│                                            └─ Engine   │
│                                                     │
│  Wheel Events ←── CGEventTap ←── ??? (STUB)          │
└─────────────────────────────────────────────────────────┘
```

**Vấn đề:**
- `MacosMouseHook::install()` → `Err(Unsupported)` 
- Engine không nhận được wheel events → smooth scroll không hoạt động

---

## 2. Vấn đề 1: macOS Mouse Hook

### 2.1 Current State

**File:** `crates/platform/src/macos/mouse_hook.rs`

```rust
impl MouseHook for MacosMouseHook {
    fn install(&self, _sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        Err(PlatformError::Unsupported)  // ← STUB
    }
}
```

**File:** `crates/platform/src/macos/event_tap.rs`

Đã có implementation hoàn chỉnh:
- `run_event_loop(sink, stop)` - blocks until `stop` is true
- `CGEventTap` setup với proper FFI
- Input classification (mouse vs trackpad)
- Modifier reading

### 2.2 Solution

**Approach:** Spawn background thread với event loop

```rust
pub struct MacosMouseHook {
    stop_flag: Arc<AtomicBool>,
    join_handle: Mutex<Option<JoinHandle<()>>>,
}

impl MouseHook for MacosMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let stop = self.stop_flag.clone();
        let join = thread::Builder::new()
            .name("ss-macos-wheel-hook".into())
            .spawn(move || {
                run_event_loop(sink, stop);
            })?;
        
        Ok(HookHandle::new(Box::new(InstalledHook {
            join: Some(join),
            stop: self.stop_flag.clone(),
        })))
    }
}

impl Drop for InstalledHook {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.join.take() {
            let _ = h.join();
        }
    }
}
```

### 2.3 Thread Safety

**Event tap lifecycle:**
1. `install()` spawns thread → thread runs `run_event_loop()`
2. `HookHandle` dropped → stop flag set → thread exits → join
3. Thread-safe via `Arc<AtomicBool>` stop flag

**Race condition prevention:**
- Stop flag checked in event loop's `while !stop.load()`
- `CALLBACK_PTR` cleared after cleanup in `run_event_loop()`

### 2.4 Accessibility Permission

**Current check in `lib.rs`:**
```rust
let trusted = smoothscroll_platform::macos::is_accessibility_trusted(false);
let hook_result = if trusted {
    app_state.mouse_hook.install(sink)
} else {
    Err(PlatformError::PermissionDenied)
};
```

**Behavior:**
- If not trusted → log warning, app runs but smooth scroll disabled
- User must grant Accessibility permission in System Settings
- No UI prompt in Rust (Swift menu bar handles this)

---

## 3. Vấn đề 2: Direction Sync

### 3.1 Current State

**Rust IPC (`ipc_socket_server.rs`):**
```rust
"get_direction_sync_enabled" => {
    // Direction sync is not yet wired into AppState — return default.
    (Some(serde_json::json!(false)), None)
}
"set_direction_sync_enabled" => {
    let _enabled = params...;
    (Some(serde_json::json!(true)), None)  // ← Always returns true, ignores input
}
```

**Swift (`SettingsStore.swift`):**
```swift
@Published var directionSyncEnabled: Bool = false
```

**Swift (`IPCProtocol.swift`):**
```swift
enum IpcEvent {
    case directionSyncChanged(enabled: Bool)  // ← Defined but never sent
}
```

### 3.2 Solution

**Step 1: Add to AppSettings and EffectiveSettings**

**File:** `crates/core/src/settings.rs`

```rust
// In AppSettings struct (around line 160-165):
// Direction & horizontal
pub horizontal_smoothness: bool,
pub horizontal_invert: bool,
pub reverse_wheel_direction: bool,
pub direction_sync_enabled: bool,  // ← ADD THIS
```

```rust
// In EffectiveSettings struct (around line 400-410):
pub reverse_wheel_direction: bool,
pub horizontal_smoothness: bool,
pub horizontal_invert: bool,
pub direction_sync_enabled: bool,  // ← ADD THIS
```

```rust
// In EffectiveSettings::from_settings():
Self {
    // ... existing fields ...
    reverse_wheel_direction: s.reverse_wheel_direction,
    horizontal_smoothness: s.horizontal_smoothness,
    horizontal_invert: s.horizontal_invert,
    direction_sync_enabled: s.direction_sync_enabled,  // ← ADD THIS
}

// In EffectiveSettings::with_profile():
Self {
    // ... existing fields ...
    reverse_wheel_direction: base.reverse_wheel_direction,
    horizontal_smoothness: base.horizontal_smoothness,
    horizontal_invert: base.horizontal_invert,
    direction_sync_enabled: base.direction_sync_enabled,  // ← ADD THIS
}
```

```rust
// In AppSettings Default impl:
direction_sync_enabled: false,  // ← ADD THIS
```

**Note:** `direction_sync_enabled` is a UI/preference setting stored in `AppSettings` but not currently read by the engine. Its semantic meaning is to sync trackpad natural scrolling direction. The engine uses `reverse_wheel_direction` for actual direction reversal.

**Step 2: Wire IPC Handlers**

**File:** `src-tauri/src/ipc_socket_server.rs`

```rust
"get_direction_sync_enabled" => {
    let settings = self.app_state.settings.read();
    (Some(serde_json::json!(settings.direction_sync_enabled)), None)
}
"set_direction_sync_enabled" => {
    let enabled = params...
    
    // Update settings
    {
        let mut settings = self.app_state.settings.write();
        settings.direction_sync_enabled = enabled;
    }
    let snapshot = self.app_state.settings.read().clone();
    self.app_state.commit_settings(snapshot);
    
    // Signal engine to refresh
    self.app_state.engine_signal.signal();
    
    // Broadcast to other clients (Swift menu bar)
    let _ = self.event_tx.send(IpcEvent::DirectionSyncChanged { enabled });
    
    (Some(serde_json::json!(true)), None)
}
```

**Step 3: Update Swift IPC Protocol**

```swift
// Add to Request Params (Swift → Rust):

struct SetDirectionSyncParams: Encodable, Sendable {
    let enabled: Bool
}
```

**File:** `macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift`

```swift
// Update IpcEvent with CodingKeys:
enum IpcEvent: Codable, Sendable {
    case scrollStateChanged(enabled: Bool)
    case presetChanged(preset: String)
    case directionSyncChanged(enabled: Bool)
    case settingsChanged(settings: AppSettingsResponse)

    enum CodingKeys: String, CodingKey {
        case scrollStateChanged = "ScrollStateChanged"
        case presetChanged = "PresetChanged"
        case directionSyncChanged = "DirectionSyncChanged"
        case settingsChanged = "SettingsChanged"
    }
}

// Add to AppSettingsResponse:
struct AppSettingsResponse: Codable, Sendable {
    // ... existing fields ...
    let directionSyncEnabled: Bool

    enum CodingKeys: String, CodingKey {
        // ... existing keys ...
        case directionSyncEnabled = "direction_sync_enabled"
    }
}
```

**Step 4: Update Swift SettingsStore**

**File:** `macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift`

```swift
// Add IPC method
func setDirectionSyncEnabled(_ enabled: Bool) async {
    let previousValue = directionSyncEnabled
    directionSyncEnabled = enabled
    
    do {
        try await IPCClient.shared.send(
            "set_direction_sync_enabled",
            params: SetDirectionSyncParams(enabled: enabled)
        ) as Bool
    } catch {
        logger.error("setDirectionSyncEnabled failed, rolling back")
        directionSyncEnabled = previousValue
    }
}

// Update handleEvent
func handleEvent(_ event: IpcEvent) {
    // ... existing cases ...
    
    case .directionSyncChanged(let enabled):
        directionSyncEnabled = enabled
}

// Update applySettings
private func applySettings(_ settings: AppSettingsResponse, source: UpdateSource) {
    // ... existing assignments ...
    directionSyncEnabled = settings.directionSyncEnabled  // ← Add this
}
```

---

## 4. Kiến trúc

### 4.1 Full macOS Architecture (After Fix)

```
┌──────────────────────────────────────────────────────────────┐
│ Swift Menu Bar App                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ MenuBarView  │───►│SettingsStore │───►│  IPCClient   │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                  │          │
│                     ┌──────────────┐    ┌───────▼───────┐  │
│                     │ IPCProtocol  │◄───│  Unix Socket  │  │
│                     └──────────────┘    └───────┬───────┘  │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
┌─────────────────────────────────────────────────▼───────────┐
│ Rust Tauri Backend                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 IpcServer                            │   │
│  │  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │ process_request │  │ event_tx (broadcast)    │   │   │
│  │  └────────┬────────┘  └───────────┬─────────────┘   │   │
│  └───────────┼──────────────────────┼─────────────────┘   │
│              │                      │                      │
│  ┌───────────▼──────────────────────▼─────────────────┐   │
│  │                    AppState                         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │   │
│  │  │  settings  │  │  engine    │  │ mouse_hook   │  │   │
│  │  └────────────┘  └────────────┘  └──────┬───────┘  │   │
│  └──────────────────────────────────────────┼──────────┘   │
│                                             │               │
│  ┌──────────────────────────────────────────▼──────────┐   │
│  │            MacosMouseHook::install()                  │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │  run_event_loop(sink, stop_flag)             │    │   │
│  │  │  └─► CGEventTap ──► Wheel Events ──► Sink  │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Direction Sync Data Flow

```
User Toggles Direction Sync (Swift UI)
        │
        ▼
SettingsStore.setDirectionSyncEnabled(true)
        │
        ▼
IPCClient.send("set_direction_sync_enabled", {enabled: true})
        │
        ▼
IPCServer.process_request()
        │
        ├─► AppState.settings.direction_sync_enabled = true
        │
        ├─► AppState.commit_settings(snapshot)
        │
        ├─► AppState.engine_signal.signal()
        │
        └─► event_tx.send(DirectionSyncChanged { enabled: true })
                    │
                    ▼
            All connected clients receive event
            (Swift Menu Bar updates UI)
```

---

## 5. Implementation Plan

### Phase 1: Mouse Hook (Priority: High)

**Files to modify:**

1. **`crates/platform/src/macos/mouse_hook.rs`**
   - Add `InstalledHook` struct with stop flag and join handle
   - Add `Drop` implementation for `InstalledHook`
   - Implement thread spawning logic in `install()`
   - Call `run_event_loop()` from the spawned thread

2. **`crates/platform/src/macos/mod.rs`**
   - ✅ No changes needed (already exports `MacosMouseHook`)

3. **`crates/platform/src/macos/event_tap.rs`**
   - ✅ No changes needed (already complete, used as-is)

**Verification:**
- Compile on macOS
- Run with Accessibility permission granted
- Check logs for "hook installed" message

### Phase 2: Direction Sync (Priority: Medium)

**Files to modify:**

1. **`crates/core/src/settings.rs`**
   - Add `direction_sync_enabled: bool` field to `AppSettings`
   - Add `direction_sync_enabled: bool` field to `EffectiveSettings`
   - Update `from_settings()` and `with_profile()` to copy the field
   - Update `Default` impl

2. **`src-tauri/src/ipc_socket_server.rs`**
   - Wire `get_direction_sync_enabled` to settings
   - Wire `set_direction_sync_enabled` to settings
   - Broadcast `DirectionSyncChanged` event

3. **`macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift`**
   - Add `SetDirectionSyncParams` struct
   - Add `directionSyncChanged` case to `IpcEvent` with proper CodingKeys
   - Add `directionSyncEnabled` to `AppSettingsResponse` with CodingKeys

4. **`macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift`**
   - Add `setDirectionSyncEnabled()` method
   - Handle `directionSyncChanged` in `handleEvent()`
   - Update `applySettings()` to include `directionSyncEnabled`

**Verification:**
- IPC communication works
- Settings persist across app restarts
- Event broadcast reaches Swift UI

---

## 6. Testing

### 6.1 Mouse Hook Testing

**Manual test:**
1. Build app
2. Run on macOS
3. Check System Settings → Privacy & Security → Accessibility
4. Grant permission if not granted
5. Test smooth scroll in Safari, Notes, etc.
6. Verify horizontal scroll works

**Log checking:**
```bash
tail -f ~/Library/Logs/SmoothScroll/softscroll*.log | grep -E "(hook|wheel)"
```

Expected output:
```
SmoothScroll ready (enabled=true)
hook installed successfully  # If mouse hook works
```

### 6.2 Direction Sync Testing

**Manual test:**
1. Open macOS menu bar app
2. Toggle "Direction Sync" option
3. Verify setting persists after app restart
4. Test that horizontal scroll direction changes appropriately

**IPC test:**
```bash
# Connect to socket and send request
echo '{"jsonrpc":"2.0","id":1,"method":"get_direction_sync_enabled"}' | nc -U ~/.config/smoothscroll/smoothscroll.sock
```

---

## 7. Edge Cases

### 7.1 Mouse Hook

| Edge Case | Handling |
|-----------|----------|
| Accessibility not granted | App starts, logs warning, smooth scroll disabled |
| Event tap fails to create | Return `PlatformError::PermissionDenied` |
| Thread panic | Caught by `join()`, error logged |
| Permission revoked while running | Event tap disabled, app continues without smooth scroll |
| Multiple rapid enable/disable | Each `install()` creates new thread, old ones clean up |

### 7.2 Direction Sync

| Edge Case | Handling |
|-----------|----------|
| IPC call before settings loaded | Return default value (false) |
| Invalid params (non-boolean) | Return error `-32602` (Invalid params) |
| Settings file corrupt | Use default values, log warning |
| Swift sends event to Rust | Ignore (Rust doesn't expect events from Swift) |

---

## Appendix A: File Changes Summary

### File: `crates/platform/src/macos/mouse_hook.rs`

```rust
//! macOS CGEventTap-based mouse hook for scroll event interception.

#![cfg(target_os = "macos")]

use crate::traits::{HookEventSink, HookHandle, MouseHook};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use super::event_tap::run_event_loop;

pub struct MacosMouseHook {
    stop_flag: Arc<AtomicBool>,
}

impl MacosMouseHook {
    pub fn new() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Default for MacosMouseHook {
    fn default() -> Self {
        Self::new()
    }
}

struct InstalledHook {
    #[allow(dead_code)]
    join: Option<thread::JoinHandle<()>>,
    stop_flag: Arc<AtomicBool>,
}

impl Drop for InstalledHook {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        if let Some(h) = self.join.take() {
            let _ = h.join();
        }
    }
}

impl MouseHook for MacosMouseHook {
    fn install(&self, sink: Arc<dyn HookEventSink>) -> Result<HookHandle> {
        let stop = self.stop_flag.clone();
        
        let join = thread::Builder::new()
            .name("ss-macos-wheel-hook".into())
            .spawn(move || {
                run_event_loop(sink, stop);
            })
            .map_err(|e| PlatformError::Os(format!("failed to spawn hook thread: {e}")))?;

        Ok(HookHandle::new(Box::new(InstalledHook {
            join: Some(join),
            stop_flag: self.stop_flag.clone(),
        })))
    }
}
```

### File: `crates/core/src/settings.rs` (Add direction_sync_enabled)

```rust
// In AppSettings struct, add after horizontal_invert:
pub direction_sync_enabled: bool,

// In EffectiveSettings struct, add after horizontal_invert:
pub direction_sync_enabled: bool,

// In EffectiveSettings::from_settings() and with_profile():
direction_sync_enabled: s.direction_sync_enabled,

// In Default impl:
direction_sync_enabled: false,
```

### File: `src-tauri/src/ipc_socket_server.rs` (Wire handlers)

```rust
"get_direction_sync_enabled" => {
    let settings = self.app_state.settings.read();
    (Some(serde_json::json!(settings.direction_sync_enabled)), None)
}
"set_direction_sync_enabled" => {
    let enabled = params
        .as_ref()
        .and_then(|p| p.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    {
        let mut settings = self.app_state.settings.write();
        settings.direction_sync_enabled = enabled;
    }
    let snapshot = self.app_state.settings.read().clone();
    self.app_state.commit_settings(snapshot);
    self.app_state.engine_signal.signal();

    let _ = self.event_tx.send(IpcEvent::DirectionSyncChanged { enabled });
    (Some(serde_json::json!(true)), None)
}
```

---

## Appendix B: Dependencies

**Rust:**
- `std::thread` - already used in codebase
- `std::sync::atomic` - already used
- `parking_lot` - already used

**Swift:**
- Foundation (already used)
- Darwin (already used)

No new dependencies required.

---

## Appendix C: Performance Considerations

**Mouse Hook Thread:**
- Event tap runs at ~60Hz (16.67ms per cycle)
- Minimal memory footprint (<1MB)
- CPU usage: negligible when idle

**Direction Sync:**
- Simple boolean read/write
- Settings persisted via existing `SettingsPersistor`
- No performance impact
