# QoL Plan 1 — Reduce Motion (Gap #5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Honor OS-level "Reduce Motion" by switching the engine to instant-flush mode when the OS reports it, with explicit `Auto / Always / Never` user override.

**Architecture:** Add `AccessibilitySignals` trait in platform crate (Win/Mac impls), reflect OS state in `AppState.reduce_motion` atomic, fold it into `EffectiveSettings.instant_mode` via `commit_settings`, branch in `Engine::step` to flush remaining pixels in one frame.

**Tech Stack:** Rust (workspace), Tauri 2 IPC, React/TS for UI, Windows `SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION)`, macOS `NSWorkspace.accessibilityDisplayShouldReduceMotion`.

**Spec:** `docs/superpowers/specs/2026-05-19-qol-pass-design.md` § Gap #5

---

## File map

| Action | Path | Purpose |
|---|---|---|
| Modify | `crates/core/src/settings.rs` | Add `RespectReduceMotion` enum + `respect_reduce_motion` field on `AppSettings`; add `instant_mode` field on `EffectiveSettings` |
| Modify | `crates/core/src/engine.rs` | Add `flush_axis_instant` helper + `instant_mode` branch in `step` |
| Modify | `crates/core/tests/engine_tests.rs` | Add instant-mode tests |
| Modify | `crates/core/tests/settings_tests.rs` | Test default value, serde round-trip |
| Modify | `crates/platform/src/traits.rs` | Add `AccessibilitySignals` trait |
| Create | `crates/platform/src/windows/accessibility.rs` | Win impl using `SystemParametersInfoW` |
| Create | `crates/platform/src/macos/accessibility.rs` | macOS impl using `NSWorkspace` |
| Modify | `crates/platform/src/windows/mod.rs` | Export `WindowsAccessibilitySignals` |
| Modify | `crates/platform/src/macos/mod.rs` | Export `MacosAccessibilitySignals` |
| Modify | `crates/platform/src/lib.rs` | Wire `accessibility` field into platform builder |
| Modify | `src-tauri/src/state.rs` | Add `reduce_motion: Arc<AtomicBool>` and `accessibility: Arc<dyn AccessibilitySignals>`; recompute `instant_mode` in `commit_settings` |
| Modify | `src-tauri/src/lib.rs` | Wire accessibility signal + watcher; emit `reduce-motion-changed` |
| Modify | `src-tauri/src/commands.rs` | Add `get_reduce_motion_status` IPC command |
| Modify | `src/lib/tauri.ts` | Add types for new field/enum |
| Modify | `src/components/settings/BehaviorSection.tsx` | Add Respect Reduce Motion select + status line |
| Modify | `src/i18n/index.ts` (or locale files) | Add 4 i18n keys |

---

## Task 1: Add `RespectReduceMotion` enum and settings field

**Files:**
- Modify: `crates/core/src/settings.rs`
- Test: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Write the failing test**

Append to `crates/core/tests/settings_tests.rs`:

```rust
#[test]
fn respect_reduce_motion_defaults_to_auto() {
    let s = smoothscroll_core::settings::AppSettings::default();
    assert_eq!(
        s.respect_reduce_motion,
        smoothscroll_core::settings::RespectReduceMotion::Auto
    );
}

#[test]
fn respect_reduce_motion_round_trips_via_json() {
    use smoothscroll_core::settings::{AppSettings, RespectReduceMotion};
    let mut s = AppSettings::default();
    s.respect_reduce_motion = RespectReduceMotion::Always;
    let json = serde_json::to_string(&s).unwrap();
    let back: AppSettings = serde_json::from_str(&json).unwrap();
    assert_eq!(back.respect_reduce_motion, RespectReduceMotion::Always);
}

#[test]
fn old_settings_without_respect_field_load_with_auto_default() {
    let json = r#"{"enabled": true}"#;
    let s: smoothscroll_core::settings::AppSettings = serde_json::from_str(json).unwrap();
    assert_eq!(
        s.respect_reduce_motion,
        smoothscroll_core::settings::RespectReduceMotion::Auto
    );
}
```

- [ ] **Step 2: Run tests — verify failure**

```
cargo test -p smoothscroll_core --test settings_tests respect_reduce_motion
```

Expected: FAIL — `RespectReduceMotion` not found.

- [ ] **Step 3: Add enum + field**

