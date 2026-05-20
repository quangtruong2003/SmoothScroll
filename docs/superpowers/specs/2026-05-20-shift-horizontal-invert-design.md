# Shift+Wheel Horizontal Invert Toggle

**Date:** 2026-05-20
**Status:** Approved (proactive flow)
**Owner:** quangtruong2003

## Problem

When the user holds Shift and scrolls the mouse wheel, SmoothScroll currently routes
the vertical wheel delta directly into the horizontal axis without sign correction.

Result on Windows:

- Wheel down (negative `WM_MOUSEWHEEL` delta) → horizontal `WM_MOUSEHWHEEL` with the
  same negative sign → scrolls **left**.
- Wheel up (positive delta) → scrolls **right**.

This contradicts the Windows-native convention used by Excel, Edge, and most
horizontal-scroll-aware apps where Shift+wheel-down scrolls **right** (mirroring
how the page moves when you scroll a horizontal scrollbar with content to the
right).

## Goal

Add a user-controllable toggle that inverts the sign of the horizontal delta
emitted from Shift+vertical-wheel events. Default ON so the out-of-the-box
behavior matches Windows-native expectations. Users who prefer the legacy
behavior can disable it.

Non-goals:

- Do not touch native horizontal wheel events (`WM_MOUSEHWHEEL`) or touchpad
  horizontal panning — only the synthesized Shift+vertical → horizontal path.
- Do not change macOS routing (the path doesn't currently swallow
  Shift+vertical into horizontal in the same way; out of scope).
- Do not change keyboard scroll, edge scroll, or modifier passthrough.

## Design

### 1. Setting field

File: `crates/core/src/settings.rs`

Add to `AppSettings`:

```rust
// Direction & horizontal
pub shift_key_horizontal: bool,
pub shift_horizontal_invert: bool,    // NEW — default true
pub horizontal_smoothness: bool,
pub reverse_wheel_direction: bool,
```

`Default::default()` returns `true`. `#[serde(default)]` on the struct ensures
older config files without the key still deserialize (the field gets `true`
via `Default` — confirm with a serde test).

Add the same field to `EffectiveSettings` and to both `From` implementations
that build it (the `AppSettings → EffectiveSettings` direct path and the
profile-overlay path). Like `shift_key_horizontal`, this field is **not**
profile-overridable — the profile-overlay path copies it from the base
`AppSettings`.

### 2. Hook routing

File: `src-tauri/src/hook_wiring.rs`

In `route_vertical_with_source`, where Shift+vertical is currently routed to
the horizontal axis:

```rust
let mut engine = self.state.engine.lock();
if mods.shift && eff.shift_key_horizontal {
    let h_delta = if eff.shift_horizontal_invert { -delta } else { delta };
    engine.on_hwheel_with_source(h_delta, now, source, &eff);
} else {
    engine.on_wheel_with_source(delta, now, source, &eff);
}
```

`route_horizontal_with_source` is unchanged — native horizontal wheel events
are not affected.

### 3. Frontend types & defaults

File: `src/lib/settings.ts`

- Add `shiftHorizontalInvert: boolean` to the `Settings` type.
- Default `true` in the defaults block.
- Add the `shift_horizontal_invert` ↔ `shiftHorizontalInvert` mapping wherever
  the file converts between snake_case (Rust) and camelCase (TS).

### 4. UI row

File: `src/components/settings/DirectionSection.tsx`

Add a `SettingRow` directly under the existing `shift_key_horizontal` row:

- Label key: `direction.shiftHorizontalInvert.label`
- Description key: `direction.shiftHorizontalInvert.description`
- Bound to `fields.shift_horizontal_invert` /
  `patch({ shift_horizontal_invert: v })`.
- `disabled={!fields.shift_key_horizontal}` — when shift→horizontal mapping
  itself is off, the invert toggle is meaningless.

### 5. i18n

Files: `src/i18n/locales/*.json` (14 locales)

Add under `direction`:

```json
"shiftHorizontalInvert": {
  "label": "Invert direction",
  "description": "When holding Shift, scrolling down moves right instead of left."
}
```

For locales we cannot author confidently, ship the English copy as a fallback
so JSON stays valid — translation can follow in a separate pass.

### 6. Tests

File: `src-tauri/src/hook_wiring.rs` (existing `mod tests`)

- `shift_with_invert_on_emits_negated_horizontal_delta` — default settings,
  send `+120` vertical with Shift, drain engine, assert `h < 0` (sign flipped).
- `shift_with_invert_off_emits_raw_horizontal_delta` — set
  `shift_horizontal_invert = false`, send `+120` with Shift, assert `h > 0`.

File: `crates/core/tests/settings_tests.rs`

- `default_has_shift_horizontal_invert_true`
- `deserialize_old_config_without_field_defaults_to_true` — feed JSON missing
  the key, assert it round-trips with `true`.

### 7. Onboarding & presets

Files: `crates/core/src/onboarding.rs`, `src/components/onboarding/presetMatrix.ts`

Inspect; if presets do not touch this field, leave them alone — every preset
inherits the default `true`. If a preset explicitly sets direction-related
flags, add `shift_horizontal_invert: true` for consistency.

## Verification plan

1. `cargo fmt && cargo clippy -- -D warnings && cargo test` — all green.
2. `pnpm build` — no TS errors.
3. Manual: launch the app, Shift+wheel-down in a horizontal-scroll surface
   (e.g., a wide image gallery, Excel) → verify scroll moves **right**. Toggle
   the new setting OFF → Shift+wheel-down scrolls **left** (legacy).
4. Verify the toggle is greyed out when "Use Shift to scroll horizontally" is
   off.

## Risks

- **Behavioral break for existing users.** Default ON inverts current behavior.
  Mitigation: the toggle is right next to `shift_key_horizontal`; release notes
  call it out.
- **Locale drift.** 14 locale files get an English fallback string. Mitigation:
  document as known follow-up; non-blocking.

## Out of scope

- macOS Shift+wheel routing (currently doesn't go through the same swallow path).
- Touchpad horizontal direction.
- Reversing native `WM_MOUSEHWHEEL` direction.
- Per-profile override for this field.
