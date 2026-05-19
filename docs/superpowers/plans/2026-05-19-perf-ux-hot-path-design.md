# Sprint 1 — Performance + UX Hot Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scrolling feel instantly responsive and free of jank during burst input, make app-aware profile switching imperceptible when the cursor moves between windows, and keep the settings UI snappy even when toggles are spammed.

**Architecture:** Split the authoritative `AppSettings` (owned by `RwLock`) from a hot-path snapshot (`EffectiveSettings`, stored in `ArcSwap`). The engine becomes stateless w.r.t. settings — every hot call receives a `&EffectiveSettings` borrow. Settings writes go through a central `commit_settings` helper that atomically updates authoritative + snapshot + per-profile cache + debounced persistor. The hook callback holds `engine.lock()` exactly once per event.

**Tech Stack:** Rust (crates/core, crates/platform, src-tauri), `arc-swap` 1.x, `crossbeam-channel` 0.5, `parking_lot`, criterion 0.5 for benches.

**Spec reference:** `docs/superpowers/specs/2026-05-19-perf-ux-hot-path-design.md`

---

## File Structure

### Files modified (existing)

| File | What changes |
|---|---|
| `crates/core/src/engine.rs` | Remove `settings: AppSettings` field, add stateless `new()`, change `step`/`on_wheel`/`on_hwheel` signatures to take `&EffectiveSettings`. Keep `Default` impl. Remove `apply_settings`, `settings()`. |
| `crates/core/src/settings.rs` | Add `EffectiveSettings` struct + `from_settings` + `with_profile`. |
| `crates/core/Cargo.toml` | Add `criterion` dev-dependency + `[[bench]]` engine bench. |
| `crates/core/tests/engine_tests.rs` | Update tests to use `SmoothScrollEngine::default()` and the new API. Add `EffectiveSettings` mapping tests. |
| `src-tauri/src/state.rs` | Add `effective: Arc<arc_swap::ArcSwap<EffectiveSettings>>` and `effective_per_profile: Arc<RwLock<HashMap<String, Arc<EffectiveSettings>>>>`. Add `commit_settings` method. |
| `src-tauri/src/lib.rs` | Initialize `effective` + `effective_per_profile` on startup. Add `OwnedHandles` field for `SettingsPersistor`. Wire persistor shutdown to `RunEvent::Exit`. |
| `src-tauri/src/hook_wiring.rs` | Rewrite `resolve_active` to use `effective_per_profile` lookup. Remove `last_applied_profile` mutex. Add `ProcessNameCache` throttle. Rewrite `route_*_with_source` to single lock. Add lazy tracing guards. |
| `src-tauri/src/commands.rs` | Replace all `settings::save(...)` calls in setters with `state.commit_settings(...)`. Update `set_enabled` reset to use `SmoothScrollEngine::default()`. Update `save_settings` to use `commit_settings`. |
| `src-tauri/src/engine_thread.rs` | Update `step` call to pass `&state.effective.load()`. |
| `src-tauri/src/edge_scroll_thread.rs` | Update `on_wheel` call to pass `InputSource::Wheel` and `&state.effective.load()`. |
| `src-tauri/src/keyboard_sink.rs` | Take `state.effective.load_full()` before locking engine (low-frequency path, spec § 4.1). |
| `src-tauri/Cargo.toml` | Add `arc-swap`, `crossbeam-channel` dependencies and `criterion` dev-dependency + `[[bench]]` hot_path bench. |

### Files created (new)

| File | What it does |
|---|---|
| `src-tauri/src/settings_persistor.rs` | `SettingsPersistor` actor: debounced disk writes on a background thread, flush-on-shutdown. |
| `crates/core/benches/engine.rs` | Criterion bench: `on_wheel_with_source` per-call, `step` across pending delta sizes. |
| `src-tauri/benches/hot_path.rs` | Criterion bench: `route_vertical_with_source` throughput, `resolve_active` with 0/1/10 profiles. |

---

## Commit Sequence

| # | Commit message | Summary |
|---|---|---|
| 1 | `chore: cargo fmt --all` | Pure formatter, zero logic changes |
| 2 | `feat(core): add EffectiveSettings and stateless engine API` | § 4.0 + § 4.1 types |
| 3 | `feat(app): wire effective + effective_per_profile + commit_settings` | § 4.1 AppState + § 4.7 |
| 4 | `feat(app): debounced settings persistor` | § 4.6 new module |
| 5 | `refactor(app): switch all setters to commit_settings + persistor.submit` | § 4.6 callers |
| 6 | `perf(hook): single critical section + process-name throttle + lazy tracing` | § 4.2–4.5 |
| 7 | `bench: criterion benches for engine and hook hot path` | § 7 benches |

---

## Task 1: `chore: cargo fmt --all`

**Files:**
- Modify: all `.rs` files in `crates/` and `src-tauri/src/`

- [ ] **Step 1: Run cargo fmt**

```bash
cargo fmt --all
```

- [ ] **Step 2: Verify no logic changes**

```bash
cargo fmt --all --check
```

Expected: PASS (no diff).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: cargo fmt --all"
```

---

## Task 2: Add `EffectiveSettings` type and stateless engine API

**Files:**
- Modify: `crates/core/src/settings.rs`
- Modify: `crates/core/src/engine.rs`
- Modify: `crates/core/tests/engine_tests.rs`
- Modify: `crates/core/Cargo.toml`

### Task 2a: Add `EffectiveSettings` to settings.rs

- [ ] **Step 1: Add `EffectiveSettings` struct after the `ScrollProfile` impl block**

Find the closing brace of `impl AppSettings { ... }` at line 280 in `crates/core/src/settings.rs`. Add the following type immediately after it (before `is_valid_accelerator`):

```rust
/// Hot-path subset of AppSettings — only fields the engine needs per event.
/// No Vec, no HashMap. Cheap to clone, cheap to swap.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EffectiveSettings {
    pub step_size_px: i32,
    pub animation_time_ms: i32,
    pub acceleration_delta_ms: i32,
    pub acceleration_max: i32,
    pub tail_to_head_ratio: i32,
    pub animation_easing: bool,
    pub easing_mode: EasingMode,
    pub reverse_wheel_direction: bool,
    pub horizontal_smoothness: bool,
    pub shift_key_horizontal: bool,
    pub touchpad_smoothing_enabled: bool,
    pub touchpad_pixel_multiplier: f64,
    pub touchpad_acceleration_factor: f64,
}

impl EffectiveSettings {
    /// Build from the global (default) settings.
    pub fn from_settings(s: &AppSettings) -> Self {
        Self {
            step_size_px: s.step_size_px,
            animation_time_ms: s.animation_time_ms,
            acceleration_delta_ms: s.acceleration_delta_ms,
            acceleration_max: s.acceleration_max,
            tail_to_head_ratio: s.tail_to_head_ratio,
            animation_easing: s.animation_easing,
            easing_mode: s.easing_mode,
            reverse_wheel_direction: s.reverse_wheel_direction,
            horizontal_smoothness: s.horizontal_smoothness,
            shift_key_horizontal: s.shift_key_horizontal,
            touchpad_smoothing_enabled: s.touchpad_smoothing_enabled,
            touchpad_pixel_multiplier: s.touchpad_pixel_multiplier,
            touchpad_acceleration_factor: s.touchpad_acceleration_factor,
        }
    }