In `crates/core/src/settings.rs`, after `ThemeMode`:

```rust
/// User control over the OS "Reduce Motion" signal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum RespectReduceMotion {
    /// Follow the OS signal (default).
    #[default]
    Auto,
    /// Always run engine in instant mode regardless of OS.
    Always,
    /// Always smooth, ignore OS.
    Never,
}
```

Add field to `AppSettings` struct (preserve alphabetical / grouping with other UI fields):

```rust
    // Accessibility
    pub respect_reduce_motion: RespectReduceMotion,
```

Add default in `Default for AppSettings`:

```rust
            respect_reduce_motion: RespectReduceMotion::default(),
```

- [ ] **Step 4: Run tests — verify pass**

```
cargo test -p smoothscroll_core --test settings_tests respect_reduce_motion
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): add RespectReduceMotion setting"
```

---

## Task 2: Add `instant_mode` to `EffectiveSettings`

**Files:**
- Modify: `crates/core/src/settings.rs`
- Test: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Write the failing test**

Append to `crates/core/tests/settings_tests.rs`:

```rust
#[test]
fn effective_settings_default_instant_mode_false() {
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    assert!(!eff.instant_mode);
}
```

- [ ] **Step 2: Run — verify failure**

```
cargo test -p smoothscroll_core --test settings_tests effective_settings_default_instant_mode_false
```

Expected: FAIL — `instant_mode` not found.

- [ ] **Step 3: Add field**

In `crates/core/src/settings.rs`, struct `EffectiveSettings`:

```rust
    pub instant_mode: bool,
```

Both `from_settings` and `with_profile` constructors set `instant_mode: false` (the value will be assigned by the app crate after construction in `commit_settings`).

In `from_settings`:
```rust
            instant_mode: false,
```

In `with_profile`:
```rust
            instant_mode: false,
```

- [ ] **Step 4: Run — verify pass**

```
cargo test -p smoothscroll_core --test settings_tests effective_settings_default_instant_mode_false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): add instant_mode to EffectiveSettings"
```

---

## Task 3: Engine `step` flushes axes when `instant_mode`

**Files:**
- Modify: `crates/core/src/engine.rs`
- Test: `crates/core/tests/engine_tests.rs`

- [ ] **Step 1: Write the failing test**

Append to `crates/core/tests/engine_tests.rs`:

```rust
#[test]
fn instant_mode_flushes_pending_pixels_in_one_step() {
    use smoothscroll_core::engine::SmoothScrollEngine;
    use smoothscroll_core::input_source::InputSource;
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};

    let mut s = AppSettings::default();
    s.animation_time_ms = 360;
    let mut eff = EffectiveSettings::from_settings(&s);
    let mut engine = SmoothScrollEngine::new();

    // Inject pending work via a normal wheel event in non-instant mode.
    eff.instant_mode = false;
    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &eff);
    assert!(engine.has_pending_work());

    // Switch to instant — one step should drain everything.
    eff.instant_mode = true;
    let out = engine.step(1000.0 / 120.0, &eff);
    assert!(out.vertical != 0, "expected pulses on instant flush");
    assert!(!engine.has_pending_work(), "expected no remaining work after instant step");
}

#[test]
fn instant_mode_no_pending_returns_zero() {
    use smoothscroll_core::engine::SmoothScrollEngine;
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
    let s = AppSettings::default();
    let mut eff = EffectiveSettings::from_settings(&s);
    eff.instant_mode = true;
    let mut engine = SmoothScrollEngine::new();
    let out = engine.step(8.0, &eff);
    assert_eq!(out.vertical, 0);
    assert_eq!(out.horizontal, 0);
}
```

- [ ] **Step 2: Run — verify failure**

```
cargo test -p smoothscroll_core --test engine_tests instant_mode
```

Expected: FAIL — engine ignores `instant_mode`.

- [ ] **Step 3: Implement**

