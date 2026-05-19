# SmoothScroll v0.4 — Quality-of-Life Pass

**Date:** 2026-05-19
**Status:** Design / pre-implementation
**Scope:** App desktop — core scroll experience for general / coder / reader / creator users
**Source:** Self-audit (not external feedback)

## Goal

Lift the everyday scroll experience for all four primary user groups by closing five UX gaps. No new marketable features; deepen the feel of features that already exist. The design is one cohesive sprint with five independently shippable modules.

## Why this work

SmoothScroll is technically rich (engine + easing, per-app profiles, game mode, edge / keyboard / touchpad smoothing, hotkey, tray, 14 languages, auto-update). The audit found five UX gaps that touch every user group:

1. **First-run is opaque.** Sliders like "tail-to-head ratio" and "acceleration delta ms" appear before any introduction. Presets exist but no path leads users to them.
2. **Tweaking settings is guess-work.** The single sandbox provides no A/B comparison, so users rely on short-term sensory memory between adjustments.
3. **Tray is context-blind.** When scroll feels wrong in app X, users have to open Settings → Apps → search by `.exe` name. The tray has no awareness of the foreground app.
4. **Smoothing fights creative-app conventions.** `Ctrl+Wheel` zoom in Photoshop / VS Code, `Alt+Wheel` zoom in Premiere, `Ctrl+Wheel` font-size — all suffer from inertia and acceleration that make precision actions feel wrong.
5. **System "Reduce Motion" is ignored.** Users with vestibular sensitivity or who prefer instant-response systems get no respect from the engine.

