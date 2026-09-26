# Window-Model Hybrid Engine — Design Spec

Date: 2026-09-27
Status: approved design, pending implementation plan
Origin: study of [SmoothWheelScroll](https://github.com/bobo198504/SmoothWheelScroll) (native REAPER extension; local reference clone at `D:\tmp-sws-study`, throwaway — may be deleted after implementation)

## 1. Motivation

SmoothWheelScroll scrolls and zooms REAPER smoothly without changing wheel semantics. Its advantage in REAPER is architectural, not algorithmic: it runs inside REAPER, learns which REAPER *action* each wheel notch resolves to, and re-invokes that action with fractional values — while SmoothScroll re-injects sub-notch wheel deltas from outside, which REAPER's whole-unit receivers round away (stall-then-jump, the REAPER pain this project's users hit).

Two things are worth adopting into SmoothScroll:

1. **The timing model.** Our engine pays out a coalesced running total as a per-frame *fraction of the remainder* (`compute_easing_fraction` in `crates/core/src/easing.rs`). That makes `animation_time_ms` an exponential time constant with a cut-off tail (< 0.1 px dropped per batch, fractional `unit_accum` dropped when the pool empties) rather than a duration. Their model 3.0 pays each received amount through **one window of exact duration**, overlapping windows add, and hand-over is **exactly conservative** (total paid == total fed, to the last fraction). Measured on a steady overlapping roll, an eased payout shape cuts output-rate ripple from ~35% to ~19%.
2. **Receiver-granularity and device truth.** REAPER-class apps need whole-unit emission (we already have `SmoothingStrategy::DiscreteNotchPreserving` end-to-end from the 2026-09-01 semantic plan, Tasks 1–7); touchpads should be identified by the OS touch/pen marker and delta-magnitude evidence, not by a rate heuristic.

Chosen approach (user-approved): **Hybrid** — adopt their *timing* layer and device/receiver classification, keep our *feel* layer (momentum acceleration) as the amount stage in front of the model. The new timing model becomes the **default**; the legacy scheduler stays as a hidden kill-switch.

## 2. Goals

- G1: Replace the running-total scheduler with a per-message window model that is exactly conservative and whose `animation_time_ms` is a true duration.
- G2: Keep every existing feel setting meaningful with unchanged defaults (`step_size_px` 144, `animation_time_ms` 220, `acceleration_max` 10, `easing_mode`, `tail_to_head_ratio`); easing curves become the payout shape of each window.
- G3: Fix whole-unit receivers in apps like REAPER: built-in + user-configurable per-app `DiscreteNotchPreserving` routing.
- G4: Classify touch/pen by the OS marker (`MI_WP_SIGNATURE`) and free-spin vs touchpad by delta-magnitude evidence, replacing the rate heuristic.
- G5: Escape hatch: `engine_timing: "windows" | "legacy"` hidden setting, default `"windows"`.

## 3. Non-goals (deliberately not adopted — do not revisit during implementation)

- **Ramp-up / slow-step** ("slow turn moves little"): conflicts with our momentum identity and changes single-notch travel. Our acceleration stage already shapes feel.
- **speedMul top-speed ceiling (1–2×)**: `acceleration_max` already owns "go further when fast" with a stronger range.
- **Dedicated zoom curve model** (their anim161): our zoom is Ctrl-synthesis at the emitter, not an API-driven receiver; unchanged.
- **Per-action delivery matrix** (stream vs whole-units vs immediate): impossible from outside the process; per-app whole-unit routing is the maximum approximation.
- **Motion chart settings panel**: deferred; frontend-only, separate request.
- **REAPER extension of our own**: separate deliverable, not this project.
- **No UI changes** in this spec: new settings are settings.json-only.

## 4. Architecture

Data flow is unchanged (hook → engine thread at 120 Hz → `SendInput` emitter). Layering inside `smoothscroll_core` follows their model-seam principle:

```
Feel (amount)            Timing (model)                Emission (granularity)
notches × step_size  →   window model (new, pure   →   12-delta pulses (default)
× accel_factor(velocity) math, per-window payout,      or whole 120-delta notches
(velocity EMA, as today) overlap adds, exact            (discrete-receiver apps)
                         conservation)
```

