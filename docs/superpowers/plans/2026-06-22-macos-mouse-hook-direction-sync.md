# macOS Mouse Hook & Direction Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix macOS smooth scroll by implementing `MacosMouseHook` using CGEventTap, and wire `direction_sync_enabled` setting through IPC.

**Architecture:** Two independent fixes:
1. **Mouse Hook:** Replace stub `MacosMouseHook::install()` with real implementation that spawns a thread running `run_event_loop()` from `event_tap.rs`
2. **Direction Sync:** Add `direction_sync_enabled` to `AppSettings`/`EffectiveSettings`, wire IPC handlers, update Swift protocol and SettingsStore

**Tech Stack:** Rust (crates/platform, src-tauri), Swift (macOS menu bar app)

---

## File Structure

| File | Change | Purpose |
|------|--------|---------|
| `crates/platform/src/macos/mouse_hook.rs` | Replace | Implement actual `MouseHook` using `run_event_loop()` |
| `crates/core/src/settings.rs` | Modify | Add `direction_sync_enabled` field |
| `src-tauri/src/ipc_socket_server.rs` | Modify | Wire IPC handlers for direction sync |
| `macos/.../IPC/IPCProtocol.swift` | Modify | Add Swift types for direction sync |
| `macos/.../Settings/SettingsStore.swift` | Modify | Add Swift method and event handling |

---

## Task 1: Implement macOS Mouse Hook

**Files:**
- Modify: `crates/platform/src/macos/mouse_hook.rs`

- [ ] **Step 1: Read current mouse_hook.rs**

Read `crates/platform/src/macos/mouse_hook.rs` to understand current stub implementation.

- [ ] **Step 2: Read event_tap.rs**

Read `crates/platform/src/macos/event_tap.rs` to understand the `run_event_loop()` function signature and usage.

- [ ] **Step 3: Replace mouse_hook.rs with full implementation**

Replace the entire file content with:

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

- [ ] **Step 4: Verify Rust compilation**