In `crates/core/src/engine.rs`, add a private free function above `impl Axis`:

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
```

Modify `SmoothScrollEngine::step` to early-return when `instant_mode`:

```rust
pub fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> EngineOutput {
    if settings.instant_mode {
        let v = flush_axis_instant(&mut self.v);
        let h = if settings.horizontal_smoothness {
            flush_axis_instant(&mut self.h)
        } else {
            0
        };
        return EngineOutput { vertical: v, horizontal: h };
    }
    let v = self.v.step(dt_ms, settings);
    let h = if settings.horizontal_smoothness {
        self.h.step(dt_ms, settings)
    } else {
        0
    };
    EngineOutput { vertical: v, horizontal: h }
}
```

- [ ] **Step 4: Run — verify pass**

```
cargo test -p smoothscroll_core --test engine_tests instant_mode
```

Expected: 2 PASS. Also run `cargo test -p smoothscroll_core` (full crate) — ensure no regression.

- [ ] **Step 5: Commit**

```
git add crates/core/src/engine.rs crates/core/tests/engine_tests.rs
git commit -m "feat(core): instant_mode branch flushes axes in one step"
```

---

## Task 4: Define `AccessibilitySignals` trait

**Files:**
- Modify: `crates/platform/src/traits.rs`

- [ ] **Step 1: Add trait**

At the bottom of `crates/platform/src/traits.rs`:

```rust
/// OS-level accessibility signals that influence engine behaviour.
pub trait AccessibilitySignals: Send + Sync {
    /// Returns true when the OS reports "Reduce Motion" / "Disable animations".
    fn reduce_motion_enabled(&self) -> bool;

    /// Subscribe to changes. The callback is invoked on a platform-owned
    /// thread whenever the OS toggles the signal. Dropping the returned handle
    /// stops the subscription.
    fn watch(
        &self,
        on_change: Box<dyn Fn(bool) + Send + Sync>,
    ) -> Result<HookHandle>;
}
```

- [ ] **Step 2: Verify compiles**

```
cargo build -p smoothscroll_platform
```

Expected: success (no impls required yet — trait is just a type definition).

- [ ] **Step 3: Commit**

```
git add crates/platform/src/traits.rs
git commit -m "feat(platform): add AccessibilitySignals trait"
```

---

## Task 5: Windows `AccessibilitySignals` impl

**Files:**
- Create: `crates/platform/src/windows/accessibility.rs`
- Modify: `crates/platform/src/windows/mod.rs`

- [ ] **Step 1: Write the implementation**

Create `crates/platform/src/windows/accessibility.rs`:

```rust
//! Windows accessibility signal access via `SystemParametersInfoW`.
//!
//! Note: `SPI_GETCLIENTAREAANIMATION` returns the inverse of "Reduce Motion".
//! Animation enabled => Reduce Motion OFF.

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use windows::Win32::UI::WindowsAndMessaging::{
    SystemParametersInfoW, SPI_GETCLIENTAREAANIMATION,
    SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
};

pub struct WindowsAccessibilitySignals;

fn query_animations_enabled() -> bool {
    let mut value: i32 = 1; // default to "animations enabled" if query fails
    let _ = unsafe {
        SystemParametersInfoW(
            SPI_GETCLIENTAREAANIMATION,
            0,
            Some(&mut value as *mut _ as *mut _),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        )
    };
    value != 0
}