- `crates/core/src/window_model.rs` (new): pure math, no Win32/Tauri deps, unit-testable in isolation — mirrors the role of their `anim3_core.h`.
- `crates/core/src/engine.rs`: `Axis` gains a window state alongside the legacy pending pool; dispatch on `EngineTiming`.
- `crates/core/src/input_source.rs`: classification upgrade (§7).
- `src-tauri/src/hook_wiring.rs`: strategy resolution gains the discrete-receiver app rule (§8).

## 5. Window model (`window_model.rs`)

Port of their model 3.0 (`anim3_core.h` + the travel-shaping notes in `model.h`), adapted to our settings:

### 5.1 State (per axis)

```rust
/// Owned by window_model (engine's private `EasingSnapshot` constructs it; do not
/// share the engine struct).
struct PayoutParams {
    duration_ms: f64,     // from settings.animation_time_ms
    easing_mode: EasingMode,
    tail_to_head_ratio: f64,
    easing_enabled: bool, // includes animation_easing
}
struct Window {
    remaining_px: f64,   // starts at the fed amount; drained by telescoping
    age_ms: f64,
    params: PayoutParams, // frozen at feed time
    eased: bool,          // false = constant-rate payout
}
struct WindowGlide {
    windows: VecDeque<Window>, // cap MAX_WINDOWS = 2048
    due_px: f64,               // overflow / zero-duration hand-over, flushed next tick
}
```

### 5.2 Feed

- `feed(amount_px, gap_ms, params: PayoutParams)`: `amount_px == 0` → no-op. If `windows.len() >= MAX_WINDOWS`, add to `due_px` (never dropped). Otherwise push a window with the fed amount, `age_ms = 0`, the frozen `params`, and `eased = payout_ease_for(gap_ms, params.duration_ms)`.
- `payout_ease_for(gap_ms, window_ms) -> bool` (their `PayoutEaseFor`, port exactly): false when `gap_ms <= 0` or `gap_ms >= window_ms`; otherwise false when `|window/gap − nearest_integer| < 0.08` (window count nearly constant → constant rate is already flat; easing would add ripple); true otherwise (overlap with changing window count → eased payout removes the step).
- Amounts are signed; reversals simply open windows of the opposite sign.

### 5.3 Tick

`tick(dt_ms) -> f64`:

1. `out = due_px; due_px = 0`.
2. For each window: `u0 = age/w`, `u1 = (age+dt)/w`; `s(u) = payout_frac(u, snapshot, eased)`; `pay = remaining × (s(u1) − s(u0)) / (1 − s(u0))` (guard denominator < 1e-12 → pay = remaining); `remaining −= pay; age += dt; out += pay`. Windows with `age >= w` are removed — telescoping drains them exactly on their final frame, so nothing is lost and nothing outlives `window_ms`.
3. Return `out`.

`payout_frac(u, params, eased) -> f64` — cumulative share at progress u∈[0,1] of the window:

- not eased (or `params.easing_enabled == false`): `u` (constant rate).
- eased: the user's curve as the cumulative shape — Linear falls back to `u`; `CubicOut: 1 − (1−u)³`; `QuinticOut: 1 − (1−u)⁵`; `ExponentialOut: 1 − exp(−(2 + tail_to_head_ratio)·u)`.

Note: their measured optimum blended smoothstep; we substitute the user's chosen curve. The property their easing relies on — near-zero payout slope at the window end, so a window joining/leaving puts no step into the output — holds for all three Out-curves. Linear keeps constant rate, matching their `ease = 0`.

### 5.4 Conservation target

Model level: for any deterministic feed/tick sequence, `sum(paid) == sum(fed)` exactly (f64 telescoping). Engine level: the same sum differs only by the final-pulse rounding bound of §6.3. The model test asserts exactness; the engine test asserts the bound.

## 6. Engine integration (`engine.rs`)

### 6.1 Dispatch

`Axis` holds both `pending` (legacy) and `windows: WindowGlide`. `register*` and `step_axis` branch on `settings.engine_timing` (Windows → windows, Legacy → existing code paths untouched). `instant_mode` flushes: sum all window remainders + `due_px` immediately through the normal unit/pulse pipeline (same as `flush_instant`).

