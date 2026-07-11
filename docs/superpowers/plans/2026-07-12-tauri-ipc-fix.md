# S5 Tauri Host & macOS IPC Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Rust↔Swift macOS IPC socket fully consistent — remove a duplicate import, emit the missing `SettingsChanged` event Rust side, and fix a stale misleading comment.

**Architecture:** The macOS IPC Unix-socket server already exists and is wired in `src-tauri/src/lib.rs` (spawns a tokio runtime, handles Swift's 5 methods, processes `quit`). Two real defects remain: a duplicate `use` statement, and Rust never emits the `SettingsChanged` event that the Swift client (`IPCProtocol.swift`) expects. We fix both and correct the stale comment. No new wiring needed.

**Tech Stack:** Rust (Tauri 2, tokio, serde_json), Swift (SwiftUI) — read-only for the Swift side.

## Global Constraints

- Every change goes through this plan; no direct edits outside tasks.
- Tests mandatory: Rust `cargo test` / `cargo clippy -- -D warnings` for the changed crate.
- Verify-before-claim: defects below were re-verified by reading source (subagent's "socket not wired" report was WRONG — `lib.rs:223-264` already wires it).
- YAGNI: do not touch the Swift app protocol; do not add new IPC methods.
- Missing-feature = criteria-only in the spec; here both items are concrete defects.

---

## Context (verified facts)

- `src-tauri/src/ipc_socket_server.rs:12` and `:31` both contain `use crate::state::AppState;` (duplicate — E2).
- Rust `IpcEvent` enum (ipc_socket_server.rs:62-67) has 3 variants: `ScrollStateChanged`, `DirectionSyncChanged`, `PresetChanged`. It is MISSING `SettingsChanged`.
- Swift `IpcEvent` enum (macos/.../IPCProtocol.swift:83-94) expects 4 variants including `SettingsChanged(settings: AppSettingsResponse)`. Swift `handleEvent` (SettingsStore.swift:181-182) handles `.settingsChanged` but Rust never sends it.
- `ipc_socket_server.rs:1-4` doc comment says socket path is `~/.config/smoothscroll/smoothscroll.sock` — wrong; actual is `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket` (matches Swift `SocketPath.swift`). Misleading doc.
- `src-tauri/src/lib.rs:210-211` comment "Swift app was not implemented" is stale — Swift app IS implemented. Misleading.

---

### Task 1: Remove duplicate `use` import (E2)

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs:31` (delete line)

**Interfaces:**
- Consumes: nothing new.
- Produces: clean compile; clears the clippy duplicate-import warning.

- [ ] **Step 1: Delete the duplicate import**

Open `src-tauri/src/ipc_socket_server.rs`. Line 12 already has `use crate::state::AppState;`. Remove the second one at line 31 (`use crate::state::AppState;`). After removal, line 31 region should read only the `type ResponseResult` definition that follows.

- [ ] **Step 2: Verify it compiles clean**

Run: `cargo clippy -p smoothscroll-app -- -D warnings` (or `cargo check -p smoothscroll-app`)
Expected: no duplicate-import warning; clippy exits 0.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(tauri): remove duplicate AppState import in ipc_socket_server"
```

---

### Task 2: Add `SettingsChanged` event to Rust (F1 gap)

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs:61-67` (add enum variant)
- Modify: `src-tauri/src/ipc_socket_server.rs:303-327` (`save_settings` handler — emit event after commit)
- Test: `src-tauri/src/ipc_socket_server.rs` (add `#[cfg(test)]` module, or extend existing tests)

**Interfaces:**
- Consumes: `self.app_state.commit_settings(updated)` (already called in `save_settings`).
- Produces: `IpcEvent::SettingsChanged { settings: serde_json::Value }` variant, broadcast to Swift clients so `SettingsStore.handleEvent(.settingsChanged)` fires.

- [ ] **Step 1: Write the failing test**

Add a `#[cfg(test)]` module at the end of `ipc_socket_server.rs`. `AppState` has NO `Default` impl and 24 fields (incl. trait objects), so we CANNOT construct it in a unit test. Instead we test the **wire-format contract** that closes the F1 gap: the `IpcEvent::SettingsChanged` variant must serialize to the JSON key `settingsChanged` — exactly what Swift's `IpcEvent` enum (`IPCProtocol.swift:83-94`) expects. This verifies the event exists and matches Swift naming without needing `AppState`.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_changed_event_serializes_as_settingsChanged() {
        let ev = IpcEvent::SettingsChanged {
            settings: serde_json::json!({ "enabled": true }),
        };
        let s = serde_json::to_string(&ev).unwrap();
        assert!(
            s.contains("\"settingsChanged\""),
            "Swift expects 'settingsChanged'; got {s}"
        );
    }

    #[test]
    fn all_ipc_event_variants_present() {
        // Ensures the enum has the 4 variants Swift expects.
        let _a = IpcEvent::ScrollStateChanged { enabled: true };
        let _b = IpcEvent::DirectionSyncChanged { enabled: true };
        let _c = IpcEvent::PresetChanged { preset: "balanced".into() };
        let _d = IpcEvent::SettingsChanged {
            settings: serde_json::Value::Null,
        };
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p smoothscroll-app --lib ipc_socket_server`
Expected: FAIL — `IpcEvent::SettingsChanged` variant does not exist.

- [ ] **Step 3: Write minimal implementation**

Add the variant to the enum (ipc_socket_server.rs:61-67):

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum IpcEvent {
    ScrollStateChanged { enabled: bool },
    DirectionSyncChanged { enabled: bool },
    PresetChanged { preset: String },
    SettingsChanged { settings: serde_json::Value },
}
```

In the `save_settings` handler (ipc_socket_server.rs:303-327), after a successful `commit_settings(updated)`, emit the event. Modify the `Ok(updated)` arm:

```rust
Ok(updated) => {
    self.app_state.commit_settings(updated);
    let settings_json = serde_json::to_value(&updated).unwrap_or(serde_json::Value::Null);
    let _ = self.event_tx.send(IpcEvent::SettingsChanged { settings: settings_json });
    (Some(serde_json::json!(true)), None)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p smoothscroll-app --lib ipc_socket_server`
Expected: PASS — `save_settings_emits_settings_changed` green.

- [ ] **Step 5: Run clippy**

Run: `cargo clippy -p smoothscroll-app -- -D warnings`
Expected: 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs
git commit -m "fix(tauri): emit SettingsChanged IPC event to match Swift client"
```

---

### Task 3: Fix stale/misleading comments (E1 doc + lib.rs comment)

**Files:**
- Modify: `src-tauri/src/ipc_socket_server.rs:1-4` (doc comment path)
- Modify: `src-tauri/src/lib.rs:209-211` (stale "Swift app was not implemented" comment)

**Interfaces:**
- Consumes: nothing.
- Produces: accurate docs; no behavior change.

- [ ] **Step 1: Fix the socket path doc comment**

Replace ipc_socket_server.rs:1-4 top doc with accurate text:

```rust
//! Unix domain socket IPC server for communication with the Swift Menu Bar app.
//!
//! Listens on `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket`
//! (macOS) and handles JSON-RPC 2.0 requests. Path MUST match Swift's
//! `SocketPath.socket` constant.
```

- [ ] **Step 2: Fix the stale lib.rs comment**

In `src-tauri/src/lib.rs` around line 209-211, replace:

```rust
            // Initialize system tray on all platforms (including macOS).
            // On macOS, we use Tauri tray instead of a Swift companion app
            // since the Swift app was not implemented.
```

with:

```rust
            // Initialize system tray on all platforms. The Swift Menu Bar app
            // (macos/SmoothScrollMenuBar) is the primary tray on macOS and talks
            // to the engine over the Unix socket below; the Tauri tray remains
            // available as a fallback.
```

- [ ] **Step 3: Verify build**

Run: `cargo check -p smoothscroll-app`
Expected: compiles; only comments changed.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ipc_socket_server.rs src-tauri/src/lib.rs
git commit -m "docs(tauri): correct stale macOS IPC/socket comments"
```

---

## Self-Review Notes

- Spec coverage: E2 → Task 1. F1 event gap → Task 2. E1 (stale doc) → Task 3. The spec's "verify socket is wired" item is RESOLVED by source verification (already wired at lib.rs:223-264) — no task needed; this corrects the subagent's false report.
- Placeholder scan: no TBD/TODO. Test code is concrete (adjust `AppState` constructor note is explicit, not a placeholder).
- Type consistency: `IpcEvent::SettingsChanged { settings: serde_json::Value }` matches Rust usage in Task 2 and the Swift `settingsChanged(settings:)` case name. `event_tx()` / `process_request` signatures unchanged across tasks.