impl AccessibilitySignals for WindowsAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        // Reduce Motion ON when animations are disabled.
        !query_animations_enabled()
    }

    fn watch(
        &self,
        on_change: Box<dyn Fn(bool) + Send + Sync>,
    ) -> Result<HookHandle> {
        // Polling implementation: 1 Hz background thread reads the OS value
        // and fires the callback on transitions. Cheap (one syscall/sec) and
        // avoids the WM_SETTINGCHANGE message-loop machinery.
        let stop = Arc::new(AtomicBool::new(false));
        let stop_clone = stop.clone();
        let last = Arc::new(AtomicBool::new(!query_animations_enabled()));
        let last_clone = last.clone();
        std::thread::Builder::new()
            .name("smoothscroll-rm-watch".into())
            .spawn(move || {
                while !stop_clone.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    let cur = !query_animations_enabled();
                    let prev = last_clone.swap(cur, Ordering::Relaxed);
                    if cur != prev {
                        on_change(cur);
                    }
                }
            })
            .map_err(|e| PlatformError::Os(e.to_string()))?;

        struct Guard(Arc<AtomicBool>);
        impl Drop for Guard {
            fn drop(&mut self) {
                self.0.store(true, Ordering::Relaxed);
            }
        }
        Ok(HookHandle::new(Box::new(Guard(stop))))
    }
}
```

- [ ] **Step 2: Export from module**

In `crates/platform/src/windows/mod.rs`, add:

```rust
pub mod accessibility;
pub use accessibility::WindowsAccessibilitySignals;
```

- [ ] **Step 3: Verify build**

```
cargo build -p smoothscroll_platform --target x86_64-pc-windows-msvc
```

(Or simply `cargo build -p smoothscroll_platform` on Windows.)

Expected: success.

- [ ] **Step 4: Smoke test**

Add to `crates/platform/src/windows/accessibility.rs` (under `#[cfg(test)]`):

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::traits::AccessibilitySignals;

    #[test]
    fn query_does_not_panic() {
        let signals = WindowsAccessibilitySignals;
        let _ = signals.reduce_motion_enabled();
    }
}
```

Run:
```
cargo test -p smoothscroll_platform query_does_not_panic
```

Expected: PASS (smoke).

- [ ] **Step 5: Commit**

```
git add crates/platform/src/windows/accessibility.rs crates/platform/src/windows/mod.rs
git commit -m "feat(platform): Windows AccessibilitySignals via SPI_GETCLIENTAREAANIMATION"
```

---

## Task 6: macOS `AccessibilitySignals` impl

**Files:**
- Create: `crates/platform/src/macos/accessibility.rs`
- Modify: `crates/platform/src/macos/mod.rs`
- Modify: `crates/platform/Cargo.toml` (if `objc2-app-kit` not yet present)

- [ ] **Step 1: Confirm dependency**

Check `crates/platform/Cargo.toml` for `objc2-app-kit`. If absent, add under `[target.'cfg(target_os = "macos")'.dependencies]`:

```toml
objc2-app-kit = { version = "0.2", default-features = false, features = ["std", "NSWorkspace"] }
objc2-foundation = { version = "0.2", default-features = false, features = ["std", "NSNotification", "NSString"] }
```

(Run `cargo build -p smoothscroll_platform` on macOS to verify.)

- [ ] **Step 2: Write the implementation**

Create `crates/platform/src/macos/accessibility.rs`:

```rust
//! macOS accessibility signal access via `NSWorkspace`.

use crate::traits::{AccessibilitySignals, HookHandle};
use crate::types::{PlatformError, Result};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct MacosAccessibilitySignals;

fn query_reduce_motion() -> bool {
    use objc2_app_kit::NSWorkspace;
    let workspace = unsafe { NSWorkspace::sharedWorkspace() };
    unsafe { workspace.accessibilityDisplayShouldReduceMotion() }
}

impl AccessibilitySignals for MacosAccessibilitySignals {
    fn reduce_motion_enabled(&self) -> bool {
        query_reduce_motion()
    }

    fn watch(
        &self,
        on_change: Box<dyn Fn(bool) + Send + Sync>,
    ) -> Result<HookHandle> {
        // Polling at 1 Hz to avoid the NSNotificationCenter ObjC observer
        // dance. 1 syscall/sec is acceptable and keeps the impl simple.
        let stop = Arc::new(AtomicBool::new(false));
        let stop_clone = stop.clone();
        let last = Arc::new(AtomicBool::new(query_reduce_motion()));
        let last_clone = last.clone();
        std::thread::Builder::new()
            .name("smoothscroll-rm-watch".into())
            .spawn(move || {
                while !stop_clone.load(Ordering::Relaxed) {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    let cur = query_reduce_motion();
                    let prev = last_clone.swap(cur, Ordering::Relaxed);
                    if cur != prev {
                        on_change(cur);
                    }
                }
            })
            .map_err(|e| PlatformError::Os(e.to_string()))?;

        struct Guard(Arc<AtomicBool>);
        impl Drop for Guard {
            fn drop(&mut self) {
                self.0.store(true, Ordering::Relaxed);
            }
        }
        Ok(HookHandle::new(Box::new(Guard(stop))))
    }
}
```

- [ ] **Step 3: Export**

In `crates/platform/src/macos/mod.rs`:

```rust
pub mod accessibility;
pub use accessibility::MacosAccessibilitySignals;
```

- [ ] **Step 4: Build**

On macOS:
```
cargo build -p smoothscroll_platform
```

Expected: success.

- [ ] **Step 5: Commit**

```
git add crates/platform/src/macos/accessibility.rs crates/platform/src/macos/mod.rs crates/platform/Cargo.toml
git commit -m "feat(platform): macOS AccessibilitySignals via NSWorkspace"
```

---

## Task 7: Wire `accessibility` into platform builder

**Files:**
- Modify: `crates/platform/src/lib.rs`

- [ ] **Step 1: Inspect current builder**

Read the existing `current()` factory function in `crates/platform/src/lib.rs`. It returns a struct with `mouse_hook`, `wheel_emitter`, `process_query`, `autostart`, `hotkey`. Add a sibling field.

- [ ] **Step 2: Modify the platform struct**

```rust
pub struct Platform {
    pub mouse_hook: Arc<dyn traits::MouseHook>,
    pub wheel_emitter: Arc<dyn traits::WheelEmitter>,
    pub process_query: Arc<dyn traits::ProcessQuery>,
    pub autostart: Arc<dyn traits::Autostart>,
    pub hotkey: Arc<dyn traits::Hotkey>,
    pub accessibility: Arc<dyn traits::AccessibilitySignals>,
}
```

In `current()` for Windows branch:
```rust
        accessibility: Arc::new(windows::WindowsAccessibilitySignals),