### 6.2 Register (Windows timing)

- `register_notch_with_easing`: compute `instant_velocity` EMA and `accel_factor` exactly as today, then `windows.feed(notches × step_size_px × accel_factor, gap_ms = now − last_notch, …)`. First message of a gesture has `gap_ms = 0` → constant-rate window.
- `register_pixels` (touchpad): `windows.feed(px × touchpad_pixel_multiplier, gap_ms, …)`; `velocity = 0` as today.
- Discrete strategy: `register_discrete` / `flush_discrete*` untouched (§8).

### 6.3 Unit accumulation and final rounding (Windows timing)

Same pipeline as today (`px → wheel units → EMIT_UNIT pulses → PULSE_CLAMP ±40 with carry`), plus one change: when the last window drains this frame and no due/rounding debt remains, apply **round-to-nearest** on the leftover `unit_accum`: `|accum| ≥ 0.5` → emit one extra pulse in the sign of `accum`; clear `unit_accum` either way. Bounded end-of-gesture error becomes ≤ 6 delta (today: up to ~12 delta dropped). The rounding pulse rides the same frame's output, so `finish_axis_pulse` / sequence-ownership logic is unaffected.

### 6.4 Reset / ownership

`reset_sequence`, `reset_axis*`, `finish_axis_pulse`, `has_pending*` semantics unchanged; the Windows-timing branch reports pending = windows non-empty || `due_px != 0`. Hot-path allocations: the `VecDeque` is reused (`clear` keeps capacity); no per-frame allocation beyond what the legacy path already does.

## 7. Device classification (`input_source.rs`, Windows hook)

Two layers, OS truth first (port of their `device.h` reasoning):

1. **OS marker wins outright.** The WH_MOUSE_LL hook already reads `dwExtraInfo` (`mouse_hook.rs:42`); the hook computes `touch_injected = (extra_info & 0xFFFFFF00) == 0xFF515700` (`MI_WP_SIGNATURE` — Win32 knowledge stays in the platform crate) and carries it as a new `touch_injected: bool` field on the core-owned `WheelInputEvent`. Non-Windows hooks set `false`. The classifier signature becomes `classify(delta, now_ms, touch_injected)`; a marked event is `Touchpad` outright.
2. **Magnitude evidence replaces the rate heuristic.** Keep the last 8 sub-notch (non-multiple-of-120) magnitudes per gesture:
   - whole notch (`|delta| % 120 == 0`) → `Wheel`, clears gesture evidence;
   - ≥ 2 distinct magnitudes in the window → `Touchpad`, **locked for the rest of the gesture** (a touchpad coasting can emit identical values; a real free-spinner never varies — lock direction is safe: over-missing smoothing beats breaking scroll);
   - 1 fixed magnitude → `HighResWheel` (free-spin: smoothed sub-notch, no new enum variant);
   - < 3 samples → keep previous verdict (or `Wheel` if none).

The rate-based branch (`events_per_second`, `avg_interval_ms`, `TOUCHPAD_*` constants) is removed together with its tests. Known behavioral tradeoff (accepted): a slowly creeping touchpad that never varies within one gesture may classify as `HighResWheel` and receive notch-scaled amounts — magnitude-correct, smoothing still continuous; the safe direction of every misclassification is "less smoothing", never "broken scroll".

## 8. Discrete-receiver apps (REAPER-class fix)