Run: `cargo check --package smoothscroll-platform`
Expected: No errors (on any platform, the macOS cfg-gate won't compile on Windows but should not error)

- [ ] **Step 5: Commit**

```bash
git add crates/platform/src/macos/mouse_hook.rs
git commit -m "feat(macos): implement MacosMouseHook using CGEventTap"
```

---

## Task 2: Add direction_sync_enabled to AppSettings

**Files:**
- Modify: `crates/core/src/settings.rs`

- [ ] **Step 1: Read settings.rs to find line numbers**

Read `crates/core/src/settings.rs` and find:
- Line of `pub reverse_wheel_direction: bool,` in AppSettings
- Line of `pub reverse_wheel_direction: bool,` in EffectiveSettings
- Line of `reverse_wheel_direction: false,` in AppSettings Default
- End of `from_settings()` method
- End of `with_profile()` method

- [ ] **Step 2: Add field to AppSettings struct**

Find line around 164 (after `pub reverse_wheel_direction: bool,`) and add:

```rust
pub direction_sync_enabled: bool,
```

- [ ] **Step 3: Add field to EffectiveSettings struct**

Find line around 401 (after `pub reverse_wheel_direction: bool,`) and add:

```rust
pub direction_sync_enabled: bool,
```

- [ ] **Step 4: Add field to AppSettings Default**

Find `reverse_wheel_direction: false,` in Default impl and add after:

```rust
direction_sync_enabled: false,
```

- [ ] **Step 5: Add to from_settings() method**

Find end of `from_settings()` Self block (around line 438), add before closing `}`:

```rust
direction_sync_enabled: s.direction_sync_enabled,
```

- [ ] **Step 6: Add to with_profile() method**

Find end of `with_profile()` Self block (around line 464), add before closing `}`:

```rust
direction_sync_enabled: base.direction_sync_enabled,
```

- [ ] **Step 7: Verify Rust compilation**

Run: `cargo check --package smoothscroll-core`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add crates/core/src/settings.rs
git commit -m "feat(settings: add direction_sync_enabled field"
```

---

## Task 3: Wire IPC Handlers for Direction Sync

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs`

- [ ] **Step 1: Read ipc_socket_server.rs**

Read `src-tauri/src/ipc_socket_server.rs` and find:
- Line of `get_direction_sync_enabled` handler (around line 249)
- Line of `set_direction_sync_enabled` handler (around line 253)

- [ ] **Step 2: Replace get_direction_sync_enabled handler**

Replace:
```rust
"get_direction_sync_enabled" => {
    // Direction sync is not yet wired into AppState — return default.
    (Some(serde_json::json!(false)), None)
}
```

With:
```rust
"get_direction_sync_enabled" => {
    let settings = self.app_state.settings.read();
    (Some(serde_json::json!(settings.direction_sync_enabled)), None)
}
```

- [ ] **Step 3: Replace set_direction_sync_enabled handler**

Replace:
```rust
"set_direction_sync_enabled" => {
    // TODO: wire direction sync into AppState when available.
    let _enabled = params
        .as_ref()
        .and_then(|p| p.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    (Some(serde_json::json!(true)), None)
}
```

With:
```rust
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

- [ ] **Step 4: Verify Rust compilation**

Run: `cargo check --package smoothscroll-app`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "feat(ipc): wire direction_sync_enabled handlers to AppState"
```

---

## Task 4: Update Swift IPC Protocol

**Files:**
- Modify: `macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift`

- [ ] **Step 1: Read IPCProtocol.swift**

Read `macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift` and find:
- End of request params section
- IpcEvent enum (to check if CodingKeys exist)
- AppSettingsResponse struct (to find where to add directionSyncEnabled)

- [ ] **Step 2: Add SetDirectionSyncParams struct**

After existing params (around line 71), add:

```swift
struct SetDirectionSyncParams: Encodable, Sendable {
    let enabled: Bool
}
```

- [ ] **Step 3: Update IpcEvent with CodingKeys**

Find IpcEvent enum. It currently is:
```swift
enum IpcEvent: Codable, Sendable {
    case scrollStateChanged(enabled: Bool)
    case presetChanged(preset: String)
    case settingsChanged(settings: AppSettingsResponse)
}
```

Replace with:
```swift
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
```

- [ ] **Step 4: Add directionSyncEnabled to AppSettingsResponse**

Find end of AppSettingsResponse fields (around line 110), add after `let gameModeEnabled: Bool`:

```swift
let directionSyncEnabled: Bool
```

Find AppSettingsResponse CodingKeys enum (around line 113), add after `case gameModeEnabled = "game_mode_enabled"`:

```swift
case directionSyncEnabled = "direction_sync_enabled"
```

- [ ] **Step 5: Verify Swift compilation (if xcodebuild available)**

Run: `cd macos && xcodebuild -scheme SmoothScrollMenuBar -destination 'platform=macOS' build 2>&1 | head -50`
Expected: Build succeeds or only unrelated errors

- [ ] **Step 6: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/IPC/IPCProtocol.swift
git commit -m "feat(swift): add direction sync IPC protocol types"
```

---

## Task 5: Update Swift SettingsStore

**Files:**
- Modify: `macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift`

- [ ] **Step 1: Read SettingsStore.swift**

Read `macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift` and find:
- Location of `setPreset()` method (for pattern reference)
- Location of `handleEvent()` method switch statement
- Location of `applySettings()` method

- [ ] **Step 2: Add setDirectionSyncEnabled method**

After `setPreset()` method (around line 105), add:

```swift
// MARK: - Direction Sync

func setDirectionSyncEnabled(_ enabled: Bool) async {
    let previousValue = directionSyncEnabled
    directionSyncEnabled = enabled

    do {
        try await IPCClient.shared.send(
            "set_direction_sync_enabled",
            params: SetDirectionSyncParams(enabled: enabled)
        ) as Bool
    } catch {
        logger.error("setDirectionSyncEnabled failed, rolling back: \(error.localizedDescription)")
        directionSyncEnabled = previousValue
    }
}
```

- [ ] **Step 3: Add handleEvent case**

Find `handleEvent()` method switch statement. Add new case:

```swift
case .directionSyncChanged(let enabled):
    directionSyncEnabled = enabled
```

Add this BEFORE the closing `}` of the switch statement.

- [ ] **Step 4: Update applySettings**

Find `applySettings()` method. Add to the assignments:

```swift
directionSyncEnabled = settings.directionSyncEnabled
```

- [ ] **Step 5: Verify Swift compilation (if xcodebuild available)**

Run: `cd macos && xcodebuild -scheme SmoothScrollMenuBar -destination 'platform=macOS' build 2>&1 | head -50`
Expected: Build succeeds or only unrelated errors

- [ ] **Step 6: Commit**

```bash
git add macos/SmoothScrollMenuBar/Sources/Settings/SettingsStore.swift
git commit -m "feat(swift): wire direction sync in SettingsStore"
```

---

## Task 6: Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Full Rust build check**

Run: `cargo build --release --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20`
Expected: Build completes (may have warnings but no errors)

- [ ] **Step 2: Summary commit (if all tasks complete)**

Only if all previous tasks committed successfully:

```bash
git add -A
git commit -m "feat: implement macOS mouse hook and wire direction sync

- Replace MacosMouseHook stub with CGEventTap implementation
- Add direction_sync_enabled to AppSettings/EffectiveSettings
- Wire IPC handlers for direction sync get/set
- Update Swift IPC protocol with CodingKeys
- Wire Swift SettingsStore for direction sync"
```

---

## Self-Review Checklist

After writing the plan, verify:

- [ ] **Spec coverage:** Each requirement in spec has corresponding task
  - [x] Mouse Hook: Task 1
  - [x] direction_sync_enabled in AppSettings: Task 2
  - [x] direction_sync_enabled in EffectiveSettings: Task 2
  - [x] IPC handlers: Task 3
  - [x] Swift IPCProtocol: Task 4
  - [x] Swift SettingsStore: Task 5

- [ ] **Placeholder scan:** No TBD, TODO, or incomplete steps

- [ ] **Type consistency:**
  - [x] `direction_sync_enabled` matches between Rust and Swift
  - [x] `SetDirectionSyncParams` struct defined in Swift
  - [x] CodingKeys use correct snake_case for Rust JSON

- [ ] **File paths:** All paths are exact and match actual project structure

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-22-macos-mouse-hook-direction-sync.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