```

For macOS branch:
```rust
        accessibility: Arc::new(macos::MacosAccessibilitySignals),
```

- [ ] **Step 3: Build**

```
cargo build -p smoothscroll_platform
```

Expected: success.

- [ ] **Step 4: Commit**

```
git add crates/platform/src/lib.rs
git commit -m "feat(platform): expose accessibility in builder"
```

---

## Task 8: Add `reduce_motion` and `accessibility` to `AppState`

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/hook_wiring.rs` (test stubs only)

- [ ] **Step 1: Modify `AppState`**

In `src-tauri/src/state.rs`, add fields:

```rust
    // Accessibility
    pub reduce_motion: Arc<AtomicBool>,
    pub accessibility: Arc<dyn smoothscroll_platform::traits::AccessibilitySignals>,
```

Add the trait import at the top:

```rust
use smoothscroll_platform::traits::{
    AccessibilitySignals, Autostart, FullscreenDetector, HookHandle, Hotkey, HotkeyHandle,
    KeyboardScrollHook, MouseHook, ProcessQuery, WheelEmitter, WindowGeometry,
};
```

- [ ] **Step 2: Update `commit_settings`**

Replace the body:

```rust
pub fn commit_settings(&self, new: AppSettings) {
    use smoothscroll_core::settings::RespectReduceMotion;
    let os_rm = self.reduce_motion.load(Ordering::Relaxed);
    let instant = match new.respect_reduce_motion {
        RespectReduceMotion::Always => true,
        RespectReduceMotion::Never => false,
        RespectReduceMotion::Auto => os_rm,
    };

    let mut new_eff = EffectiveSettings::from_settings(&new);
    new_eff.instant_mode = instant;

    let new_per_profile: HashMap<String, Arc<EffectiveSettings>> = new
        .profiles
        .iter()
        .map(|p| {
            let mut eff = EffectiveSettings::with_profile(&new, p);
            eff.instant_mode = instant;
            (p.id.clone(), Arc::new(eff))
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

Add `use std::sync::atomic::Ordering;` at the top of `state.rs`.

- [ ] **Step 3: Update test stubs in `hook_wiring.rs`**

In `crates/platform/src/traits.rs` we already have a stub-friendly trait. In the test module of `src-tauri/src/hook_wiring.rs`, add a `StubAccessibility` and pass it into both `make_state` and `make_state_with_process`:

```rust
struct StubAccessibility;
impl smoothscroll_platform::traits::AccessibilitySignals for StubAccessibility {
    fn reduce_motion_enabled(&self) -> bool { false }
    fn watch(
        &self,
        _on_change: Box<dyn Fn(bool) + Send + Sync>,
    ) -> smoothscroll_platform::types::Result<smoothscroll_platform::traits::HookHandle> {
        Ok(smoothscroll_platform::traits::HookHandle::new(Box::new(())))
    }
}
```

In each `Arc::new(AppState { ... })` call, add:

```rust
    reduce_motion: Arc::new(AtomicBool::new(false)),
    accessibility: Arc::new(StubAccessibility),
