# S3 — Linux Correctness (B1, B2, B3, B4)

## 1. Context
- **B1 [REPORTED]** `crates/platform/src/linux/mouse_hook.rs:6-7`: X11 (XInput2) cannot swallow the original event → double-scroll. Mitigated by `SUPPRESSING` flag + `sleep 500µs` (heuristic, can miss under load).
- **B2 [REPORTED]** `crates/platform/src/linux/wayland/hotkey.rs:51-66`: GlobalShortcuts portal unimplemented → hotkey `Ctrl+Alt+S` does NOT work on Wayland.
- **B3 [REPORTED]** `crates/platform/src/linux/wayland/fullscreen.rs:11-15`: always `false` stub.
- **B4 [REPORTED]** `crates/platform/src/linux/wayland/process_query.rs:64-67`: `process_name_under_cursor`=None; foreground only on KDE.

## 2. Current Behavior
- X11: smooth scroll stacks on native scroll (double). Wayland: grab-exclusive avoids double, but hotkey/fullscreen/process detection are missing.

## 3. Desired Behavior
- B1: document X11 limitation clearly; replace `sleep 500µs` heuristic with a robust signal (Condvar/eventfd) to avoid suppress-race misses. (Scope: mitig, not eliminate — X11 cannot truly swallow.)
- B2: implement Wayland global hotkey via `org.freedesktop.portal.GlobalShortcuts` (or document as not feasible).
- B3/B4: implement fullscreen detection + process-under-cursor on Wayland (where protocol allows), or document platform limits.

## 4. Acceptance Criteria
- [ ] **B1**: suppress flag uses a non-sleep signaling mechanism; no observed self-inject loop under load (test + manual).
- [ ] **B2**: `Ctrl+Alt+S` toggles smoothing on Wayland (portal wired) OR explicitly documented as unsupported with fallback.
- [ ] **B3**: fullscreen foreground detected on at least one Wayland compositor (KDE/GNOME).
- [ ] **B4**: `process_name_under_cursor` returns a value on Wayland where the protocol exposes it.

## 5. Test Plan
- B1: unit test the suppress flag timing using a mock event source; integration test on X11 if CI allows.
- B2/B3/B4: portal/compositor interactions are hard to unit-test → acceptance via manual + targeted harness; at minimum add a compile + smoke check.

## 6. Implementation Notes
- B1: replace `std::thread::sleep(500µs)` with `eventfd`/`Condvar` notified by the emitter. Keep `SUPPRESSING` AtomicBool.
- B2: use `ashpd` or raw D-Bus to register GlobalShortcuts; fall back to a logged no-op if portal unavailable.
- B3: use `xdg-foreign` / `wlr-foreign-toplevel` or KWin D-Bus `_NET_WM_STATE_FULLSCREEN` equivalent.
- B4: reuse KWin D-Bus foreground; GNOME may need `org.gnome.Shell` introspection.

## 7. Risks / Out-of-scope
- Cross-compositor Wayland behavior varies; document known limitations per compositor.
- Do not change X11 capture mechanism (XInput2) — only the suppress signaling.
