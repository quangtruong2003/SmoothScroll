# S5 — Tauri Host & macOS IPC Integration (E1, E2, F1)

## 1. Context (RE-VERIFIED by reading source — subagent report was partly WRONG)
- **E1 [CORRECTED]** `src-tauri/src/lib.rs:223-264` ALREADY wires the macOS IPC socket server (spawns tokio runtime, handles Swift's 5 methods, processes `quit`). The subagent's "not fully shipped" report was incorrect. Remaining E1 work = fix stale/misleading comments only: (a) `ipc_socket_server.rs:1-4` doc says wrong socket path; (b) `lib.rs:210-211` comment "Swift app was not implemented" is stale (Swift app IS implemented).
- **E2 [VERIFIED]** `src-tauri/src/ipc_socket_server.rs:12` and `:31`: duplicate `use crate::state::AppState;`.
- **F1 [VERIFIED]** Method parity OK: Rust `process_request` handles all 5 Swift methods (`get_settings`, `set_scroll_enabled`, `set_preset`, `save_settings`, `quit`). ONE GAP: Swift `IpcEvent` expects 4 variants including `settingsChanged` (`IPCProtocol.swift:83-94`), but Rust `IpcEvent` (ipc_socket_server.rs:62-67) only has 3 — MISSING `SettingsChanged`. Swift `handleEvent` (SettingsStore.swift:181-182) never receives it.

## 2. Current Behavior
- Swift app is a finished IPC client; Rust backend socket may not be fully wired into `lib.rs` → Swift↔Rust communication may be broken on macOS.

## 3. Desired Behavior
- F1: Rust emits `SettingsChanged` event (with settings JSON) on `save_settings`, matching Swift's expected `settingsChanged` variant — closes the only real parity gap. Socket wiring is ALREADY correct (no rewire needed).
- E2: remove the duplicate import.
- E1: correct stale comments (socket path doc + "Swift app not implemented" note). `tokio` dep is justified (used by the macOS socket server).

## 4. Acceptance Criteria
- [ ] **F1**: Rust `save_settings` emits `SettingsChanged{settings}`; Swift `handleEvent(.settingsChanged)` fires (push-sync works). Socket already wired (lib.rs:223-264) — no rewire.
- [ ] **E2**: no duplicate `use crate::state::AppState;`; `cargo clippy -- -D warnings` clean.
- [ ] **E1**: doc comment shows correct socket path; stale "Swift app not implemented" comment removed.

## 5. Test Plan
- F1: integration test — start socket server, send a JSON-RPC command, assert engine state changes; assert Swift client protocol parity (method names/case).
- E2: `cargo clippy -- -D warnings` catches the duplicate (or manual removal + compile).
- Cross-check socket path string against Swift `SocketPath.swift` (`com.SmoothScroll.SmoothScroll`).

## 6. Implementation Notes
- F1: verify `lib.rs:227` calls `ipc_socket_server::run` on macOS and that `process_request` (line ~222) handles all 5 Swift methods; wire missing handlers.
- E2: delete line 31 duplicate.
- Socket path must match Swift exactly (`com.SmoothScroll.SmoothScroll`), confirmed in F1 test.

## 7. Risks / Out-of-scope
- Do not change the Swift app protocol (client is finished); only the Rust side.
- macOS-only behavior; non-macOS stays no-op.