```

- [ ] **Step 4: Build**

```
cargo build -p smoothscroll
```

Expected: success.

- [ ] **Step 5: Run existing tests**

```
cargo test -p smoothscroll
```

Expected: existing tests still pass.

- [ ] **Step 6: Commit**

```
git add src-tauri/src/state.rs src-tauri/src/hook_wiring.rs
git commit -m "feat(app): wire reduce_motion + accessibility into AppState"
```

---

## Task 9: Initialize accessibility in `lib.rs::run` + emit Tauri event

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Modify run() composition**

After `let platform = smoothscroll_platform::current().expect("build platform");`:

```rust
let accessibility = platform.accessibility.clone();
let initial_rm = accessibility.reduce_motion_enabled();
let reduce_motion = Arc::new(AtomicBool::new(initial_rm));
```

In the `Arc::new(AppState { ... })` constructor, add:

```rust
    reduce_motion: reduce_motion.clone(),
    accessibility: accessibility.clone(),
```

After the `app_state` is built, install the watcher:

```rust
let app_state_for_rm = app_state.clone();
let _rm_watch = accessibility.watch(Box::new(move |new_value: bool| {
    app_state_for_rm.reduce_motion.store(new_value, Ordering::Relaxed);
    let snapshot = app_state_for_rm.settings.read().clone();
    app_state_for_rm.commit_settings(snapshot);
    // Note: emitting the Tauri event happens after AppHandle is available; see setup().
}));
```

Add `_rm_watch` to `OwnedHandles` so its drop runs at app exit:

```rust
struct OwnedHandles {
    #[allow(dead_code)]
    _engine: EngineThread,
    #[allow(dead_code)]
    _hook: Option<HookHandle>,
    #[cfg(windows)]
    #[allow(dead_code)]
    _timer: smoothscroll_platform::windows::HighResTimerGuard,
    #[allow(dead_code)]
    _rm_watch: HookHandle,
}
```

Initialize:

```rust
let owned = OwnedHandles {
    _engine: engine_thread,
    _hook: hook_result.ok(),
    #[cfg(windows)]
    _timer: smoothscroll_platform::windows::HighResTimerGuard::begin(1),
    _rm_watch: _rm_watch.expect("install reduce_motion watcher"),
};
```

(`accessibility.watch` returns `Result<HookHandle>`. Replace the closure-based watch above with a `let _rm_watch = accessibility.watch(...)` assignment that produces the handle. The closure inside `watch` updates `reduce_motion` and calls `commit_settings`; the Tauri emit is wired in `setup()` below.)

- [ ] **Step 2: Emit `reduce-motion-changed` from setup**

Move the watcher install into `setup()` so `AppHandle` is available. Replace the assignment with:

```rust
let app_for_rm = app.handle().clone();
let app_state_for_rm = state_for_setup.clone();
let rm_handle = state_for_setup
    .accessibility
    .watch(Box::new(move |new_value: bool| {
        app_state_for_rm.reduce_motion.store(new_value, Ordering::Relaxed);
        let snapshot = app_state_for_rm.settings.read().clone();
        app_state_for_rm.commit_settings(snapshot);
        let _ = tauri::Emitter::emit(&app_for_rm, "reduce-motion-changed", new_value);
    }))
    .expect("install reduce_motion watcher");
// Stash into the OwnedHandles via a Mutex<Option<HookHandle>> created earlier.
```

Easier approach: store the handle in `AppState`:

In `state.rs` add:

```rust
    pub rm_watch_handle: Arc<Mutex<Option<HookHandle>>>,
```

Initialize as `Arc::new(Mutex::new(None))` in both `lib.rs` and the test stubs. In `setup()`:

```rust
*state_for_setup.rm_watch_handle.lock() = Some(rm_handle);
```

- [ ] **Step 3: Build**

```
cargo build -p smoothscroll
```

Expected: success.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/lib.rs src-tauri/src/state.rs src-tauri/src/hook_wiring.rs
git commit -m "feat(app): install reduce-motion watcher and emit reduce-motion-changed"
```

---

## Task 10: IPC `get_reduce_motion_status`

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs` (register command)

- [ ] **Step 1: Add the command**

In `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn get_reduce_motion_status(state: State<'_, Arc<AppState>>) -> bool {
    state.reduce_motion.load(Ordering::Relaxed)
}
```

- [ ] **Step 2: Register in invoke handler**

In `src-tauri/src/lib.rs`, add to `tauri::generate_handler![...]`:

```rust
            commands::get_reduce_motion_status,
