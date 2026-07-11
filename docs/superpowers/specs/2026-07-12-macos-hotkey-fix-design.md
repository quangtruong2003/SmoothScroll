# S1 — macOS Hotkey Defects (A1, A2)

## 1. Context
- **A1 [VERIFIED]** `crates/platform/src/macos/hotkey.rs:37`: `"f12" => Ok(118)` collides with `"f4" => Ok(118)` (line 34). macOS F12 = 111.
- **A2 [REPORTED]** `crates/platform/src/macos/event_tap.rs:132`: `read_keycode` uses field literal `7`; correct field is `kCGKeyboardEventKeycode = 9`.

## 2. Current Behavior
- Registering an `F12` hotkey silently maps to keycode 118 (F4) → wrong key fires, or "already registered" error.
- Hotkey dispatch reads keycode from field 7 (wrong) → may match wrong key.

## 3. Desired Behavior
- `F12` → keycode 111, distinct from `F4` (118).
- `read_keycode` reads from `kCGKeyboardEventKeycode` (9) via a declared `extern static` like the other field keys (event_tap.rs:66-70).

## 4. Acceptance Criteria
- [ ] `parse_key("f12")` returns 111; `parse_key("f4")` returns 118 (distinct).
- [ ] Hotkey dispatch matches the actual pressed keycode (field 9).
- [ ] `cargo test` in `crates/platform` passes.

## 5. Test Plan
- Unit test in `hotkey.rs` (or existing test module): assert `f12`/`f4`/`f11` keycodes.
- For A2: add a test or static assertion that `read_keycode` uses `kCGKeyboardEventKeycode`; since it's `unsafe` FFI, verify via code review + a dispatch round-trip test if feasible.

## 6. Implementation Notes
- A1: change line 37 to `"f12" => Ok(111)`.
- A2: declare `static kCGKeyboardEventKeycode: i64;` in the `extern "C"` block; replace `7` with `kCGKeyboardEventKeycode`. Verify the constant value (9) against Apple docs.

## 7. Risks / Out-of-scope
- Do NOT touch the Windows/Linux keycode maps. Only macOS.
