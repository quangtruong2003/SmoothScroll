# S5 — Tauri Host & macOS IPC Integration (E1, E2, F1)

## 1. Context
- **E1 [REPORTED]** `src-tauri/src/ipc_socket_server.rs`: Unix socket JSON-RPC backend for the Swift MenuBar app. Non-macOS = no-op stub; on macOS still invoked in `lib.rs:227` but reported "not fully shipped". `Cargo.toml` pulls `tokio` for this path.
- **E2 [REPORTED]** `src-tauri/src/ipc_socket_server.rs:12` and `:31`: duplicate `use crate::state::AppState;`.
- **F1 [VERIFIED+REPORTED]** Mismatch: Swift `macos/SmoothScrollMenuBar` IPC client (Unix socket, complete) vs Rust backend socket status unclear. Docs (`SPEC-macos`) say macOS skips Tauri tray, Swift is the only tray.

## 2. Current Behavior
- Swift app is a finished IPC client; Rust backend socket may not be fully wired into `lib.rs` → Swift↔Rust communication may be broken on macOS.

## 3. Desired Behavior
- F1: confirm/complete the Rust socket backend wiring in `lib.rs` so Swift commands (`get_settings`, `set_scroll_enabled`, `set_preset`, `save_settings`, `quit`) and Rust→Swift events (`scrollStateChanged`, `presetChanged`, `settingsChanged`) work end-to-end.
- E2: remove the duplicate import.
- E1: after F1 verified, keep or document the socket path; ensure `tokio` dep is justified or dropped.

## 4. Acceptance Criteria
- [ ] **F1**: Swift app connects to `~/Library/Application Support/com.SmoothScroll.SmoothScroll/socket`; toggle/preset commands reach the Rust engine; graceful `quit` shuts Rust down.
- [ ] **E2**: no duplicate `use crate::state::AppState;`; `cargo build` clean.
- [ ] **E1**: socket server started on macOS in `lib.rs`; tokio dependency justified or removed on non-macOS.

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