```

- [ ] **Step 3: Build**

```
cargo build -p smoothscroll
```

Expected: success.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(app): add get_reduce_motion_status IPC command"
```

---

## Task 11: Frontend types

**Files:**
- Modify: `src/lib/tauri.ts` (or wherever `AppSettings` TS type lives — search first with `grep -r "respect_reduce_motion\|AppSettings" src/lib`)

- [ ] **Step 1: Locate the existing `AppSettings` TS type**

Run:
```
grep -rn "interface AppSettings\|type AppSettings" src/
```

Add the field to whatever interface mirrors the Rust struct. Add the enum:

```typescript
export type RespectReduceMotion = "Auto" | "Always" | "Never";

export interface AppSettings {
  // ... existing fields
  respect_reduce_motion: RespectReduceMotion;
}
```

- [ ] **Step 2: Verify TS compiles**

```
pnpm tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```
git add src/lib/tauri.ts
git commit -m "feat(ui): add RespectReduceMotion to AppSettings type"
```

---

## Task 12: Settings UI — Respect Reduce Motion section

**Files:**
- Modify: `src/components/settings/BehaviorSection.tsx`
- Modify: i18n locale files (find the english file and add keys; other languages can lag one release)

- [ ] **Step 1: Add i18n keys**

Search for the English locale file, e.g.:
```
grep -rln "tabs.preferences.title" src/i18n
```

In the English file, add:

```json
"reduce_motion": {
  "label": "Respect system Reduce Motion",
  "help": "When the system requests reduced motion, scroll becomes instant instead of smooth.",
  "auto": "Auto (follow system)",
  "always": "Always instant",
  "never": "Always smooth",
  "status_on": "OS Reduce Motion: ON",
  "status_off": "OS Reduce Motion: OFF"
}
```

- [ ] **Step 2: Add the row in `BehaviorSection.tsx`**

Read the existing component first to match style. Add an import:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
```

In the component body (before the existing rows):

```typescript
const respectRm = useSettingsStore((s) => s.settings?.respect_reduce_motion ?? "Auto");
const patch = useSettingsStore((s) => s.patch);
const [osRm, setOsRm] = useState<boolean>(false);

useEffect(() => {
  invoke<boolean>("get_reduce_motion_status").then(setOsRm).catch(() => {});
  const un = listen<boolean>("reduce-motion-changed", (e) => setOsRm(Boolean(e.payload)));
  return () => { un.then((u) => u()).catch(() => {}); };
}, []);
```

Render row (use existing `<SettingRow>` pattern from the file):

```tsx
<SettingRow label={t("reduce_motion.label")} help={t("reduce_motion.help")}>
  <Select
    value={respectRm}
    onValueChange={(v) => patch({ respect_reduce_motion: v as RespectReduceMotion })}
  >
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="Auto">{t("reduce_motion.auto")}</SelectItem>
      <SelectItem value="Always">{t("reduce_motion.always")}</SelectItem>
      <SelectItem value="Never">{t("reduce_motion.never")}</SelectItem>
    </SelectContent>
  </Select>
</SettingRow>
<div className="text-xs text-muted-foreground pl-3 pb-2">
  {osRm ? t("reduce_motion.status_on") : t("reduce_motion.status_off")}
</div>
```

- [ ] **Step 3: Verify renders**

```
pnpm tauri dev
```

Open Settings → Preferences. Toggle each option. Toggle OS Reduce Motion in System Settings — status line should update within ~1 s.

- [ ] **Step 4: Commit**

```
git add src/components/settings/BehaviorSection.tsx src/i18n/...
git commit -m "feat(ui): add Respect Reduce Motion select with live OS status"
```

---

## Task 13: Final verification

- [ ] **Step 1: Workspace tests**

```
cargo test --workspace
```

Expected: all green.

- [ ] **Step 2: Lints**

```
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
```

Expected: clean.

- [ ] **Step 3: Manual smoke**

- Open Settings → toggle to `Always` → wheel feels instant
- Toggle to `Never` → wheel smooth even when OS RM on
- Toggle to `Auto` + OS RM on → instant
- Toggle to `Auto` + OS RM off → smooth

- [ ] **Step 4: Bench (optional regression check)**

```
cargo bench -p smoothscroll_core --bench engine
```

Expected: hot-path delta within ±5% of baseline.

- [ ] **Step 5: Final commit (if anything left)**

```
git status
```

Expected: clean.