- `BUILTIN_DISCRETE_WHEEL_APPS: &["reaper.exe"]` — a constant in `hook_wiring.rs` (not settings).
- `AppSettings.discrete_wheel_apps: Vec<String>` (default `[]`), canonicalized with the existing `canonicalize_process_name` (case-insensitive, `.exe` normalization — same as `game_mode`).
- **Mechanism: override the resolved output mode, no new routing.** In `resolve_active` (`hook_wiring.rs`), after the existing `excluded_apps` / auto-disable pass-through checks, if the under-cursor or foreground process matches builtin ∪ user list, treat `wheel_output_mode` as `WheelOutputMode::PreserveWholeNotches` for that event. The existing resolver branch then produces `SmoothingStrategy::DiscreteNotchPreserving` for wheel/high-res sources — engine + emitter paths already exist (incl. modifier capture) — and produces its existing **raw pass-through for touchpads**, so REAPER's parameter wheels and touchpad gestures stay native for free. The `ProcessNameCache` (~20 Hz) already fetching under-cursor/foreground names is reused; no new syscalls.
- Precedence: `excluded_apps` / auto-disable (full pass-through) **>** discrete list (→ PreserveWholeNotches behavior) **>** the user's configured `wheel_output_mode`. Windows-only (process query availability); other platforms unchanged.
- Effect: matched apps receive whole 120-delta notches spaced per frame. One notch = one whole unit — exactly what REAPER's whole-unit receivers act on; a single notch releases within ~8 ms and fast rolls release at up to 120 notches/s, so parameter wheels (faders/knobs) feel effectively native. Scope is per-app only — never global (the issue-14 revert constraint).

## 9. Settings & migration

- `engine_timing: EngineTiming` (`"windows"` | `"legacy"`, serde lowercase, default `"windows"`) — top-level on `AppSettings`, no UI; mirrored into `EffectiveSettings` so the engine keeps reading settings from its existing parameter.
- `discrete_wheel_apps: Vec<String>` (default `[]`) — top-level, no UI.
- `CURRENT_SETTINGS_SCHEMA_VERSION` bump 1 → 2; migration = serde defaults only (no field removals/renames). Verify round-trip through `migrate_raw_settings` (save path) so the new fields survive backup/restore.

## 10. Testing plan

1. `window_model.rs` (pure):
   - Conservation: deterministic sequences — single notch, bursts, overlapping rolls, direction reversal, > 2048 overflow — `|sum(fed) − sum(paid)|` within the §6.3 bound.
   - Duration: nothing paid after `window_ms`; total paid by `window_ms` equals the fed amount (± rounding).
   - Shapes: Linear constant-rate; Out-curves monotone, cumulative → 1.
   - `payout_ease_for`: band edges (0.08), overlap/non-overlap, `gap = 0`.
   - End-of-gesture rounding: `|accum| ≥ 0.5` emits one pulse, `< 0.5` drops; ≤ 6 delta error.
2. `engine.rs`: accel factor applied at feed; instant flush; reset/ownership parity across both timings; pulse clamp carry.
3. `input_source.rs` + `mouse_hook.rs`: marker wins; varied-magnitude lock; fixed-magnitude → HighResWheel; notch clears evidence; `dwExtraInfo` propagated from hook event to classifier.
4. `hook_wiring.rs`: `reaper.exe` (mixed case / without `.exe`) → PreserveWholeNotches override; user-list entry; `excluded_apps` precedence; unlisted app unchanged; touchpad + listed app → existing raw pass-through branch.
5. Suite: `cargo test -p smoothscroll-core -p smoothscroll-platform` plus the app crate's Rust tests (landing vitest failures are pre-existing on master, out of scope).

## 11. Rollout

1. Core model + `engine_timing` switch → tests green.
2. Classifier + hook marker plumbing → tests green.
3. Discrete resolver + settings migration → tests green.
4. Release NSIS build (override `CARGO_TARGET_DIR` to D:; never build on C:).
5. User UAT (manual, by the user):
   - Browser: single notch, slow roll, fast flick — compare against legacy via the kill-switch.
   - REAPER: arrange h/v-scroll + zoom, MIDI editor — stall-then-jump gone; faders/knobs feel native.
   - Fallback: set `engine_timing: "legacy"` in settings.json — no reinstall needed.
6. Commit messages stay neutral (they feed the public in-app changelog).

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Continuous-roll feel becomes "fuller" (exact overlap adds vs decaying pool) | This is the intended improvement; UAT gate + legacy kill-switch |
| `ExponentialOut` window start is front-loaded (step-in at window join) | Overlap gap-rule keeps constant rate where easing would ripple; Out-curve end-slope ≈ 0 keeps the leaving step small |
| Classifier regression for existing touchpads | Marker layer is OS truth; magnitude lock fails safe toward "less smoothing"; legacy path unaffected |
| Two schedulers to maintain | Legacy branch is confined to existing code paths behind one enum; remove after one stable release cycle |