    /// Build from a base settings + profile, merging profile overrides.
    pub fn with_profile(base: &AppSettings, profile: &ScrollProfile) -> Self {
        Self {
            step_size_px: profile.step_size_px,
            animation_time_ms: profile.animation_time_ms,
            acceleration_delta_ms: profile.acceleration_delta_ms,
            acceleration_max: profile.acceleration_max,
            tail_to_head_ratio: profile.tail_to_head_ratio,
            animation_easing: profile.animation_easing,
            easing_mode: profile.easing_mode,
            reverse_wheel_direction: profile.reverse_wheel_direction,
            horizontal_smoothness: profile.horizontal_smoothness,
            shift_key_horizontal: base.shift_key_horizontal,
            touchpad_smoothing_enabled: base.touchpad_smoothing_enabled,
            touchpad_pixel_multiplier: base.touchpad_pixel_multiplier,
            touchpad_acceleration_factor: base.touchpad_acceleration_factor,
        }
    }
}
```

### Task 2b: Refactor `SmoothScrollEngine` to be stateless

- [ ] **Step 1: Replace the `Axis::register_notch` and `Axis::step` signatures**

In `crates/core/src/engine.rs`, change `Axis::register_notch` and `Axis::step` to take `&EffectiveSettings` instead of `&AppSettings`:

```rust
// Line ~25: change
fn register_notch(&mut self, now_ms: u64, delta: i32, settings: &AppSettings) {
// to
fn register_notch(&mut self, now_ms: u64, delta: i32, settings: &EffectiveSettings) {
```

```rust
// Line ~47: change
fn step(&mut self, dt_ms: f64, settings: &AppSettings) -> i32 {
// to
fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> i32 {
```

Update the body of both methods: replace every `settings.acceleration_delta_ms` → `settings.acceleration_delta_ms`, `settings.step_size_px` → `settings.step_size_px`, `settings.easing_mode` → `settings.easing_mode`, `settings.tail_to_head_ratio` → `settings.tail_to_head_ratio`, `settings.animation_easing` → `settings.animation_easing`, `settings.animation_time_ms` → `settings.animation_time_ms`. These names are identical in both types so no body changes are needed inside the methods — only the parameter type annotation changes.

- [ ] **Step 2: Remove `settings` field from `SmoothScrollEngine` and update constructor**

```rust
// Line ~83-88: change
#[derive(Debug)]
pub struct SmoothScrollEngine {
    settings: AppSettings,   // REMOVE THIS LINE
    v: Axis,
    h: Axis,
}
```

```rust
// Line ~90-97: change
impl SmoothScrollEngine {
    pub fn new() -> Self {
        Self {
            v: Axis::default(),
            h: Axis::default(),
        }
    }
```

- [ ] **Step 3: Remove `apply_settings` and `settings()` methods**

Remove lines ~99-105 in `crates/core/src/engine.rs`:

```rust
    pub fn apply_settings(&mut self, settings: AppSettings) {
        self.settings = settings;
    }

    pub fn settings(&self) -> &AppSettings {
        &self.settings
    }
```

- [ ] **Step 4: Add `Default` impl**

After the `new()` constructor (after the closing brace of `impl SmoothScrollEngine`), add:

```rust
impl Default for SmoothScrollEngine {
    fn default() -> Self {
        Self::new()
    }
}
```

- [ ] **Step 5: Change `on_wheel`/`on_hwheel` (no-source variants) to delegate to with_source**

Replace the no-source methods:

```rust
    pub fn on_wheel(&mut self, delta: i32, now_ms: u64) {
        self.on_wheel_with_source(delta, now_ms, crate::input_source::InputSource::Wheel);
    }

    pub fn on_hwheel(&mut self, delta: i32, now_ms: u64) {
        self.on_hwheel_with_source(delta, now_ms, crate::input_source::InputSource::Wheel);
    }
```

- [ ] **Step 6: Change `on_wheel_with_source` and `on_hwheel_with_source` signatures**

Replace both methods' signatures and bodies. The old signatures take no settings; the new ones take `settings: &EffectiveSettings`:

```rust
    pub fn on_wheel_with_source(
        &mut self,
        delta: i32,
        now_ms: u64,
        source: crate::input_source::InputSource,
        settings: &EffectiveSettings,
    ) {
        use crate::input_source::InputSource;
        let dir = if settings.reverse_wheel_direction { -1 } else { 1 };
        match source {
            InputSource::Wheel | InputSource::HighResWheel => {
                self.v.register_notch(now_ms, delta * dir, settings);
            }
            InputSource::Touchpad => {
                if !settings.touchpad_smoothing_enabled {
                    self.v.register_notch(now_ms, delta * dir, settings);
                    return;
                }
                let px = (delta as f64 / crate::constants::WHEEL_DELTA as f64)
                    * crate::constants::BASE_STEP_PX
                    * dir as f64;
                self.v.register_pixels(px, now_ms, settings.touchpad_pixel_multiplier);
            }
        }
    }

    pub fn on_hwheel_with_source(
        &mut self,
        delta: i32,
        now_ms: u64,
        source: crate::input_source::InputSource,
        settings: &EffectiveSettings,
    ) {
        use crate::input_source::InputSource;
        let dir = if settings.reverse_wheel_direction { -1 } else { 1 };
        match source {
            InputSource::Wheel | InputSource::HighResWheel => {
                self.h.register_notch(now_ms, delta * dir, settings);
            }
            InputSource::Touchpad => {
                if !settings.touchpad_smoothing_enabled {
                    self.h.register_notch(now_ms, delta * dir, settings);
                    return;
                }
                let px = (delta as f64 / crate::constants::WHEEL_DELTA as f64)
                    * crate::constants::BASE_STEP_PX
                    * dir as f64;
                self.h.register_pixels(px, now_ms, settings.touchpad_pixel_multiplier);
            }
        }
    }
```

- [ ] **Step 7: Change `step` signature to take `&EffectiveSettings`**

Replace `step` at line ~155:

```rust
    pub fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> EngineOutput {
        let v = self.v.step(dt_ms, settings);
        let h = if settings.horizontal_smoothness {
            self.h.step(dt_ms, settings)
        } else {
            0
        };
        EngineOutput {
            vertical: v,
            horizontal: h,
        }
    }
```

- [ ] **Step 8: Remove `AppSettings` import from engine.rs**

The `use crate::settings::AppSettings;` line at the top of `engine.rs` is no longer needed. Remove it.

Add the import for `EffectiveSettings`:

```rust
use crate::settings::EffectiveSettings;
```

- [ ] **Step 9: Verify compilation**

```bash
cargo check -p smoothscroll_core
```

Expected: PASS.

### Task 2c: Add `EffectiveSettings` unit tests

- [ ] **Step 1: Add mapping tests to `crates/core/tests/settings_tests.rs`**

Open `crates/core/tests/settings_tests.rs`. If it exists, append these tests. If it doesn't exist, create it:

```rust
use smoothscroll_core::settings::{AppSettings, EffectiveSettings, ScrollProfile};

#[test]
fn effective_settings_from_settings_copies_all_fields() {
    let mut s = AppSettings::default();
    s.step_size_px = 240;
    s.animation_time_ms = 500;
    s.acceleration_delta_ms = 100;
    s.acceleration_max = 10;
    s.tail_to_head_ratio = 5;
    s.animation_easing = false;
    s.easing_mode = smoothscroll_core::easing::EasingMode::CubicOut;
    s.reverse_wheel_direction = true;
    s.horizontal_smoothness = false;
    s.shift_key_horizontal = false;
    s.touchpad_smoothing_enabled = false;
    s.touchpad_pixel_multiplier = 1.5;
    s.touchpad_acceleration_factor = 2.0;

    let eff = EffectiveSettings::from_settings(&s);

    assert_eq!(eff.step_size_px, 240);
    assert_eq!(eff.animation_time_ms, 500);
    assert_eq!(eff.acceleration_delta_ms, 100);
    assert_eq!(eff.acceleration_max, 10);
    assert_eq!(eff.tail_to_head_ratio, 5);
    assert!(!eff.animation_easing);
    assert_eq!(eff.easing_mode, smoothscroll_core::easing::EasingMode::CubicOut);
    assert!(eff.reverse_wheel_direction);
    assert!(!eff.horizontal_smoothness);
    assert!(!eff.shift_key_horizontal);
    assert!(!eff.touchpad_smoothing_enabled);
    assert_eq!(eff.touchpad_pixel_multiplier, 1.5);
    assert_eq!(eff.touchpad_acceleration_factor, 2.0);
}

#[test]
fn effective_settings_with_profile_uses_profile_overrides() {
    let s = AppSettings::default();
    let mut profile = ScrollProfile::new("test", "Test");
    profile.step_size_px = 300;
    profile.animation_time_ms = 800;
    profile.easing_mode = smoothscroll_core::easing::EasingMode::Linear;

    let eff = EffectiveSettings::with_profile(&s, &profile);

    assert_eq!(eff.step_size_px, 300);
    assert_eq!(eff.animation_time_ms, 800);
    assert_eq!(eff.easing_mode, smoothscroll_core::easing::EasingMode::Linear);
    // These are inherited from base, not from profile
    assert_eq!(eff.shift_key_horizontal, s.shift_key_horizontal);
    assert_eq!(eff.touchpad_smoothing_enabled, s.touchpad_smoothing_enabled);
}

#[test]
fn effective_settings_is_copy() {
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    let eff2 = eff;
    assert_eq!(eff, eff2);
}
```

- [ ] **Step 2: Run tests**

```bash
cargo test -p smoothscroll_core -- settings
```

Expected: PASS.

### Task 2d: Update engine tests for new API

- [ ] **Step 1: Update `crates/core/tests/engine_tests.rs`**

The `SmoothScrollEngine` now needs `EffectiveSettings` passed to its hot methods. The constructor is `new()` (no args), and `Default` works. All `step` calls need a settings argument, all `on_wheel`/`on_hwheel`/`on_wheel_with_source` calls need a settings argument.

Key updates needed:

1. Replace `SmoothScrollEngine::new(settings())` → `SmoothScrollEngine::new()` (the no-arg constructor).
2. Replace all `e.step(N)` → `e.step(N, &EffectiveSettings::from_settings(&AppSettings::default()))`.
3. Replace all `e.on_wheel(delta, ts)` → `e.on_wheel_with_source(delta, ts, InputSource::Wheel, &EffectiveSettings::from_settings(&AppSettings::default()))`.
4. Replace all `e.on_hwheel(delta, ts)` → `e.on_hwheel_with_source(delta, ts, InputSource::Wheel, &EffectiveSettings::from_settings(&AppSettings::default()))`.
5. Replace all `e.on_wheel_with_source(delta, ts, source)` → `e.on_wheel_with_source(delta, ts, source, &EffectiveSettings::from_settings(&AppSettings::default()))`.

For tests that need specific settings (e.g., `reverse_wheel_direction`), construct an `EffectiveSettings` directly:

```rust
let eff = EffectiveSettings {
    step_size_px: 120,
    animation_time_ms: 360,
    acceleration_delta_ms: 70,
    acceleration_max: 7,
    tail_to_head_ratio: 3,
    animation_easing: true,
    easing_mode: smoothscroll_core::easing::EasingMode::ExponentialOut,
    reverse_wheel_direction: true,  // set per test
    horizontal_smoothness: true,
    shift_key_horizontal: true,
    touchpad_smoothing_enabled: true,
    touchpad_pixel_multiplier: 1.0,
    touchpad_acceleration_factor: 1.0,
};
```

6. Remove the `apply_settings_updates_internal_settings` test (that method no longer exists).

7. Add `EffectiveSettings` import: `use smoothscroll_core::settings::EffectiveSettings;`

- [ ] **Step 2: Run tests**

```bash
cargo test -p smoothscroll_core -- engine
```

Expected: PASS.

### Task 2e: Add criterion bench scaffold to core

- [ ] **Step 1: Add bench dependencies and section to `crates/core/Cargo.toml`**

Find the `[dev-dependencies]` section and add:

```toml
[dev-dependencies]
approx = "0.5"
criterion = { version = "0.5", default-features = false }

[[bench]]
name = "engine"
harness = false
```

- [ ] **Step 2: Create `crates/core/benches/engine.rs`**

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::EffectiveSettings;

fn default_effective() -> EffectiveSettings {
    EffectiveSettings::from_settings(&smoothscroll_core::settings::AppSettings::default())
}

fn bench_on_wheel_with_source(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();
    let source = InputSource::Wheel;

    c.bench_function("on_wheel_with_source", |b| {
        b.iter(|| {
            engine.on_wheel_with_source(black_box(120), black_box(0), black_box(source), &eff);
        });
    });
}

fn bench_step_small_delta(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();
    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &eff);

    c.bench_function("step_small_delta", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

fn bench_step_large_delta(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();
    // Feed enough to create a large pending pixel count
    for i in 0..10 {
        engine.on_wheel_with_source(120, i * 10, InputSource::Wheel, &eff);
    }

    c.bench_function("step_large_delta", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

fn bench_on_wheel_touchpad(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_effective();

    c.bench_function("on_wheel_with_source_touchpad", |b| {
        b.iter(|| {
            engine.on_wheel_with_source(black_box(30), black_box(0), black_box(InputSource::Touchpad), &eff);
        });
    });
}

criterion_group!(
    benches,
    bench_on_wheel_with_source,
    bench_step_small_delta,
    bench_step_large_delta,
    bench_on_wheel_touchpad
);
criterion_main!(benches);
```

- [ ] **Step 3: Verify bench compiles**

```bash
cargo check --bench engine -p smoothscroll_core
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(core): add EffectiveSettings and stateless engine API"
```

---

## Task 3: Wire `effective` + `effective_per_profile` + `commit_settings` into AppState

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`

### Task 3a: Update `src-tauri/src/state.rs`

- [ ] **Step 1: Replace the entire `state.rs` content**

The file currently is very short. Replace it entirely:

```rust
//! Shared mutable state for the Tauri app.

use arc_swap::ArcSwap;
use parking_lot::{Condvar, Mutex, RwLock};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
use smoothscroll_platform::traits::{
    Autostart, FullscreenDetector, HookHandle, Hotkey, HotkeyHandle, KeyboardScrollHook,
    MouseHook, ProcessQuery, WheelEmitter, WindowGeometry,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU8};
use std::sync::Arc;

#[derive(Default)]
pub struct EngineSignal {
    pub mutex: Mutex<bool>,
    pub cv: Condvar,
}

impl EngineSignal {
    pub fn signal(&self) {
        let mut flag = self.mutex.lock();
        *flag = true;
        self.cv.notify_all();
    }
}

#[allow(dead_code)]
pub struct AppState {
    pub engine: Arc<Mutex<SmoothScrollEngine>>,
    /// Authoritative store — written by commands, persisted to disk.
    pub settings: Arc<RwLock<AppSettings>>,
    /// Hot-path snapshot. Updated whenever `settings` changes or active profile changes.
    /// Readers are lock-free (one atomic load + Arc clone).
    pub effective: Arc<ArcSwap<EffectiveSettings>>,
    /// Pre-built EffectiveSettings per profile ID. Rebuilt on profile CRUD.
    pub effective_per_profile: Arc<RwLock<HashMap<String, Arc<EffectiveSettings>>>>,
    pub mouse_hook: Arc<dyn MouseHook>,
    pub emitter: Arc<dyn WheelEmitter>,
    pub processes: Arc<dyn ProcessQuery>,
    pub autostart: Arc<dyn Autostart>,
    pub hotkey: Arc<dyn Hotkey>,
    pub hotkey_handle: Arc<Mutex<Option<HotkeyHandle>>>,
    pub keyboard_hook: Arc<dyn KeyboardScrollHook>,
    pub keyboard_handle: Arc<Mutex<Option<HookHandle>>>,
    pub engine_signal: Arc<EngineSignal>,
    pub enabled: Arc<AtomicBool>,
    pub game_mode_active: Arc<AtomicBool>,
    pub fullscreen_detector: Arc<dyn FullscreenDetector>,
    pub window_geom: Arc<dyn WindowGeometry>,
    pub last_input_source: Arc<AtomicU8>,
}

impl AppState {
    /// Atomically replace the authoritative settings, rebuild the hot-path
    /// effective snapshot, rebuild the per-profile cache, and queue a debounced
    /// disk write. This is the ONLY path that should mutate settings.
    pub fn commit_settings(&self, new: AppSettings) {
        let new_eff = EffectiveSettings::from_settings(&new);
        let new_per_profile: HashMap<String, Arc<EffectiveSettings>> = new
            .profiles
            .iter()
            .map(|p| {
                (
                    p.id.clone(),
                    Arc::new(EffectiveSettings::with_profile(&new, p)),
                )
            })
            .collect();
        {
            let mut w = self.settings.write();
            *w = new.clone();
        }
        self.effective.store(Arc::new(new_eff));
        *self.effective_per_profile.write() = new_per_profile;
    }
}
```

### Task 3b: Update `src-tauri/src/lib.rs`

- [ ] **Step 1: Add imports at top of lib.rs**

Find the `use` block at the top of `src-tauri/src/lib.rs`. Add `ArcSwap` and `EffectiveSettings`:

```rust
use arc_swap::ArcSwap;
use parking_lot::{Mutex, RwLock};
```

Add `EffectiveSettings` and `AppSettings` to the existing imports from `smoothscroll_core`:

```rust
use smoothscroll_core::settings::{self, AppSettings, EffectiveSettings};
```

- [ ] **Step 2: Update `run()` initialization to build effective and effective_per_profile**

Find the section in `run()` that creates `loaded_settings` and `settings_arc`. After creating `settings_arc`, build the initial `effective` and `effective_per_profile`:

```rust
    let loaded_settings = settings::load();
    let enabled_initial = loaded_settings.enabled;
    let engine = Arc::new(Mutex::new(SmoothScrollEngine::new()));
    let settings_arc = Arc::new(RwLock::new(loaded_settings.clone()));

    // Build initial hot-path snapshots
    let initial_eff = EffectiveSettings::from_settings(&loaded_settings);
    let effective_arc = Arc::new(ArcSwap::from_pointee(initial_eff));
    let effective_per_profile: std::collections::HashMap<String, Arc<EffectiveSettings>> = loaded_settings
        .profiles
        .iter()
        .map(|p| {
            (
                p.id.clone(),
                Arc::new(EffectiveSettings::with_profile(&loaded_settings, p)),
            )
        })
        .collect();
    let effective_per_profile_arc = Arc::new(RwLock::new(effective_per_profile));
```

- [ ] **Step 3: Update `AppState` construction to include `effective` and `effective_per_profile`**

Replace the `AppState` construction block:

```rust
    let app_state = Arc::new(AppState {
        engine,
        settings: settings_arc,
        effective: effective_arc,
        effective_per_profile: effective_per_profile_arc,
        mouse_hook: platform.mouse_hook,
        emitter: platform.wheel_emitter,
        processes: platform.process_query,
        autostart: platform.autostart,
        hotkey: platform.hotkey,
        hotkey_handle: Arc::new(Mutex::new(None)),
        keyboard_hook,
        keyboard_handle: Arc::new(Mutex::new(None)),
        engine_signal: Arc::new(EngineSignal::default()),
        enabled: Arc::new(AtomicBool::new(enabled_initial)),
        game_mode_active: Arc::new(AtomicBool::new(false)),
        fullscreen_detector,
        window_geom,
        last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
    });
```

- [ ] **Step 4: Add `SettingsPersistor` to `OwnedHandles`**

Add the new module at the top of lib.rs:

```rust
mod commands;
mod edge_scroll_thread;
mod engine_thread;
pub mod game_mode;
mod hook_wiring;
pub mod keyboard_sink;
mod settings_persistor;
mod state;
mod tray;
```

In the `OwnedHandles` struct, add the persistor field:

```rust
    struct OwnedHandles {
        #[allow(dead_code)]
        _engine: EngineThread,
        #[allow(dead_code)]
        _hook: Option<HookHandle>,
        #[allow(dead_code)]
        _persistor: settings_persistor::SettingsPersistor,
        #[cfg(windows)]
        #[allow(dead_code)]
        _timer: smoothscroll_platform::windows::HighResTimerGuard,
    }
```

In the `owned` construction block, add the persistor spawn:

```rust
    let owned = OwnedHandles {
        _engine: engine_thread,
        _hook: hook_result.ok(),
        _persistor: settings_persistor::SettingsPersistor::spawn(),
        #[cfg(windows)]
        _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(1),
    };
```

Also add the `Arc<SettingsPersistor>` to `app_state` via a `OnceLock` or store it in `OwnedHandles` and drop it there. The persistor needs to live as long as the app — storing it in `OwnedHandles` is correct. But `commit_settings` on `AppState` needs to submit to the persistor. Store a reference on `AppState` as `pub persistor: Arc<settings_persistor::SettingsPersistor>`.

In `AppState` in `state.rs`, add:

```rust
    pub persistor: Arc<settings_persistor::SettingsPersistor>,
```

Then in `lib.rs`, set it in the construction:

```rust
    let persistor = Arc::new(settings_persistor::SettingsPersistor::spawn());
    let app_state = Arc::new(AppState {
        // ... existing fields ...
        persistor: persistor.clone(),
        // ...
    });

    // OwnedHandles takes ownership of the persistor
    let owned = OwnedHandles {
        _persistor: settings_persistor::SettingsPersistor::spawn(),  // keep one owned
        // ...
    };
```

Actually, simpler: just store the `Arc<SettingsPersistor>` on `AppState` and `OwnedHandles` keeps a `Box<SettingsPersistor>` that drops (and thus joins) on exit. Change the field in `OwnedHandles`:

```rust
    #[allow(dead_code)]
    _persistor: Box<settings_persistor::SettingsPersistor>,
```

And construct it:

```rust
    let owned = OwnedHandles {
        _persistor: Box::new(settings_persistor::SettingsPersistor::spawn()),
        // ...
    };
```

And add the `persistor: Arc<...>` to `AppState`. Since the owned `Box` drops on app exit, the `Arc` on `AppState` goes away first (app state is managed by Tauri and dropped before `owned`), so the persistor worker receives `Shutdown` and drains.

- [ ] **Step 5: Wire persistor shutdown to `RunEvent::Exit`**

In the `setup` closure in `tauri::Builder`, after `tray::init` or in a `on_run` callback, call `persistor.shutdown()`. Since the persistor is in `OwnedHandles`, dropping `OwnedHandles` at the end of `setup` is sufficient (Tauri manages the lifetime). The drop should happen in the `setup` closure so the webview is still alive if any flush code needs it. Move the `owned` construction into the `setup` closure:

In the current code, `owned` is constructed before `tauri::Builder::default()`. Move the entire `OwnedHandles` construction into the `setup` closure.

Replace:

```rust
    let owned = OwnedHandles {
        _engine: engine_thread,
        _hook: hook_result.ok(),
        #[cfg(windows)]
        _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(1),
    };

    tauri::Builder::default()
        // ...
        .setup(move |app| {
            // ... use app ...
```

With:

```rust
    tauri::Builder::default()
        // ...
        .setup(move |app| {
            // Drop owned at the end of setup so persistor flushes before app exits.
            // Tauri runs the setup closure to completion before managing the app lifecycle.
            let _owned = OwnedHandles {
                _engine: engine_thread,
                _hook: hook_result.ok(),
                #[cfg(windows)]
                _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(1),
                _persistor: Box::new(settings_persistor::SettingsPersistor::spawn()),
            };
            // ...
```

But this means `engine_thread` and `hook_result` need to be accessible in the setup closure. Looking at the current code, they are constructed before `tauri::Builder::default()` and the setup closure captures `state_for_setup`. Move the `OwnedHandles` construction into the setup closure by removing it from before the `tauri::Builder` call and adding it as the first line inside the `setup` closure.

Actually, the cleanest approach: keep `OwnedHandles` construction before the builder but make `OwnedHandles` implement `Drop` properly (it already does for `EngineThread`). Then store `Box<OwnedHandles>` in the setup closure so it lives for the app's lifetime:

```rust
    tauri::Builder::default()
        // ...
        .setup(move |app| {
            // Box it so it lives for the app's full lifetime, dropping on exit
            let _owned = Box::leak(Box::new(OwnedHandles {
                _engine: engine_thread,
                _hook: hook_result.ok(),
                #[cfg(windows)]
                _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(1),
                _persistor: Box::new(settings_persistor::SettingsPersistor::spawn()),
            }));
            // ...
```

`Box::leak` is fine here — it's one `Box` at startup that lives for the process and drops only at exit (where we want the flush anyway).

- [ ] **Step 6: Verify compilation**

```bash
cargo check -p smoothscroll-app
```

Expected: FAIL (missing `settings_persistor` module — that's expected, Task 4 creates it). Expect errors about `effective_per_profile`, `effective`, `persistor` fields not found. Fix those as they come.

The expected errors to see right now:
- `settings_persistor` module doesn't exist yet
- `effective`, `effective_per_profile`, `persistor` fields not found on `AppState`

Fix the missing fields by applying the `state.rs` change first. Then the persistor module missing error is expected until Task 4.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(app): wire effective + effective_per_profile + commit_settings"
```

---

## Task 4: Debounced settings persistor module

**Files:**
- Create: `src-tauri/src/settings_persistor.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

### Task 4a: Add dependencies to `src-tauri/Cargo.toml`

- [ ] **Step 1: Add to `[dependencies]` section of `src-tauri/Cargo.toml`**

```toml
arc-swap = "1"
crossbeam-channel = "0.5"
```

### Task 4b: Create `src-tauri/src/settings_persistor.rs`

- [ ] **Step 1: Write the persistor actor**

```rust
//! Background worker that debounces settings disk writes.

use crossbeam_channel::{self as channel, Receiver, Sender};
use std::thread::{self, JoinHandle};
use std::time::Instant;
use tauri::RunEvent;

const DEBOUNCE_MS: u64 = 300;

/// Message sent from command threads to the persistor worker.
pub enum Message {
    /// New settings snapshot to save (possibly replaces a pending one).
    Save(smoothscroll_core::settings::AppSettings),
    /// Flush pending write and exit the worker thread.
    Shutdown,
}

/// SettingsPersistor owns a background thread that receives save requests,
/// debounces them by 300 ms, and writes the latest snapshot to disk.
/// It also flushes the pending write on drop (app exit).
pub struct SettingsPersistor {
    tx: Sender<Message>,
    _handle: JoinHandle<()>,
}

impl SettingsPersistor {
    /// Spawn the background worker thread and return the handle.
    pub fn spawn() -> Self {
        let (tx, rx) = channel::bounded(8);
        let handle = thread::Builder::new()
            .name("ss-settings-persistor".into())
            .spawn(move || worker(rx))
            .expect("spawn settings persistor thread");
        Self { tx, _handle: handle }
    }

    /// Queue a settings snapshot for debounced disk write.
    /// Multiple calls within the debounce window are collapsed into one write.
    pub fn submit(&self, snapshot: smoothscroll_core::settings::AppSettings) {
        let _ = self.tx.send(Message::Save(snapshot));
    }
}

impl Drop for SettingsPersistor {
    fn drop(&mut self) {
        let _ = self.tx.send(Message::Shutdown);
        // _handle join is intentionally skipped here — we rely on Drop order:
        // the Arc<SettingsPersistor> on AppState is dropped first (Tauri-managed),
        // then the Box<OwnedHandles> is leaked but never truly dropped before process exit.
        // For the explicit shutdown path via OwnedHandles Drop, see OwnedHandles impl below.
    }
}

/// Owned wrapper that properly joins the persistor thread on Drop.
/// Used by OwnedHandles to guarantee shutdown on app exit.
pub struct OwnedSettingsPersistor {
    inner: SettingsPersistor,
}

impl OwnedSettingsPersistor {
    pub fn spawn() -> Self {
        Self { inner: SettingsPersistor::spawn() }
    }

    pub fn submit(&self, snapshot: smoothscroll_core::settings::AppSettings) {
        self.inner.submit(snapshot);
    }
}

impl Drop for OwnedSettingsPersistor {
    fn drop(&mut self) {
        use crossbeam_channel::{self as cc, Receiver, Sender};
        // Send Shutdown and join the handle.
        // This requires access to the internal tx, but Drop can't access `&self` after moving.
        // Alternative: keep the JoinHandle accessible.
        // Simplified: the worker will exit when the channel is closed (all senders dropped).
        // The _handle join happens here:
    }
}
```

Wait, `OwnedSettingsPersistor` is overcomplicated. Simplify: just `SettingsPersistor` owns the `JoinHandle` and `Drop for SettingsPersistor` joins it. The `Box::leak` means it never drops. But we need the flush on exit. So for the `Box::leak` approach, we need `OwnedHandles` to explicitly drop the persistor.

Actually, the simplest: change `OwnedHandles._persistor` to `Option<SettingsPersistor>` (not `Box<>`) and `Drop for OwnedSettingsPersistor` handles the join. But we already `Box::leak` the `OwnedHandles`.

Better: don't leak `OwnedHandles`. Instead, manage it via a `Mutex<Option<OwnedHandles>>` stored in the Tauri app state. But that's complex.

Simplest correct approach: since we `Box::leak` the `OwnedHandles`, the `Drop` impl never runs. So we need the explicit shutdown signal to be sent before the leak. We can do this in the Tauri `on_run` event, or in the `setup` closure before leaking.

Actually, look at the spec § 4.6: "Called from the Tauri `RunEvent::Exit` handler so the final state lands on disk." The spec says to call `shutdown` from `RunEvent::Exit`. Let's use that instead of relying on `Drop`.

Remove `OwnedHandles._persistor` entirely. Instead, store the `Arc<SettingsPersistor>` on `AppState`. In `lib.rs`, register an `on_run` callback that calls `persistor.shutdown()` when the event is `RunEvent::Exit`.

```rust
        .on_run(move |app| {
            // On clean exit, flush the pending settings write.
            let app_for_exit = app.handle().clone();
            app.on_run(move |_app| {
                // This is called on every run loop iteration; we only want Exit.
                // Instead, listen to the exit event.
            });
```

Actually, the cleanest Tauri 2 way is to use the event system. In the setup closure, add:

```rust
            let persistor_for_exit = persistor.clone();
            app.listen("exit", move |_event| {
                persistor_for_exit.shutdown();
            });
```

And in the main `run()` loop, emit the exit event before `app.exit()`. Or simpler: handle it in the `quit_app` command which is the only clean exit path.

But there's also the case where the OS kills the process — that can't be handled. The spec explicitly accepts this as a known tradeoff.

For the Tauri-managed exit, the `RunEvent::Exit` is available in the builder's `on_run` closure. In Tauri 2, the way to run code on exit is via `app.listen::<RunEvent>` inside the setup closure, but the event fires after the loop is already exiting.

The simplest reliable approach: since `Box::leak` prevents `Drop` from running, explicitly call `shutdown()` on the persistor at the one place where the app exits cleanly — the `quit_app` command. That command is in `commands.rs` and already exists. Add the persistor shutdown there.

But `quit_app` currently just calls `app.exit(0)`. We need to call `persistor.shutdown()` first. The `quit_app` command doesn't have access to the persistor. We can either pass it via a global (bad) or handle it via a different mechanism.

The spec's preferred approach: "store as `OnceLock<SettingsPersistor>` next to `AppState`, owned by `OwnedHandles` in `lib.rs`. `OwnedHandles::Drop` calls `persistor.shutdown()` which drains and joins."

So we need `OwnedHandles` to own the `SettingsPersistor`, and `OwnedHandles` must be dropped (not leaked) at exit. The way to do this in Tauri 2 without leaking: don't use `Box::leak`. Instead, use Tauri's state management.

Looking at the existing code pattern: `parking_lot::Mutex::new(Some(owned))` is already in the builder. This is the correct pattern — store `OwnedHandles` in Tauri's managed state and let Tauri drop it on exit.

So change from `Box::leak(Box::new(OwnedHandles { ... }))` to:

```rust
        let owned = OwnedHandles { ... };
        app.manage(parking_lot::Mutex::new(Some(owned)));
```

And add `impl Drop for OwnedHandles` that calls `self._persistor.shutdown()`. This way, when Tauri drops the `Mutex<Option<OwnedHandles>>` on app exit, the `Drop` impl runs and the persistor flushes.

This requires the `settings_persistor` module to be imported in `lib.rs`. The module import at the top of `lib.rs` should be:

```rust
mod settings_persistor;
```

OK, let me rewrite the persistor module cleanly:

- [ ] **Step 1: Write `src-tauri/src/settings_persistor.rs`**

```rust
//! Background worker that debounces settings disk writes.

use crossbeam_channel::{self as channel, Receiver, Sender};
use std::thread::{self, JoinHandle};
use std::time::Instant;

const DEBOUNCE_MS: u64 = 300;

/// Message sent from command threads to the persistor worker.
#[derive(Debug)]
pub enum Message {
    /// New settings snapshot to save (collapses with any pending write).
    Save(smoothscroll_core::settings::AppSettings),
    /// Flush pending write and exit the worker thread.
    Shutdown,
}

/// SettingsPersistor owns a background thread that receives save requests,
/// debounces them by 300 ms, and writes the latest snapshot to disk.
pub struct SettingsPersistor {
    tx: Sender<Message>,
    handle: JoinHandle<()>,
}

impl SettingsPersistor {
    /// Spawn the background worker thread.
    pub fn spawn() -> Self {
        let (tx, rx) = channel::bounded(8);
        let handle = thread::Builder::new()
            .name("ss-settings-persistor".into())
            .spawn(move || worker(rx))
            .expect("spawn settings persistor thread");
        Self { tx, handle }
    }

    /// Queue a settings snapshot for debounced disk write.
    /// Multiple calls within 300 ms are collapsed into one write.
    pub fn submit(&self, snapshot: smoothscroll_core::settings::AppSettings) {
        let _ = self.tx.send(Message::Save(snapshot));
    }

    /// Drain the pending write and stop the worker. Blocks until the worker
    /// exits. Call this on app shutdown to ensure the last state lands on disk.
    pub fn shutdown(self) {
        let _ = self.tx.send(Message::Shutdown);
        let _ = self.handle.join();
    }
}

fn worker(rx: Receiver<Message>) {
    let deadline = std::time::Duration::from_millis(DEBOUNCE_MS);
    let mut pending: Option<smoothscroll_core::settings::AppSettings> = None;

    loop {
        let first = match rx.recv() {
            Ok(Message::Save(s)) => s,
            Ok(Message::Shutdown) | Err(_) => {
                if let Some(s) = pending.take() {
                    let _ = smoothscroll_core::settings::save(&s);
                }
                return;
            }
        };
        pending = Some(first);

        let deadline_instant = Instant::now() + deadline;
        loop {
            match rx.recv_deadline(deadline_instant) {
                Ok(Message::Save(s)) => pending = Some(s),
                Ok(Message::Shutdown) | Err(_) => {
                    if let Some(s) = pending.take() {
                        let _ = smoothscroll_core::settings::save(&s);
                    }
                    return;
                }
            }
        }

        if let Some(s) = pending.take() {
            if let Err(e) = smoothscroll_core::settings::save(&s) {
                tracing::warn!(error = %e, "settings save failed");
            }
        }
    }
}
```

- [ ] **Step 2: Add module import to `src-tauri/src/lib.rs`**

Add to the module list at the top:

```rust
mod settings_persistor;
```

- [ ] **Step 3: Update `OwnedHandles` in `lib.rs`**

Add the persistor to `OwnedHandles`:

```rust
    struct OwnedHandles {
        #[allow(dead_code)]
        _engine: EngineThread,
        #[allow(dead_code)]
        _hook: Option<HookHandle>,
        #[allow(dead_code)]
        _persistor: SettingsPersistor,
        #[cfg(windows)]
        #[allow(dead_code)]
        _timer: smoothscroll_platform::windows::HighResTimerGuard,
    }
```

Add the `Drop` impl for `OwnedHandles` (can be added at the bottom of `lib.rs`):

```rust
impl Drop for OwnedHandles {
    fn drop(&mut self) {
        // Flush pending settings writes before exiting.
        self._persistor.shutdown();
    }
}
```

Move `OwnedHandles` construction into the setup closure:

```rust
        .setup(move |app| {
            tray::init(app.handle(), state_for_setup.clone())?;

            // Bridge classifier transitions to the frontend so it can drop
            // its 1Hz polling and react push-style.
            let app_for_emit = app.handle().clone();
            sink_for_emitter.install_input_source_emitter(move |label| {
                crate::commands::emit_input_source_changed(&app_for_emit, label);
            });

            crate::game_mode::spawn(app.handle().clone(), state_for_setup.clone());

            // owned must be dropped before app exits — store in Tauri state.
            let owned = OwnedHandles {
                _engine: engine_thread,
                _hook: hook_result.ok(),
                _persistor: SettingsPersistor::spawn(),
                #[cfg(windows)]
                _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(1),
            };
            app.manage(parking_lot::Mutex::new(Some(owned)));
            // ...
```

- [ ] **Step 4: Verify compilation**

```bash
cargo check -p smoothscroll-app
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): debounced settings persistor"
```

---

## Task 5: Switch all setters to `commit_settings` + `persistor.submit`

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/state.rs` (add `persistor` field)

### Task 5a: Add `persistor` field to `AppState` in `state.rs`

- [ ] **Step 1: Add import and field**

In `src-tauri/src/state.rs`, add the `persistor` field to `AppState`:

```rust
    pub persistor: Arc<settings_persistor::SettingsPersistor>,
```

Add the import at the top:

```rust
use crate::settings_persistor::SettingsPersistor;
```

Note: This will cause a circular dependency if `settings_persistor` imports `AppState`. The `settings_persistor` module uses `smoothscroll_core::settings::AppSettings` directly (not the app crate's state), so there is no circular dependency.

Update the `AppState::commit_settings` method to also submit to the persistor:

```rust
    pub fn commit_settings(&self, new: AppSettings) {
        let new_eff = EffectiveSettings::from_settings(&new);
        let new_per_profile: HashMap<String, Arc<EffectiveSettings>> = new
            .profiles
            .iter()
            .map(|p| {
                (
                    p.id.clone(),
                    Arc::new(EffectiveSettings::with_profile(&new, p)),
                )
            })
            .collect();
        {
            let mut w = self.settings.write();
            *w = new.clone();
        }
        self.effective.store(Arc::new(new_eff));
        *self.effective_per_profile.write() = new_per_profile;
        self.persistor.submit(new);
    }
```

### Task 5b: Rewrite all setter commands in `commands.rs`

- [ ] **Step 1: Update `save_settings`**

Replace the current `save_settings` body:

```rust
#[tauri::command]
pub fn save_settings<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut clamped = settings;
    clamped.clamp();

    // Synchronous save — frontend's explicit Save action requires disk state.
    settings::save(&clamped).map_err(|e| e.to_string())?;

    state.commit_settings(clamped.clone());
    state.enabled.store(clamped.enabled, Ordering::Relaxed);
    state.engine_signal.signal();

    emit_enabled_changed(&app, clamped.enabled);
    emit_settings_changed(&app, &clamped);

    let state_arc: Arc<AppState> = (*state).clone();
    let _ = refresh_keyboard_hook(&state_arc);

    tracing::debug!("settings saved");
    Ok(())
}
```

- [ ] **Step 2: Update `set_enabled`**

```rust
#[tauri::command]
pub fn set_enabled<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    enabled: bool,
) {
    state.enabled.store(enabled, Ordering::Relaxed);
    if enabled {
        state.engine_signal.signal();
    } else {
        // Reset engine state to default — engine is now stateless w.r.t. settings
        let mut e = state.engine.lock();
        *e = SmoothScrollEngine::default();
    }
    emit_enabled_changed(&app, enabled);
    let current = state.settings.read().clone();
    emit_settings_changed(&app, &current);
    tracing::info!(enabled, "set_enabled");
}
```

- [ ] **Step 3: Update `set_hotkey_enabled`**

```rust
#[tauri::command]
pub fn set_hotkey_enabled(
    state: State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.enable_global_hotkey = enabled;
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot.clone());

    if enabled {
        let accel = snapshot.hotkey_accelerator.clone();
        let state_arc: Arc<AppState> = (*state).clone();
        register_hotkey_internal(&state_arc, &accel)?;
    } else {
        *state.hotkey_handle.lock() = None;
    }
    Ok(())
}
```

- [ ] **Step 4: Update `set_hotkey_accelerator`**

```rust
#[tauri::command]
pub fn set_hotkey_accelerator(
    state: State<'_, Arc<AppState>>,
    accelerator: String,
) -> Result<(), String> {
    if !is_valid_accelerator(&accelerator) {
        return Err(format!("invalid accelerator '{accelerator}'"));
    }
    {
        let mut s = state.settings.write();
        s.hotkey_accelerator = accelerator.clone();
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot.clone());

    if snapshot.enable_global_hotkey {
        let state_arc: Arc<AppState> = (*state).clone();
        register_hotkey_internal(&state_arc, &accelerator)?;
    }
    Ok(())
}
```

- [ ] **Step 5: Update `add_excluded_app`**

```rust
#[tauri::command]
pub fn add_excluded_app(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("name cannot be empty".to_string());
    }
    {
        let mut s = state.settings.write();
        if !s
            .excluded_apps
            .iter()
            .any(|a| a.eq_ignore_ascii_case(&trimmed))
        {
            s.excluded_apps.push(trimmed);
        }
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);
    Ok(())
}
```

- [ ] **Step 6: Update `remove_excluded_app`**

```rust
#[tauri::command]
pub fn remove_excluded_app(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.excluded_apps.retain(|a| !a.eq_ignore_ascii_case(&name));
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);
    Ok(())
}
```

- [ ] **Step 7: Update `set_autostart`**

```rust
#[tauri::command]
pub fn set_autostart<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    state.autostart.set(enabled).map_err(|e| e.to_string())?;
    {
        let mut s = state.settings.write();
        s.start_with_os = enabled;
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot.clone());
    emit_settings_changed(&app, &snapshot);
    Ok(())
}
```

- [ ] **Step 8: Update `change_language`**

```rust
#[tauri::command]
pub fn change_language<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<AppState>>,
    lang: String,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.language = lang.clone();
        s.clamp();
    }
    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot.clone());
    let _ = app.emit("language-changed", snapshot.language.clone());
    Ok(())
}
```

- [ ] **Step 9: Update `create_profile`**

```rust
#[tauri::command]
pub fn create_profile(
    state: State<'_, Arc<AppState>>,
    name: String,
) -> Result<ScrollProfile, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("profile name cannot be empty".to_string());
    }
    if trimmed.len() > 64 {
        return Err("profile name too long (max 64 characters)".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let profile = ScrollProfile::new(&id, trimmed);

    {
        let mut s = state.settings.write();
        s.profiles.push(profile.clone());
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);

    Ok(profile)
}
```

- [ ] **Step 10: Update `update_profile`**

```rust
#[tauri::command]
pub fn update_profile(
    state: State<'_, Arc<AppState>>,
    profile: ScrollProfile,
) -> Result<(), String> {
    let trimmed_name = profile.name.trim();
    if trimmed_name.is_empty() {
        return Err("profile name cannot be empty".to_string());
    }
    if trimmed_name.len() > 64 {
        return Err("profile name too long (max 64 characters)".to_string());
    }
    {
        let mut s = state.settings.write();
        if let Some(existing) = s.profiles.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile.clone();
            existing.name = trimmed_name.to_string();
            existing.clamp();
        } else {
            return Err(format!("profile '{}' not found", profile.id));
        }
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);

    Ok(())
}
```

- [ ] **Step 11: Update `delete_profile`**

```rust
#[tauri::command]
pub fn delete_profile(
    state: State<'_, Arc<AppState>>,
    profile_id: String,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();

        let assigned_apps: Vec<_> = s
            .app_profiles
            .iter()
            .filter(|(_, id)| **id == profile_id)
            .map(|(name, _)| name.clone())
            .collect();

        if !assigned_apps.is_empty() {
            return Err(format!(
                "Cannot delete: apps assigned to this profile: {}",
                assigned_apps.join(", ")
            ));
        }

        let before_len = s.profiles.len();
        s.profiles.retain(|p| p.id != profile_id);
        if s.profiles.len() == before_len {
            return Err(format!("profile '{profile_id}' not found"));
        }
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);

    Ok(())
}
```

- [ ] **Step 12: Update `assign_app_profile`**

```rust
#[tauri::command]
pub fn assign_app_profile(
    state: State<'_, Arc<AppState>>,
    process_name: String,
    profile_id: Option<String>,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();

        if let Some(ref id) = profile_id {
            if id != AppSettings::DISABLED_PROFILE_ID
                && !s.profiles.iter().any(|p| &p.id == id)
            {
                return Err(format!("profile '{id}' not found"));
            }
        }

        s.assign_profile(process_name, profile_id);
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);

    Ok(())
}
```

- [ ] **Step 13: Update `unassign_app_profile`**

```rust
#[tauri::command]
pub fn unassign_app_profile(
    state: State<'_, Arc<AppState>>,
    process_name: String,
) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.app_profiles.remove(&process_name);
    }

    let snapshot = state.settings.read().clone();
    state.commit_settings(snapshot);

    Ok(())
}
```

- [ ] **Step 14: Update `add_known_game`**

```rust
#[tauri::command]
pub fn add_known_game(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("name cannot be empty".into());
    }
    {
        let mut s = state.settings.write();
        if !s
            .game_mode_known_apps
            .iter()
            .any(|g| g.eq_ignore_ascii_case(&trimmed))
        {
            s.game_mode_known_apps.push(trimmed);
        }
    }
    let snap = state.settings.read().clone();
    state.commit_settings(snap);
    Ok(())
}
```

- [ ] **Step 15: Update `remove_known_game`**

```rust
#[tauri::command]
pub fn remove_known_game(state: State<'_, Arc<AppState>>, name: String) -> Result<(), String> {
    {
        let mut s = state.settings.write();
        s.game_mode_known_apps
            .retain(|g| !g.eq_ignore_ascii_case(&name));
    }
    let snap = state.settings.read().clone();
    state.commit_settings(snap);
    Ok(())
}
```

- [ ] **Step 16: Remove unused imports from commands.rs**

After all the setter changes, `settings::save` is still used in `save_settings`. The `smoothscroll_core::settings::save` calls in the other setters are gone (replaced by `commit_settings`). Clean up imports: remove `use smoothscroll_core::settings::{self, is_valid_accelerator, AppSettings, ScrollProfile};` and replace with `use smoothscroll_core::settings::{is_valid_accelerator, AppSettings, ScrollProfile};`. The `settings::save` is still needed for `save_settings` — keep `use smoothscroll_core::settings;` or just reference `crate::settings::save` directly.

Actually, `settings` was imported as a module via `use smoothscroll_core::settings;` which provides `settings::save`. Keep it as `use smoothscroll_core::settings;` and remove any specific item imports that are no longer used.

- [ ] **Step 17: Verify compilation**

```bash
cargo check -p smoothscroll-app
```

Expected: PASS. If there are import errors, fix them.

- [ ] **Step 18: Commit**

```bash
git add -A && git commit -m "refactor(app): switch all setters to commit_settings + persistor.submit"
```

---

## Task 6: Rewrite hook_wiring.rs — single critical section, throttle, lazy tracing

**Files:**
- Modify: `src-tauri/src/hook_wiring.rs`
- Modify: `src-tauri/src/engine_thread.rs`
- Modify: `src-tauri/src/edge_scroll_thread.rs`
- Modify: `src-tauri/src/keyboard_sink.rs`

### Task 6a: Rewrite `src-tauri/src/hook_wiring.rs`

This is the most complex task. The goal: `route_vertical_with_source` and `route_horizontal_with_source` take the lock exactly once, read `EffectiveSettings` from `resolve_active` before locking, and use the process-name throttle.

- [ ] **Step 1: Rewrite the entire `hook_wiring.rs` file**

The new file structure:

```rust
//! Glue between the platform hook and our engine.
//!
//! Lifecycle: the sink holds an `Arc<AppState>` to keep settings accessible.
//!
//! Performance notes:
//! - The engine lock is taken exactly once per wheel event.
//! - Process name lookups are throttled to 50 ms intervals.
//! - Debug tracing is lazy (guarded by `tracing::enabled!`).

use crate::state::AppState;
use parking_lot::Mutex;
use smoothscroll_core::settings::EffectiveSettings;
use smoothscroll_platform::traits::HookEventSink;
use smoothscroll_platform::types::{HookDecision, ModifierKeys};
use std::sync::atomic::Ordering;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

/// Callback signature invoked when the input-source classifier transitions.
type InputSourceEmitter = Box<dyn Fn(&'static str) + Send + Sync>;

/// Throttled process-name cache — reduces Win32 syscall rate to ≤ 20 Hz.
struct ProcessNameCache {
    last_call_at: Instant,
    last_name: Option<String>,
}

impl ProcessNameCache {
    fn new() -> Self {
        Self {
            last_call_at: Instant::now() - Duration::from_secs(1), // ensure first call fires
            last_name: None,
        }
    }

    fn get<F: FnOnce() -> Option<String>>(&mut self, fetch: F) -> Option<String> {
        if self.last_call_at.elapsed() < Duration::from_millis(50) {
            return self.last_name.clone();
        }
        self.last_name = fetch();
        self.last_call_at = Instant::now();
        self.last_name.clone()
    }
}

pub struct EngineSink {
    pub state: Arc<AppState>,
    pub epoch: Instant,
    /// Set once during setup (after `AppHandle` becomes available).
    input_source_emitter: OnceLock<InputSourceEmitter>,
    /// Throttled process-name cache.
    process_cache: Mutex<ProcessNameCache>,
}

impl EngineSink {
    pub fn new(state: Arc<AppState>) -> Arc<Self> {
        Arc::new(Self {
            state,
            epoch: Instant::now(),
            input_source_emitter: OnceLock::new(),
            process_cache: Mutex::new(ProcessNameCache::new()),
        })
    }

    pub fn install_input_source_emitter<F>(&self, f: F)
    where
        F: Fn(&'static str) + Send + Sync + 'static,
    {
        let _ = self.input_source_emitter.set(Box::new(f));
    }

    fn now_ms(&self) -> u64 {
        self.epoch.elapsed().as_millis() as u64
    }

    /// Returns `None` if the app is excluded/disabled.
    /// Returns `Some(Arc<EffectiveSettings>)` for the active profile or global settings.
    fn resolve_active(&self) -> Option<Arc<EffectiveSettings>> {
        // Fast path: check if any profile logic is needed
        let (has_excluded, has_profiles) = {
            let s = self.state.settings.read();
            (!s.excluded_apps.is_empty(), !s.app_profiles.is_empty())
        };

        if !has_excluded && !has_profiles {
            return Some(self.state.effective.load_full());
        }

        // Need to look up process name
        let process_name = {
            let mut cache = self.process_cache.lock();
            cache.get(|| self.state.processes.process_name_under_cursor())?
        };

        let start = Instant::now();
        let s = self.state.settings.read();

        if s.is_excluded(&process_name) {
            if tracing::enabled!(tracing::Level::DEBUG) {
                let elapsed = start.elapsed();
                if elapsed > Duration::from_millis(2) {
                    tracing::debug!(?elapsed, process = %process_name, "resolve_active excluded");
                }
            }
            return None;
        }

        if let Some(profile_id) = s.app_profiles.get(&process_name) {
            if profile_id != smoothscroll_core::settings::AppSettings::DISABLED_PROFILE_ID {
                if let Some(eff) = self.state.effective_per_profile.read().get(profile_id) {
                    if tracing::enabled!(tracing::Level::DEBUG) {
                        let elapsed = start.elapsed();
                        if elapsed > Duration::from_millis(2) {
                            tracing::debug!(?elapsed, process = %process_name, "resolve_active profile");
                        }
                    }
                    return Some(eff.clone());
                }
            }
        }

        if tracing::enabled!(tracing::Level::DEBUG) {
            let elapsed = start.elapsed();
            if elapsed > Duration::from_millis(2) {
                tracing::debug!(?elapsed, process = %process_name, "resolve_active global");
            }
        }
        Some(self.state.effective.load_full())
    }

    fn update_last_source(&self, source: smoothscroll_core::input_source::InputSource) {
        use smoothscroll_core::input_source::InputSource;
        let code: u8 = match source {
            InputSource::Wheel => 0,
            InputSource::HighResWheel => 1,
            InputSource::Touchpad => 2,
        };
        let old = self.state.last_input_source.swap(code, Ordering::Relaxed);
        if old != code {
            if let Some(emit) = self.input_source_emitter.get() {
                let label: &'static str = match code {
                    1 => "HighResWheel",
                    2 => "Touchpad",
                    _ => "Wheel",
                };
                emit(label);
            }
        }
    }

    fn route_vertical_with_source(
        &self,
        delta: i32,
        mods: ModifierKeys,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        if self.state.game_mode_active.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }

        let eff = match self.resolve_active() {
            Some(e) => e,
            None => return HookDecision::Pass,
        };

        self.update_last_source(source);

        let now = self.now_ms();

        // ONE lock acquisition per event
        let mut engine = self.state.engine.lock();

        if mods.shift && eff.shift_key_horizontal {
            if eff.horizontal_smoothness {
                engine.on_hwheel_with_source(delta, now, source, &eff);
                drop(engine);
                self.state.engine_signal.signal();
                return HookDecision::Swallow;
            } else {
                return HookDecision::Pass;
            }
        }

        engine.on_wheel_with_source(delta, now, source, &eff);
        drop(engine);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }

    fn route_horizontal_with_source(
        &self,
        delta: i32,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        if !self.state.enabled.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }
        if self.state.game_mode_active.load(Ordering::Relaxed) {
            return HookDecision::Pass;
        }

        let eff = match self.resolve_active() {
            Some(e) => e,
            None => return HookDecision::Pass,
        };

        if !eff.horizontal_smoothness {
            return HookDecision::Pass;
        }

        self.update_last_source(source);
        let now = self.now_ms();

        let mut engine = self.state.engine.lock();
        engine.on_hwheel_with_source(delta, now, source, &eff);
        drop(engine);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }

    // Keep the legacy route_vertical / route_horizontal for test compatibility
    // but delegate to the with_source versions with a default settings call.
    fn route_vertical(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        self.route_vertical_with_source(delta, mods, smoothscroll_core::input_source::InputSource::Wheel)
    }

    fn route_horizontal(&self, delta: i32) -> HookDecision {
        self.route_horizontal_with_source(delta, smoothscroll_core::input_source::InputSource::Wheel)
    }
}

impl HookEventSink for EngineSink {
    fn on_wheel(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        self.route_vertical(delta, mods)
    }

    fn on_hwheel(&self, delta: i32) -> HookDecision {
        self.route_horizontal(delta)
    }

    fn on_wheel_ext(
        &self,
        delta: i32,
        mods: ModifierKeys,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        self.route_vertical_with_source(delta, mods, source)
    }

    fn on_hwheel_ext(
        &self,
        delta: i32,
        source: smoothscroll_core::input_source::InputSource,
    ) -> HookDecision {
        self.route_horizontal_with_source(delta, source)
    }
}
```

### Task 6b: Update `src-tauri/src/hook_wiring.rs` tests

The existing tests use `make_state` and `make_state_with_process` which construct `AppState` without `effective`, `effective_per_profile`, or `persistor` fields. These fields need to be added.

- [ ] **Step 1: Update test helper `make_state`**

In the `#[cfg(test)]` module of `hook_wiring.rs`, update `make_state` and `make_state_with_process` to initialize the new fields:

```rust
fn make_state(settings: AppSettings) -> Arc<AppState> {
    let eff = EffectiveSettings::from_settings(&settings);
    Arc::new(AppState {
        engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
        settings: Arc::new(RwLock::new(settings.clone())),
        effective: Arc::new(ArcSwap::from_pointee(eff)),
        effective_per_profile: Arc::new(RwLock::new(std::collections::HashMap::new())),
        mouse_hook: Arc::new(StubHook),
        emitter: Arc::new(StubEmitter),
        processes: Arc::new(StubProcessQuery),
        autostart: Arc::new(StubAutostart),
        hotkey: Arc::new(StubHotkey),
        hotkey_handle: Arc::new(Mutex::new(None)),
        keyboard_hook: Arc::new(StubKeyboardHook),
        keyboard_handle: Arc::new(Mutex::new(None)),
        engine_signal: Arc::new(EngineSignal::default()),
        enabled: Arc::new(AtomicBool::new(settings.enabled)),
        game_mode_active: Arc::new(AtomicBool::new(false)),
        fullscreen_detector: Arc::new(StubFullscreen),
        window_geom: Arc::new(StubWindowGeom),
        last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
        persistor: Arc::new(crate::settings_persistor::SettingsPersistor::spawn()),
    })
}
```

```rust
fn make_state_with_process(settings: AppSettings, process_name: Option<&str>) -> Arc<AppState> {
    let eff = EffectiveSettings::from_settings(&settings);
    Arc::new(AppState {
        engine: Arc::new(Mutex::new(SmoothScrollEngine::new())),
        settings: Arc::new(RwLock::new(settings.clone())),
        effective: Arc::new(ArcSwap::from_pointee(eff)),
        effective_per_profile: Arc::new(RwLock::new(std::collections::HashMap::new())),
        mouse_hook: Arc::new(StubHook),
        emitter: Arc::new(StubEmitter),
        processes: Arc::new(StaticProcessQuery {
            name: process_name.map(|s| s.to_string()),
        }),
        autostart: Arc::new(StubAutostart),
        hotkey: Arc::new(StubHotkey),
        hotkey_handle: Arc::new(Mutex::new(None)),
        keyboard_hook: Arc::new(StubKeyboardHook),
        keyboard_handle: Arc::new(Mutex::new(None)),
        engine_signal: Arc::new(EngineSignal::default()),
        enabled: Arc::new(AtomicBool::new(settings.enabled)),
        game_mode_active: Arc::new(AtomicBool::new(false)),
        fullscreen_detector: Arc::new(StubFullscreen),
        window_geom: Arc::new(StubWindowGeom),
        last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
        persistor: Arc::new(crate::settings_persistor::SettingsPersistor::spawn()),
    })
}
```

Update test assertions that call `state.engine.lock().step(dt)` — these now need the settings argument. The tests call `state.engine.lock().step(...)` to drain output. The engine now takes `&EffectiveSettings`. But the tests don't have access to `EffectiveSettings` in the test module scope.

Simplest fix: expose a helper in the test module to create the right `EffectiveSettings` for a given `AppSettings`:

```rust
fn eff_for(s: &AppSettings) -> EffectiveSettings {
    EffectiveSettings::from_settings(s)
}
```

Or: update the tests to call `state.effective.load()` which gives `Arc<EffectiveSettings>`, then dereference for the step call.

Replace all `state.engine.lock().step(N)` in tests with:

```rust
let eff_ref: &EffectiveSettings = &state.effective.load();
state.engine.lock().step(N, eff_ref)
```

Also update the `SmoothScrollEngine::new(settings.clone())` call in test helpers — the constructor is now `SmoothScrollEngine::new()` (no args).

- [ ] **Step 2: Add missing imports to test module**

```rust
use arc_swap::ArcSwap;
use smoothscroll_core::settings::EffectiveSettings;
```

### Task 6c: Update `engine_thread.rs`

- [ ] **Step 1: Update the `step` call**

In `src-tauri/src/engine_thread.rs`, update the step call at line 79:

```rust
// OLD (line 79):
let output = state.engine.lock().step(dt_ms);

// NEW:
let eff_ref: &EffectiveSettings = state.effective.load();
let output = state.engine.lock().step(dt_ms, eff_ref);
```

Add the import at the top:

```rust
use smoothscroll_core::settings::EffectiveSettings;
```

### Task 6d: Update `edge_scroll_thread.rs`

- [ ] **Step 1: Update the `on_wheel` call**

In `src-tauri/src/edge_scroll_thread.rs`, update line 58:

```rust
// OLD (line 58):
state.engine.lock().on_wheel(delta, now_ms);

// NEW:
let eff_ref: &EffectiveSettings = state.effective.load();
state.engine.lock().on_wheel_with_source(delta, now_ms, smoothscroll_core::input_source::InputSource::Wheel, eff_ref);
```

Add the import at the top:

```rust
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::EffectiveSettings;
```

### Task 6e: Update `keyboard_sink.rs`

- [ ] **Step 1: Update the engine call**

In `src-tauri/src/keyboard_sink.rs`, the keyboard path is intentionally NOT optimized (low-frequency). Update the `on_wheel` call to use `on_wheel_with_source` with the loaded effective settings:

```rust
// Replace line 68:
self.state.engine.lock().on_wheel(delta, now_ms);

// With:
let eff_ref: &EffectiveSettings = self.state.effective.load();
self.state.engine.lock().on_wheel_with_source(delta, now_ms, smoothscroll_core::input_source::InputSource::Wheel, eff_ref);
```

Add imports:

```rust
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::EffectiveSettings;
```

### Task 6f: Verify full compilation

- [ ] **Step 1: Run cargo check**

```bash
cargo check -p smoothscroll-app
```

Expected: PASS. Fix any type errors.

- [ ] **Step 2: Run all tests**

```bash
cargo test -p smoothscroll-app
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "perf(hook): single critical section + process-name throttle + lazy tracing"
```

---

## Task 7: Add criterion benches for the hot path

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/benches/hot_path.rs`

### Task 7a: Add bench section to `src-tauri/Cargo.toml`

- [ ] **Step 1: Add to `src-tauri/Cargo.toml`**

In `[dev-dependencies]`:

```toml
criterion = { version = "0.5", default-features = false }
```

Add `[[bench]]` section:

```toml
[[bench]]
name = "hot_path"
harness = false
```

### Task 7b: Create `src-tauri/benches/hot_path.rs`

- [ ] **Step 1: Write the bench file**

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::{AppSettings, EffectiveSettings, ScrollProfile};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

// Minimal stub implementations to avoid platform deps in benches.
mod stub_process {
    use smoothscroll_platform::traits::ProcessQuery;
    use smoothscroll_platform::types::ProcessInfo;

    pub struct StubProcessQuery {
        pub name: Option<String>,
    }

    impl ProcessQuery for StubProcessQuery {
        fn process_name_under_cursor(&self) -> Option<String> {
            self.name.clone()
        }
        fn foreground_process_id(&self) -> Option<u32> {
            None
        }
        fn list_visible_processes(&self) -> Vec<ProcessInfo> {
            Vec::new()
        }
    }
}

fn default_eff() -> EffectiveSettings {
    EffectiveSettings::from_settings(&AppSettings::default())
}

fn profile_eff() -> EffectiveSettings {
    let profile = ScrollProfile::new("bench-profile", "Bench Profile");
    EffectiveSettings::with_profile(&AppSettings::default(), &profile)
}

// Simulate the resolve_active fast path (no exclusions, no profiles)
fn bench_resolve_active_no_profiles(c: &mut Criterion) {
    let eff = Arc::new(EffectiveSettings::from_settings(&AppSettings::default()));
    let effective_per_profile: HashMap<String, Arc<EffectiveSettings>> = HashMap::new();

    c.bench_function("resolve_active_no_profiles", |b| {
        b.iter(|| {
            // Fast path: no exclusion, no profile lookup
            black_box(eff.load());
        });
    });
}

// Simulate resolve_active with 1 profile configured
fn bench_resolve_active_one_profile(c: &mut Criterion) {
    let profile_eff = Arc::new(profile_eff());
    let mut map: HashMap<String, Arc<EffectiveSettings>> = HashMap::new();
    map.insert("bench-profile".to_string(), profile_eff.clone());
    let effective_per_profile = Arc::new(map);
    let global_eff = Arc::new(default_eff());

    c.bench_function("resolve_active_one_profile_hit", |b| {
        b.iter(|| {
            // Profile hit
            black_box(effective_per_profile.get("bench-profile").cloned().unwrap_or_else(|| global_eff.clone()));
        });
    });

    c.bench_function("resolve_active_one_profile_miss", |b| {
        b.iter(|| {
            // Profile miss → global
            black_box(effective_per_profile.get("nonexistent").cloned().unwrap_or_else(|| global_eff.clone()));
        });
    });
}

// Full route_vertical_with_source path with stubbed process lookup
fn bench_route_vertical_with_source(c: &mut Criterion) {
    let engine = Arc::new(Mutex::new(SmoothScrollEngine::new()));
    let eff = Arc::new(default_eff());
    let source = InputSource::Wheel;

    c.bench_function("route_vertical_with_source", |b| {
        b.iter(|| {
            let mut e = engine.lock().unwrap();
            e.on_wheel_with_source(black_box(120), black_box(0), black_box(source), &eff);
        });
    });
}

// Engine step with small vs large pending delta
fn bench_step_small_pending(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_eff();
    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &eff);

    c.bench_function("step_small_pending", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

fn bench_step_large_pending(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_eff();
    for i in 0..20 {
        engine.on_wheel_with_source(120, i * 10, InputSource::Wheel, &eff);
    }

    c.bench_function("step_large_pending", |b| {
        b.iter(|| {
            black_box(engine.step(black_box(8.33), &eff));
        });
    });
}

// Touchpad path
fn bench_on_wheel_touchpad(c: &mut Criterion) {
    let mut engine = SmoothScrollEngine::new();
    let eff = default_eff();

    c.bench_function("on_wheel_touchpad", |b| {
        b.iter(|| {
            engine.on_wheel_with_source(black_box(30), black_box(0), black_box(InputSource::Touchpad), &eff);
        });
    });
}

// Profile switch cost (effective_per_profile.get)
fn bench_profile_lookup(c: &mut Criterion) {
    let profile_eff = Arc::new(profile_eff());
    let mut map: HashMap<String, Arc<EffectiveSettings>> = HashMap::new();
    for i in 0..10 {
        map.insert(format!("profile-{}", i), profile_eff.clone());
    }
    let per_profile = Arc::new(map);

    c.bench_function("profile_lookup_hit_10", |b| {
        b.iter(|| {
            black_box(per_profile.get("profile-5").cloned());
        });
    });

    c.bench_function("profile_lookup_miss_10", |b| {
        b.iter(|| {
            black_box(per_profile.get("nonexistent").cloned());
        });
    });
}

criterion_group!(
    benches,
    bench_resolve_active_no_profiles,
    bench_resolve_active_one_profile,
    bench_route_vertical_with_source,
    bench_step_small_pending,
    bench_step_large_pending,
    bench_on_wheel_touchpad,
    bench_profile_lookup,
);
criterion_main!(benches);
```

### Task 7c: Verify bench compilation

- [ ] **Step 1: Check bench compiles**

```bash
cargo check --bench hot_path -p smoothscroll-app
```

Expected: PASS.

- [ ] **Step 2: Run benches (optional — for baseline capture)**

```bash
cargo bench --bench hot_path -p smoothscroll-app -- --baseline-dir=benches/baselines
```

This saves baseline numbers for future comparison.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "bench: criterion benches for engine and hook hot path"
```

---

## Verification

After all tasks, run:

```bash
cargo build --workspace
cargo test --workspace
cargo fmt --all --check
```

All should PASS. Any failures should be debugged in-line before declaring the sprint complete.

---

## Self-Review Checklist

- [ ] Spec § 4.0 — `SmoothScrollEngine` is stateless, `new()` no args, `Default` works. Old methods removed.
- [ ] Spec § 4.1 — `EffectiveSettings` has all 14 fields, `from_settings` and `with_profile` implemented.
- [ ] Spec § 4.1 — `AppState` has `effective: Arc<ArcSwap<EffectiveSettings>>` and `effective_per_profile: Arc<RwLock<HashMap...>>`.
- [ ] Spec § 4.1 — `commit_settings` atomically updates authoritative + effective + per-profile + persistor.
- [ ] Spec § 4.2 — `effective_per_profile` rebuilt on profile CRUD (inside `commit_settings`).
- [ ] Spec § 4.3 — `ProcessNameCache` throttles Win32 calls to ≥ 50 ms intervals.
- [ ] Spec § 4.4 — `route_vertical_with_source` takes `engine.lock()` exactly once per event.
- [ ] Spec § 4.5 — Lazy tracing guards `tracing::enabled!(Level::DEBUG)` before formatting args.
- [ ] Spec § 4.6 — `SettingsPersistor` debounces 300 ms, `shutdown` drains pending write.
- [ ] Spec § 4.6 — All 13 setters use `commit_settings`, `save_settings` is synchronous.
- [ ] Spec § 4.7 — `commit_settings` is the ONLY path that mutates settings.
- [ ] Spec § 4.8 — Tray panel preloading verified (< 100 ms target).
- [ ] No placeholder/TBD/TODO in any step.
- [ ] All file paths are exact.
- [ ] Type consistency: `EffectiveSettings` field names match between `from_settings`, `with_profile`, and engine method signatures.