The gaps were prioritised by an impact × effort × user-coverage matrix. All five affect 100% of users daily (#3, #4) or at meaningful moments (#1 first-run; #2 every settings session; #5 accessibility-conscious users always).

## Design principles

1. **Reuse existing infrastructure.** `ScrollPresets`, `app_categories.rs`, `EffectiveSettings` hot-path, `process_name_under_cursor` cache, `EngineSink::resolve_active`, `ProcessQuery::foreground_process_id`. New code only when nothing existing fits.
2. **No hot-path regression.** After Sprint 1 perf work, hot-path is microseconds per event. Every new feature flows through `EffectiveSettings` (one atomic load) or stays on cold paths. No new locks, no syscalls in routing.
3. **Each gap is an independent module.** Settings flag per gap so any module can ship alone or be disabled.
4. **Honor user choice and OS signals.** Reduce Motion, modifier intent, foreground context. The app must know when to be quiet.
5. **Backward compatible.** Settings deserialization already uses `#[serde(default)]`. New fields default to safe values; old settings.json files load unchanged.

## Out of scope (explicit YAGNI)

- Cloud sync of settings — separate concern, not requested
- Per-window profile (P3) — has its own spec, will follow
- Profile import/export (P2) — has its own spec, will follow
- AI-driven suggestions — overkill for the problems on the table
- Diagnostic dashboard — coder/creator users have logs; general users do not need this
- Marketing-driven new features — this pass is depth, not breadth

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  React UI (src/)                                            │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐   │
│  │ OnboardingWiz. │  │ Compare mode   │  │ TrayPanel    │   │
│  │ (Gap #1)       │  │ (Gap #2)       │  │  + Current-  │   │
│  │                │  │  + WASM engine │  │   App card   │   │
│  │                │  │                │  │   (Gap #3)   │   │
│  └────────────────┘  └────────────────┘  └──────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Settings UI: Precision Actions section (Gap #4)     │    │
│  │             Reduce Motion select (Gap #5)           │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Tauri IPC
┌──────────────────────────────▼──────────────────────────────┐
│  src-tauri/                                                 │
│                                                             │
│  Commands:                                                  │
│    get_foreground_app_context (Gap #3)                      │
│    apply_onboarding_preset    (Gap #1)                      │
│  EngineSink modifier branch   (Gap #4)                      │
│  AccessibilitySignals watcher (Gap #5)                      │
│  commit_settings recomputes EffectiveSettings.instant_mode  │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────┐           ┌─────────────────────────┐
│  crates/core/         │           │  crates/platform/       │
│                       │           │                         │
│  AppSettings:         │           │  AccessibilitySignals   │
│   + onboarding_*      │           │   trait + Win/Mac impl  │
│   + modifier_pass…    │           │  (Gap #5)               │
│   + respect_reduce…   │           │                         │
│   + (gap fields)      │           │                         │
│                       │           │                         │
│  EffectiveSettings:   │           │                         │
│   + modifier_ctrl_pt  │           │                         │
│   + modifier_alt_pt   │           │                         │
│   + instant_mode      │           │                         │
│                       │           │                         │
│  Engine.reset_axes()  │           │                         │
│  Engine.step instant  │           │                         │
│                       │           │                         │
│  WASM target          │           │                         │
│  (Gap #2)             │           │                         │
└───────────────────────┘           └─────────────────────────┘
```

## Ship order

| # | Gap | Effort | Risk | Rationale |
|---|---|---|---|---|
| 1 | #5 Reduce Motion | S | Low | Quick win, accessibility hygiene, isolates `AccessibilitySignals` trait early |
| 2 | #3 Current-app awareness | S | Low | Small, immediate everyday value, low blast radius |
| 3 | #4 Smart raw-mode (modifier passthrough) | M | Low | Biggest daily impact for coders/creators, hot-path change |
| 4 | #2 Live A/B preview (WASM) | L | Medium | Largest, foundation reused by #1 |
| 5 | #1 Onboarding wizard | M | Low | Last because it consumes the preview component from #2 |

Earlier modules do not depend on later ones for runtime behaviour. The order optimises for risk reduction and component reuse, not for dependency.

---

## Gap #5 — Honor system Reduce Motion

### Problem

The engine ignores OS-level Reduce Motion. Users with vestibular disorders, motion sensitivity, or a preference for instant-response systems get the full smoothing treatment unconditionally.

### Behaviour

- When OS reports Reduce Motion = ON and `respect_reduce_motion = Auto`, the engine flushes pending pixels instantly per `step()` instead of easing.
- SmoothScroll is **not disabled**. It still respects per-app exclude, modifier handling, horizontal smoothing toggles. It just skips inertia and easing.
- Three-mode setting: `Auto` (follow OS, default), `Always` (always instant), `Never` (ignore OS, smooth as configured).
- Settings UI shows live "OS reports: Reduce Motion ON/OFF" so the user understands why the engine is in instant mode.

### Implementation

**`crates/core/src/settings.rs`:**

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum RespectReduceMotion {
    #[default]
    Auto,
    Always,
    Never,
}

pub struct AppSettings {
    // ... existing
    pub respect_reduce_motion: RespectReduceMotion,
}

pub struct EffectiveSettings {
    // ... existing
    pub instant_mode: bool,
}
```

**`crates/platform/src/traits.rs`:**

```rust
pub trait AccessibilitySignals: Send + Sync {
    fn reduce_motion_enabled(&self) -> bool;
    fn watch(&self, on_change: Box<dyn Fn(bool) + Send + Sync>) -> Result<HookHandle>;
}
```

- Windows: `SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION)` returns false when Reduce Motion is on. Watcher uses `WM_SETTINGCHANGE`.
- macOS: `NSWorkspace.shared.accessibilityDisplayShouldReduceMotion`. Watcher subscribes to `NSWorkspaceAccessibilityDisplayOptionsDidChangeNotification`.

**`AppState`:** add `reduce_motion: Arc<AtomicBool>` and `accessibility: Arc<dyn AccessibilitySignals>`.

**`commit_settings` flow:**

```rust
let os_rm = state.reduce_motion.load(Ordering::Relaxed);
let instant = match settings.respect_reduce_motion {
    RespectReduceMotion::Always => true,
    RespectReduceMotion::Never  => false,
    RespectReduceMotion::Auto   => os_rm,
};
let mut eff = EffectiveSettings::from_settings(&settings);
eff.instant_mode = instant;
state.effective.store(Arc::new(eff));
```

Watcher callback re-runs `commit_settings` with the current settings snapshot when OS RM toggles.

**Engine `step()`:**

When `instant_mode` is true, convert all remaining pixels to wheel pulses immediately (same px → wheel-unit conversion as the easing path uses, just without the easing fraction):

```rust
fn flush_axis_instant(axis: &mut Axis) -> i32 {
    if axis.remaining_px.abs() < 0.1 {
        axis.remaining_px = 0.0;
        axis.unit_accum = 0.0;
        return 0;
    }
    let wheel_units = (axis.remaining_px / BASE_STEP_PX) * WHEEL_DELTA as f64;
    let units = wheel_units / EMIT_UNIT as f64;
    axis.unit_accum += units;
    let pulses = axis.unit_accum.trunc() as i32;
    axis.unit_accum -= pulses as f64;
    axis.remaining_px = 0.0;
    pulses.clamp(PULSE_CLAMP_MIN, PULSE_CLAMP_MAX) * EMIT_UNIT
}

// in step():
if settings.instant_mode {
    let v = flush_axis_instant(&mut self.v);
    let h = if settings.horizontal_smoothness {
        flush_axis_instant(&mut self.h)
    } else { 0 };
    return EngineOutput { vertical: v, horizontal: h };
}
// existing easing logic
```

Conversion mirrors the easing path so `instant_mode` produces the same total emitted pulses for a given input, just delivered in one frame instead of spread across `animation_time_ms`.

### UI

Settings → Preferences → new row "Respect system Reduce Motion" with Auto / Always / Never select. Below the select, a status line "OS Reduce Motion: ON / OFF" reflects the current OS state.

The status line subscribes to a new Tauri event `reduce-motion-changed` emitted by the watcher in `AppState` whenever the OS toggles RM. No polling.

### Tests

- `instant_mode_flushes_remaining_immediately` (engine unit)
- `respect_auto_follows_os_signal` (state integration with mock `AccessibilitySignals`)
- `respect_always_overrides_os_off`
- `respect_never_ignores_os_on`
- `windows_spi_query` (Windows-only unit)
- `macos_nsworkspace_query` (macOS-only unit)

### Performance

- One additional atomic load on hot-path = ~1 ns
- OS query and watcher dispatch off hot-path

### Risks

- Misleading UX if user does not know OS RM is on. Status indicator in Settings mitigates.
- Watcher leaks across reload — `HookHandle` drop-on-disable contract handles it.

---

## Gap #3 — Current-app awareness in tray

### Problem

When scroll feels wrong in app X, users open Settings → Apps → search by `.exe` filename they may not know. Tray panel is closer to cursor, lighter-weight, and the natural place to act — but it has no awareness of which app the user is working in.

### Behaviour

When the tray panel opens it shows a "Current app" card at the top:

- Process name of the foreground app (captured **before** the tray window steals focus)
- Suggested category from `classify_app(name)` (e.g., "Creative", "IDE", "Browser")
- The currently assigned profile, with a dropdown to switch between Default, Disabled, or any user-created profile
- One-click "Disable for this app" toggle that wraps `add_excluded_app` / `remove_excluded_app`

If foreground capture fails (rare, e.g., Windows desktop), the card hides cleanly; the rest of the tray remains functional.

### Implementation

**Tray show flow (`src-tauri/src/tray.rs`):**

Before `window.show()` for the tray panel, snapshot the foreground process name into a new `AppState` field:

```rust
pub last_foreground_at_tray_open: Arc<Mutex<Option<String>>>,
```

This avoids the panel itself being detected as the foreground app. The snapshot is consumed (and cleared) by the next `get_foreground_app_context` call, so a stale value cannot leak between tray opens.

**New IPC command (`src-tauri/src/commands.rs`):**

```rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct ForegroundAppContext {
    pub process_name: Option<String>,
    pub suggested_category: Option<AppCategory>,
    pub suggested_category_label: Option<String>,
    pub current_profile_id: Option<String>,  // None = default, "__disabled__" = excluded
    pub is_excluded: bool,
}

#[tauri::command]
pub fn get_foreground_app_context(
    state: State<'_, Arc<AppState>>,
) -> ForegroundAppContext { ... }
```

Existing `assign_app_profile`, `add_excluded_app`, `remove_excluded_app` are reused unchanged.

**Frontend (`src/components/tray/CurrentAppCard.tsx`):**

- On TrayPanel mount and each `settings-changed` event, invoke `get_foreground_app_context`
- Render category icon + process name, profile `<Select>`, "Disable" toggle
- Re-poll every 2 s while panel is visible (foreground may change if user hovers another app, lightweight)
- Empty state: card hidden when `process_name == None`

i18n keys: `tray.current_app.*` for all 14 languages.

### Tests

- `get_foreground_app_context_returns_some_when_focused` (Rust integration with stub `ProcessQuery`)
- `get_foreground_app_context_returns_none_gracefully` (no foreground)
- `current_app_card_renders_with_profile` (React component)
- `current_app_card_hides_when_no_process` (React component)
- `assigning_profile_via_dropdown_commits_settings` (integration)

### Performance

Cold path only. Foreground query reuses existing `ProcessNameCache` (50 ms throttle). No hot-path impact.

### Risks

- Tray window stealing focus before snapshot — handled by capturing in `tray.rs` before `show()`.
- Privacy: only the same process names already used by exclude/profile features. No new surface.

---

## Gap #4 — Smart raw-mode (modifier passthrough)

### Problem

`Ctrl+Wheel` and `Alt+Wheel` carry "precision action" intent in nearly every creative and developer app: zoom canvas, zoom timeline, zoom font size, zoom map. SmoothScroll currently routes these through the engine, so the user gets:

- Inertia after releasing Ctrl → font keeps growing
- Acceleration → zoom skips levels
- Smoothing → zoom feels rubbery

Shift is already handled (horizontal smoothing). Ctrl and Alt are not.

### Behaviour

| Modifier state | Action |
|---|---|
| (none) | Smooth |
| Shift | Horizontal smooth (existing behaviour, unchanged) |
| Ctrl (or Cmd on macOS) | Pass-through (raw delta), inertia cleared on press |
| Alt | Pass-through, inertia cleared on press |
| Ctrl+Shift | Pass-through |
| Ctrl+Alt | Pass-through |
| Win | Smooth (rare combo, safest default) |

User can override per-modifier through Settings. Defaults are ON.

### Implementation

**`AppSettings`:**

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModifierPassthrough {
    pub ctrl: bool,
    pub alt: bool,
    pub clear_inertia_on_press: bool,
}

impl Default for ModifierPassthrough {
    fn default() -> Self { Self { ctrl: true, alt: true, clear_inertia_on_press: true } }
}

pub struct AppSettings {
    // ...
    pub modifier_passthrough: ModifierPassthrough,
}
```

**`EffectiveSettings` adds three fields** (still `Copy`):

```rust
pub modifier_ctrl_passthrough: bool,
pub modifier_alt_passthrough: bool,
pub modifier_clear_inertia: bool,
```

**`SmoothScrollEngine::reset_axes()`** — sets `remaining_px` and `unit_accum` to zero on both axes. Two stores, no allocation.

**`hook_wiring.rs::route_vertical_with_source`:** insert after exclude resolution, before `update_last_source`:

```rust
#[cfg(target_os = "macos")]
let precision = (mods.cmd && eff.modifier_ctrl_passthrough)
    || (mods.alt && eff.modifier_alt_passthrough);
#[cfg(not(target_os = "macos"))]
let precision = (mods.ctrl && eff.modifier_ctrl_passthrough)
    || (mods.alt && eff.modifier_alt_passthrough);

if precision {
    if eff.modifier_clear_inertia {
        self.state.engine.lock().reset_axes();
    }
    return HookDecision::Pass;
}
```

Same branch in `route_horizontal_with_source`.

**`ModifierKeys` (`crates/platform/src/types.rs`)** add `cmd: bool` (currently only `shift / ctrl / alt`). Populated by:
- macOS event tap: `flags & kCGEventFlagMaskCommand != 0`
- Windows low-level mouse hook: always `false` (no Cmd key on Windows)

This keeps the same `ModifierKeys` shape across platforms; the cross-platform branch in routing reads `cmd` only inside `#[cfg(target_os = "macos")]`.

### UI

Settings → Scroll → new "Precision Actions" section with three toggles:

- "Pass-through Ctrl + wheel (recommended for zoom)"
- "Pass-through Alt + wheel (recommended for editors and timelines)"
- "Clear inertia when modifier pressed"

A short help line under each. macOS shows "Cmd + wheel" instead of "Ctrl + wheel" via i18n key swap.

### Tests

- `ctrl_wheel_passes_through_when_enabled` (EngineSink unit)
- `ctrl_wheel_smooths_when_disabled`
- `alt_wheel_passes_through`
- `cmd_wheel_passes_through_macos` (`#[cfg(target_os = "macos")]`)
- `inertia_cleared_when_modifier_pressed` (engine state inspection)
- `shift_still_routes_to_horizontal` (regression)
- `modifier_combo_ctrl_shift_passes_through`

### Performance

Two boolean ANDs and one branch added per event. ~1 ns. `reset_axes` only called on press transitions (rare). No measurable impact.

### Risks

- Apps that use Ctrl+Wheel for horizontal scroll (Visual Studio classic, some Office tools) — user toggles off if needed. Help text describes the trade-off.
- Game Mode is unaffected (already bypasses the engine).
- First-time surprise — release notes explicitly call this out; tooltip in Settings explains the rationale.

---

## Gap #2 — Live A/B preview (Compare mode)

### Problem

Today's `TestSandboxSection` lets the user scroll once with the current settings. To compare two configurations the user must adjust, scroll, remember the feel, adjust again, scroll, compare to a sensory memory that fades in seconds. This makes tuning a guess-and-check loop.

### Behaviour

A "Compare" toggle in TestSandboxSection turns the sandbox into two side-by-side scroll panes:

- Pane A uses the saved settings
- Pane B uses the currently edited (unsaved) settings
- Hovering a pane routes wheel events to that pane's engine instance
- Two actions: "Swap A ↔ B" reverses which side has which settings; "Apply B as new default" commits B

When Compare is off, the sandbox falls back to the existing single-pane behaviour.

### Architecture decision

The preview must use the **same engine math** as native, otherwise tuning in Compare mode misleads the user. Three options were considered:

- **Option A — IPC round-trip per wheel.** Rejected: 1–3 ms latency distorts the very thing we are measuring.
- **Option B — Compile `crates/core` engine to WASM, run in-webview.** Selected. Engine is pure math (~150 LOC), no OS deps. Bundle ~30 KB. Both native and preview share `engine.rs`, eliminating drift.
- **Option C — Re-implement engine in JS.** Rejected: two sources of truth, drift over time.

### Implementation

**`crates/core` add `wasm32-unknown-unknown` target:**

The crate currently depends on `tracing`, `serde`, `serde_json`, `thiserror`, and `directories` (settings disk IO). For WASM:

- New cargo feature `wasm` enables `wasm-bindgen` and the `wasm.rs` exports
- `directories` and the `settings::settings_path / load / save` functions are gated `#[cfg(not(target_arch = "wasm32"))]` — the engine and types compile cleanly without them
- `tracing` is wasm-compatible (no-op subscriber) and stays unconditional
- `wasm-pack build --target web --features wasm` produces `pkg/`
- A small build script (`build-wasm.sh` / `build-wasm.ps1`) wires output into `src/lib/engine-wasm/`
- CI adds a `wasm-pack build` step alongside `cargo test --workspace`

**Exported WASM API** (a thin wrapper in `crates/core/src/wasm.rs` behind `#[cfg(feature = "wasm")]`):

```rust
#[wasm_bindgen]
pub struct WasmEngine { engine: SmoothScrollEngine, settings: EffectiveSettings }

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(json_settings: &str) -> Self { ... }

    pub fn update_settings(&mut self, json_settings: &str) { ... }

    pub fn on_wheel(&mut self, delta: i32, now_ms: f64) { ... }

    pub fn step(&mut self, dt_ms: f64) -> Box<[i32]> { /* [v, h] */ }

    pub fn has_pending_work(&self) -> bool { ... }
}
```

`EffectiveSettings` derives `Deserialize` (already does) so JSON crossing the JS/Rust boundary is the same shape native uses.

**Frontend (`src/components/preview/`):**

- `useWasmEngine(settings)` hook: lazy-loads WASM module, reconstructs engine on settings change
- `<ScrollPreviewArea engine content />` — captures wheel via `onWheel`, runs RAF loop driving `scrollTop` from `engine.step(dt)`
- `<ScrollComparePane settingsA settingsB />` — two `<ScrollPreviewArea>` side-by-side, hover-gates wheel routing

Compare toggle lives in `TestSandboxSection` header. Layout: two columns on ≥768 px, stacked on smaller.

### Tests

- `wasm_engine_matches_native_for_same_input` — port representative cases from `engine_tests.rs` to a wasm-bindgen-test, assert equal outputs
- `compare_pane_routes_wheel_to_hovered_area_only` (component)
- `apply_b_commits_settings_correctly` (integration)
- `swap_swaps_a_b_settings` (component)
- Manual smoke: distinct presets feel distinct side-by-side

### Performance

- WASM bundle ~30 KB gzipped, lazy-loaded only when sandbox section mounts
- Two engine instances + two RAF loops: ~240 Hz total event work, trivial on modern hardware
- No native hot-path impact

### Risks

- WASM build complicates the Tauri build pipeline. Mitigation: build script gated to dev / release, CI caches `pkg/`.
- Cross-compile of `crates/core` to wasm32 must avoid OS-only deps. Engine has none today; settings module uses `directories` and `serde_json` for disk IO — gate disk path behind `#[cfg(not(target_arch = "wasm32"))]`.
- Fallback path documented: if WASM proves unstable, demote to "Option D — sequential A/B toggle" in a single pane. Not the default plan, but a documented escape hatch.

---

## Gap #1 — Onboarding wizard

### Problem

A first-time user opens Settings and sees sliders labelled "Step size px" and "Tail-to-head ratio". They have no path to the right preset. Existing `ScrollPresets` is a flat row of six buttons with no narrative.

### Behaviour

Three-step modal shown the first time Settings opens, when `onboarding_completed_at == None` and settings are still at defaults:

1. **Use case** — Reader / Coder / Designer / General
2. **Feel** — Glide / Balanced / Snappy
3. **Try it** — embedded `<ScrollPreviewArea>` with the chosen preset; user scrolls, then commits or goes back

Each step has a Skip button. Skip writes the timestamp so the wizard does not re-appear. About tab gets a "Re-run setup" link to invoke it manually later.

### Preset matrix

| Use case × Feel | Glide | Balanced | Snappy |
|---|---|---|---|
| Reader | mac_like | default + step 100 | fast |
| Coder | default + time 300 | default | snappy + Ctrl/Alt passthrough ON |
| Designer | mac_like + step 80 + Ctrl/Alt passthrough ON | default + Ctrl/Alt passthrough ON | fast + Ctrl/Alt passthrough ON |
| General | mac_like | default | snappy |

Designer and Coder Snappy implicitly enable modifier passthrough because those users commonly zoom; this matches the Gap #4 default but makes the user's choice explicit.

### Implementation

**`AppSettings`:**

```rust
pub onboarding_completed_at: Option<u64>,  // unix seconds
```

**Detection logic** (frontend, on Settings mount):

- If `onboarding_completed_at == Some(_)` → never show
- If settings differ from defaults on key fields (`step_size_px`, `animation_time_ms`, `easing_mode`) → assume migrated user, write timestamp, do not show
- Otherwise → show wizard

**New IPC command:**

```rust
#[tauri::command]
pub fn apply_onboarding_preset(
    state: State<'_, Arc<AppState>>,
    use_case: String,
    feel: String,
) -> Result<(), String>
```

Maps `(use_case, feel)` to a preset patch, applies it, writes `onboarding_completed_at`, persists, commits. Invalid combinations return an error.

**Frontend (`src/components/onboarding/`):**

- `<OnboardingWizard onComplete />` — full-screen overlay, three-step state machine via `useReducer`
- Reuses `<ScrollPreviewArea>` from Gap #2 for Step 3
- CSS slide transitions, no animation library
- Code-split so the wizard does not bloat initial bundle

i18n keys: `onboarding.step1.*`, `onboarding.step2.*`, `onboarding.step3.*`, `onboarding.actions.*` for all 14 languages.

### Tests

- Wizard shows when `onboarding_completed_at == None` and settings are default
- Wizard does not show when timestamp is set
- Wizard does not show when settings already differ from defaults on key fields
- Each (use_case, feel) commits the correct preset
- Re-run from About tab works
- Step 3 sandbox uses the preset selected in Steps 1 and 2

### Performance

Code-split bundle, mounted only when needed. Negligible.

### Risks

- i18n burden: ~80–100 new keys × 14 languages. Acceptable for the scope.
- "Modifier passthrough ON" baked into Coder/Designer presets is a behaviour change. Mitigated because Gap #4 already defaults these ON; the wizard makes it visible rather than introducing it.

---

## Settings schema additions

```rust
pub struct AppSettings {
    // existing fields ...

    // Gap #5
    pub respect_reduce_motion: RespectReduceMotion,

    // Gap #4
    pub modifier_passthrough: ModifierPassthrough,

    // Gap #1
    pub onboarding_completed_at: Option<u64>,
}

pub struct EffectiveSettings {
    // existing fields ...

    // Gap #5
    pub instant_mode: bool,

    // Gap #4
    pub modifier_ctrl_passthrough: bool,
    pub modifier_alt_passthrough: bool,
    pub modifier_clear_inertia: bool,
}
```

All new fields have safe defaults. `#[serde(default)]` on `AppSettings` already handles old settings.json without these keys.

## IPC additions

| Command | Purpose | Gap |
|---|---|---|
| `get_foreground_app_context` | Tray context card | #3 |
| `apply_onboarding_preset(use_case, feel)` | Wizard finish | #1 |

No existing IPC contract changes.

## Cross-cutting concerns

### i18n

New keys grouped per gap. Estimated ~150 keys total across 14 languages. English first; translations can lag one release.

### Accessibility

Wizard fully keyboard-navigable, focus-trapped, ESC closes. CurrentAppCard dropdown uses existing `<Select>` Radix primitive (already accessible). Reduce Motion explicitly respected in this design.

### Telemetry

None added. Project policy: no telemetry.

### Backward compatibility

- `AppSettings` parses old files unchanged
- No migration step required beyond the existing `migrate_from_v1`
- Engine behaviour identical when all new flags are at defaults except for `modifier_passthrough` which defaults ON — release notes explicitly call this out

## Verification (definition of done)

For each gap, all of:

- [ ] Unit and integration tests in the gap's test plan pass
- [ ] `cargo fmt --all` clean
- [ ] `cargo clippy --workspace -- -D warnings` clean
- [ ] `cargo test --workspace` green
- [ ] No regression in `crates/core/benches/engine.rs` and hot-path bench (delta within ±5 % of baseline)
- [ ] Manual smoke per the gap's manual test (e.g., bind a test app, toggle modifier, verify feel)
- [ ] Settings file from previous version loads and runs without warning

## Open questions

None at design time. Questions surfaced during implementation should be raised in the implementation plan, not silently decided.
