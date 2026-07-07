# SmoothScroll Windows Features — Design Spec

**Date:** 2026-07-07
**Status:** Draft
**Scope:** 7 features across 3 implementation phases

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1 — Engine + Platform](#phase-1--engine--platform)
   - F3: Dynamic Scroll Acceleration
   - F4: Display Refresh Rate Sync
   - F15: Game Mode Process Optimization
   - F16: Edge Case Benchmarks
3. [Phase 2 — Settings + UI](#phase-2--settings--ui)
   - F1: Per-Monitor Scroll Profiles
   - F2: UWP/WinUI 3 Force Enable
   - F5: Scroll Analytics Dashboard
4. [Phase 3 — Distribution](#phase-3--distribution)
   - F17: Winget Package
5. [Testing Strategy](#testing-strategy)
6. [Migration & Backward Compatibility](#migration--backward-compatibility)

---

## Overview

### Goals

Improve the scroll experience on Windows through three pillars:

1. **Engine fidelity** — smoother acceleration, display-matched timing, optimized hot path
2. **Personalization** — per-monitor profiles, UWP override, usage analytics
3. **Distribution** — first-class Windows package manager presence

### Non-goals

- macOS/Linux feature parity (separate specs)
- UI redesign (existing tray/settings UI patterns reused)
- New easing curves (existing4 are sufficient)

### Phase Dependency Graph

```
Phase 1 (engine + platform)
  ├── F3  Dynamic acceleration    [core/engine.rs]
  ├── F4  Refresh rate sync       [engine_thread.rs + platform]
  ├── F15 Process optimization    [game_mode.rs + process_query.rs]
  └── F16 Edge case benchmarks    [crates/core/benches/]
          │
Phase 2 (settings + UI)          ▼
  ├── F1  Per-monitor profiles    [settings + platform + tray]
  ├── F2  UWP force enable        [settings + app_categories]
  └── F5  Analytics dashboard     [new module + frontend]
          │
Phase 3 (distribution)           ▼
  └── F17 Winget package          [CI + manifest]
```

Phase 2 depends on Phase 1 because per-monitor profiles reference display info and dynamic acceleration changes the scroll settings model. Phase 3 is independent.

---

## Phase 1 — Engine + Platform

### F3: Dynamic Scroll Acceleration

**Problem:** Current acceleration is step-based — `accel_factor += 2` per notch within 70ms, producing jarring 1→3→5→7→9→10 jumps. Users feel discrete "gear shifts" instead of smooth speed-proportional behavior.

**Solution:** Replace integer step-based acceleration with a continuous velocity→factor curve. Velocity is derived from notch arrival timing; factor is a smooth function of velocity.

#### Data Structures

**Remove from `EffectiveSettings`:**
```rust
// DELETE these fields:
pub acceleration_delta_ms: i32,  // was default 70
```

**Add to `EffectiveSettings`:**
```rust
pub max_velocity: f64,  // notches/sec ceiling for acceleration curve, default 20.0
```

**Keep unchanged:**
```rust
pub acceleration_max: i32,  // default 10 — now theceiling of the continuous curve
pub step_size_px: i32,
pub animation_time_ms: i32,
// ... all other fields unchanged
```

**Add to `AxisState` (engine.rs):**
```rust
pub struct AxisState {
    // existing fields...
    remaining_px: f64,
    last_notch_ms: u64,
    emit_offset_px: f64,

    // NEW fields:
    velocity: f64,           // notches/sec, exponential moving average
    last_velocity_ms: u64,   // timestamp of last velocity update
}
```

**`AxisState` remains `Copy`** — `velocity` and `last_velocity_ms` are `f64`/`u64`, no heap allocations.

#### Algorithm

**Velocity tracking** (in `register_notch`):
```rust
fn register_notch(&mut self, now_ms: u64, delta: i32, settings: &EffectiveSettings) {
    let notches = delta as f64 / WHEEL_DELTA as f64;

    // Compute instantaneous velocity from inter-notch interval
    let instant_velocity = if self.last_notch_ms > 0 {
        let dt = (now_ms - self.last_notch_ms) as f64;
        if dt > 0.0 && dt < 500.0 {  // ignore gaps > 500ms (user paused)
            1000.0 / dt  // notches/sec
        } else {
            0.0
        }
    } else {
        0.0
    };

    // Exponential moving average (α=0.3 → smooth, responsive)
    const ALPHA: f64 = 0.3;
    self.velocity = ALPHA * instant_velocity + (1.0 - ALPHA) * self.velocity;

    self.last_notch_ms = now_ms;

    let pixels = notches * settings.step_size_px as f64;
    self.remaining_px += pixels;
}
```

**Velocity decay** (in `step`, called every frame):
```rust
fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> f64 {
    // Decay velocity when no new notches (half-life ~200ms)
    const DECAY_HALF_LIFE_MS: f64 = 200.0;
    let decay = (-0.693 * dt_ms / DECAY_HALF_LIFE_MS).exp();  // ln(0.5) ≈ -0.693
    self.velocity *= decay;
    if self.velocity < 0.1 {
        self.velocity = 0.0;
    }

    // Compute acceleration factor from velocity (smooth curve)
    let velocity_ratio = (self.velocity / settings.max_velocity).min(1.0);
    let accel_factor = 1.0 + velocity_ratio * velocity_ratio
        * (settings.acceleration_max as f64 - 1.0);

    // ... rest of easing logic unchanged, but use accel_factor
    // to scale the step_size_px contribution
    let pixels = notches * settings.step_size_px as f64 * accel_factor;
    // ... existing easing/emission logic
}
```

**Velocity→Factor curve shape:** Quadratic `v²`. At low velocity (slow scroll), factor stays near1.0 (minimal acceleration). At high velocity, factor ramps to `acceleration_max`. This matches natural scrolling feel — slow = precise, fast = amplified.

#### Settings Migration

```rust
// In migrate_settings(), add:
if let Some(_old_delta) = settings_json.remove("acceleration_delta_ms") {
    // Removed in v2 — velocity-based acceleration replaces threshold
}
if settings_json.get("max_velocity").is_none() {
    settings_json["max_velocity"] = serde_json::json!(20.0);
}
```

#### Frontend Changes

- **Settings UI**: Remove "Acceleration threshold" slider (`acceleration_delta_ms`). Add "Max velocity" slider (range5-50, step1, default20, label: "Scroll speed ceiling").
- **Easing preview**: Update preview to reflect continuous acceleration. The curve visualization remains the same (easing is unchanged); only the input feel changes.
- **i18n keys to add:**
  - `settings.scroll.max_velocity` → "Max scroll velocity"
  - `settings.scroll.max_velocity_desc` → "Maximum scroll speed before acceleration reaches its peak"
- **i18n keys to remove:**
  - `settings.scroll.acceleration_delta` → (deleted)

#### Files Changed

| File | Change |
|------|--------|
| `crates/core/src/engine.rs` | Add `velocity`/`last_velocity_ms` to `AxisState`. Rewrite `register_notch`. Add decay to `step`. |
| `crates/core/src/settings.rs` | Remove `acceleration_delta_ms` from `AppSettings`/`EffectiveSettings`. Add `max_velocity`. Update `from_settings()` and `with_profile()`. Add migration. |
| `crates/core/src/constants.rs` | Add `DEFAULT_MAX_VELOCITY: f64 = 20.0` |
| `crates/core/tests/engine_tests.rs` | New tests for velocity decay, factor curve |
| `src/stores/settingsStore.ts` | Remove `accelerationDeltaMs`, add `maxVelocity` |
| `src/i18n/locales/en.json` | Add/remove keys |
| `src/i18n/locales/*.json` | Update all14 locales |

---

### F4: Display Refresh Rate Sync

**Problem:** Engine loop targets120Hz (`FRAME_MS_DEFAULT = 1000/120 ≈ 8.33ms`). On60Hz monitors this wastesCPU; on144Hz+ monitors it causes micro-stutter from frame mismatch. `timeBeginPeriod(1)` is always1ms regardless of actual display.

**Solution:** Query primary monitor refresh rate at startup. Set engine frame interval to match. Set `timeBeginPeriod` to a divisor of the frame interval for optimal sleep precision.

#### Platform Trait

**Add to `crates/platform/src/traits.rs`:**
```rust
pub trait DisplayQuery: Send + Sync {
    /// Returns the primary monitor refresh rate in Hz.
    /// Returns60 if detection fails (safe fallback).
    fn primary_refresh_rate_hz(&self) -> u32;
}
```

**Add to `Platform` struct:**
```rust
pub struct Platform {
    // existing fields...
    pub display: Arc<dyn DisplayQuery>,
}
```

#### Windows Implementation

**New file: `crates/platform/src/windows/display.rs`**
```rust
use windows::Win32::Graphics::Gdi::{
    EnumDisplaySettingsW, GetDC, MonitorFromWindow,
    DEVMODEW, ENUM_CURRENT_SETTINGS,
};
use windows::Win32::Foundation::HWND;

pub struct WindowsDisplayQuery;

impl DisplayQuery for WindowsDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        unsafe {
            let mut devmode = DEVMODEW::default();
            devmode.dmSize = std::mem::size_of::<DEVMODEW>() as u16;
            // ENUM_CURRENT_SETTINGS gets current display settings
            if EnumDisplaySettingsW(None, ENUM_CURRENT_SETTINGS, &mut devmode).as_bool() {
                let display_freq = devmode.dmDisplayFrequency;
                if display_freq > 0 && display_freq < 1000 {
                    return display_freq;
                }
            }
            60 // safe fallback
        }
    }
}
```

**Note:** `EnumDisplaySettingsW(None, ENUM_CURRENT_SETTINGS, ...)` returns the primary display's current settings including `dmDisplayFrequency`. This is a single Win32 call, no COM, no DXGI dependency.

#### macOS Implementation

```rust
use core_graphics::display::CGDisplay;

pub struct MacosDisplayQuery;

impl DisplayQuery for MacosDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        let display = CGDisplay::main();
        let mode = display.current_display_mode();
        match mode {
            Some(m) => m.refresh_rate() as u32,
            None => 60,
        }
    }
}
```

#### Linux Implementation

```rust
pub struct LinuxDisplayQuery;

impl DisplayQuery for LinuxDisplayQuery {
    fn primary_refresh_rate_hz(&self) -> u32 {
        // X11: XRRGetScreenInfo → XRRConfigCurrentRate
        // Fallback:60
        60 // simplified — full impl uses xrandr
    }
}
```

#### Engine Thread Integration

**Modify `src-tauri/src/engine_thread.rs`:**
```rust
// BEFORE (hardcoded):
const FRAME_MS_DEFAULT: f64 = 1000.0 / 120.0;

// AFTER (dynamic):
fn compute_frame_ms(refresh_rate_hz: u32) -> f64 {
    let hz = refresh_rate_hz.clamp(30, 240);
    1000.0 / hz as f64
}
```

**Modify `src-tauri/src/lib.rs`** (startup):
```rust
// Query refresh rate once at startup
let refresh_hz = platform.display.primary_refresh_rate_hz();
let frame_ms = compute_frame_ms(refresh_hz);
tracing::info!("Display refresh rate: {refresh_hz}Hz, frame interval: {frame_ms:.2}ms");

// Pass frame_ms to engine thread spawn
let engine_handle = spawn_engine_thread(state, engine_signal, frame_ms);
```

**Modify `HighResTimerGuard`:**
```rust
// BEFORE: always 1ms
_timer: HighResTimerGuard::begin(1),

// AFTER: choose optimal period
// For 60Hz (16.67ms frame): period=2ms (8 sub-steps per frame)
// For 120Hz (8.33ms frame): period=1ms
// For 144Hz (6.94ms frame): period=1ms
// For 240Hz (4.17ms frame): period=1ms
let period = if refresh_hz <= 75 { 2 } else { 1 };
_timer: HighResTimerGuard::begin(period),
```

#### Files Changed

| File | Change |
|------|--------|
| `crates/platform/src/traits.rs` | Add `DisplayQuery` trait |
| `crates/platform/src/lib.rs` | Add `display: Arc<dyn DisplayQuery>` to `Platform` |
| `crates/platform/src/windows/mod.rs` | Add `display.rs` module, wire in `build()` |
| `crates/platform/src/windows/display.rs` | **New file.** `EnumDisplaySettingsW` impl |
| `crates/platform/src/macos/mod.rs` | Add `display.rs` module, wire in `build()` |
| `crates/platform/src/macos/display.rs` | **New file.** CGDisplay impl |
| `crates/platform/src/linux/mod.rs` | Add stub `display.rs` |
| `src-tauri/src/lib.rs` | Query refresh rate at startup, compute period |
| `src-tauri/src/engine_thread.rs` | Accept `frame_ms` parameter, remove hardcoded const |

---

### F15: Game Mode Process Optimization

**Problem:** `game_mode.rs` calls `list_visible_processes()` every1 second (line39). This enumerates ALL visible windows via `EnumWindows` callback (O(n) where n = visible windows, typically50-200). Only the foreground PID's name is needed. This wastesCPU on every poll tick.

**Current code (game_mode.rs line36-43):**
```rust
let fg_pid = state.processes.foreground_process_id();
let processes = state.processes.list_visible_processes();
let fg_name = processes.iter()
    .find(|p| p.pid == fg_pid)
    .map(|p| p.name.clone());
```

**Solution:** Replace with direct foreground process name lookup. The `foreground_process_name()` method already exists in `process_query.rs` and uses a100ms TTL cache + single `OpenProcess` call. It's O(1).

**Optimized code:**
```rust
let fg_name = state.processes.foreground_process_name();
```

**But:** `foreground_process_name()` walks Z-order (GetTopWindow) to avoid tray panel interference. For game mode, the foreground process is the one that's fullscreen, which IS the top window. So this method is correct.

**Additional optimization — cache known-game result:**

When game mode is active and the foreground hasn't changed, skip the process name check entirely:

```rust
let fg_pid = state.processes.foreground_process_id();

// Skip if same PID as last check (most common case: game stays foreground)
if fg_pid == last_fg_pid.load(Ordering::Relaxed) {
    // Only re-check fullscreen (cheap: single HWND + monitor rect)
    let fullscreen = state.fullscreen_detector.is_foreground_fullscreen();
    now_active = fullscreen || last_known_game.load(Ordering::Relaxed);
    // No process enumeration needed
} else {
    // PID changed — resolve name (O(1) via cache)
    last_fg_pid.store(fg_pid, Ordering::Relaxed);
    let fg_name = state.processes.foreground_process_name();
    let known = is_known_game(&fg_name, &known_games);
    last_known_game.store(known, Ordering::Relaxed);
    let fullscreen = state.fullscreen_detector.is_foreground_fullscreen();
    now_active = fullscreen || known;
}
```

**Added state:** `last_fg_pid: AtomicU32`, `last_known_game: AtomicBool` — stored in game mode thread's local state.

**Performance impact:**
- Before: `EnumWindows` + filter + find = O(n) every1s = ~50-200 window checks/sec
- After: Single `AtomicU32` compare (no syscall) when foreground unchanged; single cached `OpenProcess` when changed

#### Files Changed

| File | Change |
|------|--------|
| `src-tauri/src/game_mode.rs` | Replace `list_visible_processes` with PID-cached lookup. Add `AtomicU32`/`AtomicBool` locals. |

**Lines changed:** ~15 lines modified, ~5 lines added.

---

### F16: Edge Case Benchmarks

**Problem:** Existing Criterion benchmarks cover basic easing curves and engine step timing. Missing coverage for real-world edge cases that affect scroll quality.

**New benchmark categories:**

#### Rapid Direction Changes

Simulate user scrolling down then immediately scrolling up. Measure frame-to-frame consistency and remaining_px accuracy.

```rust
// benches/engine_benchmarks.rs

fn bench_rapid_direction_change(c: &mut Criterion) {
    c.bench_function("engine_rapid_direction_change", |b| {
        b.iter(|| {
            let mut engine = ScrollEngine::new(default_settings());
            // Scroll down10 notches
            for _ in 0..10 {
                engine.register_notch(now(), WHEEL_DELTA);
            }
            // Immediately scroll up5 notches
            for _ in 0..5 {
                engine.register_notch(now() + 1, -WHEEL_DELTA);
            }
            // Step through30 frames and verify remaining_px decreases monotonically
            for _ in 0..30 {
                engine.step(8.33, &settings);
            }
            // Assert: remaining_px should be near0 (all consumed)
        });
    });
}
```

#### Multi-Axis Simultaneous

Simulate vertical + horizontal scroll at same time. Verify axes are independent (no cross-contamination of velocity or remaining_px).

```rust
fn bench_multi_axis_simultaneous(c: &mut Criterion) {
    c.bench_function("engine_multi_axis_simultaneous", |b| {
        b.iter(|| {
            let mut engine = ScrollEngine::new(default_settings());
            // Vertical:10 notches
            for _ in 0..10 {
                engine.register_notch(now(), WHEEL_DELTA);
            }
            // Horizontal:5 notches (same timestamp)
            for _ in 0..5 {
                engine.register_hwheel(now(), WHEEL_DELTA);
            }
            // Step30 frames
            for _ in 0..30 {
                engine.step(8.33, &settings);
            }
            // Assert: both axes consumed, no interaction
        });
    });
}
```

#### Long Idle Recovery

Simulate scroll, long pause (>2s idle timeout), then scroll again. Verify velocity decays to0 and new scroll starts fresh.

```rust
fn bench_long_idle_recovery(c: &mut Criterion) {
    c.bench_function("engine_long_idle_recovery", |b| {
        b.iter(|| {
            let mut engine = ScrollEngine::new(default_settings());
            // Scroll fast
            for i in 0..20 {
                engine.register_notch(i * 20, WHEEL_DELTA);  // 50/sec
            }
            // Idle3 seconds
            for i in 0..360 {
                engine.step(8.33, &settings);  // ~3s at 120Hz
            }
            // Assert: velocity ==0, remaining_px ==0
            // Scroll again — should start fresh
            engine.register_notch(3000, WHEEL_DELTA);
            // Assert: new remaining_px == step_size_px, no leftover from first scroll
        });
    });
}
```

#### High-Frequency Notch Burst

Simulate mouse wheel at maximum speed (high-DPI mouse,1000Hz polling). Notches arrive every1ms. Verify engine doesn't accumulate unbounded remaining_px.

```rust
fn bench_high_frequency_burst(c: &mut Criterion) {
    c.bench_function("engine_high_freq_burst", |b| {
        b.iter(|| {
            let mut engine = ScrollEngine::new(default_settings());
            //100 notches at1ms intervals (1000Hz mouse)
            for i in 0..100 {
                engine.register_notch(i, WHEEL_DELTA);
            }
            // Step through60 frames
            for _ in 0..60 {
                engine.step(8.33, &settings);
            }
            // Assert: remaining_px bounded, no panic
        });
    });
}
```

#### Easing Curve Accuracy

Verify easing functions produce mathematically correct output at boundary values (t=0, t=1, t=0.5).

```rust
fn bench_easing_accuracy(c: &mut Criterion) {
    let modes = [EasingMode::Linear, EasingMode::CubicOut,
                 EasingMode::QuinticOut, EasingMode::ExponentialOut];
    for mode in &modes {
        c.bench_with_input(
            BenchmarkId::new("easing_accuracy", format!("{:?}", mode)),
            mode,
            |b, mode| {
                b.iter(|| {
                    // t=0 should return0.0
                    let v0 = compute_easing_fraction(0.0, 100.0, *mode, 5, true);
                    assert!((v0 - 0.0).abs() < 0.001);
                    // t=1 should return1.0
                    let v1 = compute_easing_fraction(100.0, 100.0, *mode, 5, true);
                    assert!((v1 - 1.0).abs() < 0.001);
                    // t=0.5 should be between0.3 and0.7 for all modes
                    let v_mid = compute_easing_fraction(50.0, 100.0, *mode, 5, true);
                    assert!(v_mid > 0.3 && v_mid < 0.7);
                });
            },
        );
    }
}
```

#### Benchmark Results Expected

| Benchmark | Target | Metric |
|-----------|--------|--------|
| `rapid_direction_change` | <50μs | Frames toconsume all remaining_px |
| `multi_axis_simultaneous` | <80μs | Both axes fully consumed |
| `long_idle_recovery` | <10μs | Velocity decay + fresh start |
| `high_freq_burst` | <200μs | 100 notches +60 frames processed |
| `easing_accuracy` | <5μs | Boundary correctness verified |

#### Files Changed

| File | Change |
|------|--------|
| `crates/core/benches/engine_benchmarks.rs` | **Extend existing file.** Add5 new benchmark functions. |
| `crates/core/src/engine.rs` | Make `velocity` field pub(crate) for benchmark access. |

---

## Phase 2 — Settings + UI

### F1: Per-Monitor Scroll Profiles

**Problem:** All monitors share the same global scroll settings. Users with multi-monitor setups (e.g., 144Hz gaming monitor +60Hz office display, or different DPI) cannot have per-display scroll behavior.

**Solution:** Auto-switch scroll profile based on which monitor the foreground window resides on. No manual assignment — transparent to user.

#### Data Model

**New type in `settings.rs`:**
```rust
/// Maps a monitor's device name to a scroll profile ID.
/// Device names are Win32 `MonitorInfoEx.szDevice` (e.g., "\\.\DISPLAY1").
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MonitorProfile {
    pub device_name: String,      // "\\.\DISPLAY1", "\\.\DISPLAY2", etc.
    pub friendly_name: String,    // "DELL U2723QE", "LG HDR 4K" (for UI display)
    pub profile_id: String,       // ScrollProfile.id or "__default__" for global settings
}
```

**Add to `AppSettings`:**
```rust
pub monitor_profiles: Vec<MonitorProfile>,  // default: empty (all monitors use global)
```

**Add to `EffectiveSettings`:**
```rust
// No new fields — monitor profile lookup happens BEFORE EffectiveSettings construction.
// The monitor's assigned profile is resolved, then EffectiveSettings::with_profile() is called.
```

#### Platform Trait

**Add to `traits.rs`:**
```rust
pub trait WindowGeometry: Send + Sync {
    /// Returns the monitor device name for the given window handle.
    /// Returns None if HWND is invalid.
    fn monitor_for_hwnd(&self, hwnd: HWND) -> Option<String>;
}

pub trait MonitorEnumeration: Send + Sync {
    /// Returns all connected monitors with device name and friendly name.
    fn list_monitors(&self) -> Vec<MonitorInfo>;
}

pub struct MonitorInfo {
    pub device_name: String,      // "\\.\DISPLAY1"
    pub friendly_name: String,    // From GetMonitorInfoW → szDevice or EDID
    pub rect: Rect,               // Monitor bounds in virtual screen coords
}
```

#### Windows Implementation

```rust
use windows::Win32::Graphics::Gdi::{
    MonitorFromWindow, GetMonitorInfoW, EnumDisplayMonitors,
    HMONITOR, MONITORINFOEXW,
};
use windows::Win32::Foundation::HWND;

impl WindowGeometry for WindowsWindowGeometry {
    fn monitor_for_hwnd(&self, hwnd: HWND) -> Option<String> {
        unsafe {
            let hmon = MonitorFromWindow(hwnd, 0);  // MONITOR_DEFAULTTONEAREST
            let mut info = MONITORINFOEXW::default();
            info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
            if GetMonitorInfoW(hmon, &mut info).as_bool() {
                let name = PCWSTR::from_raw(info.szDevice.as_ptr());
                Some(name.to_string_lossy().to_string())
            } else {
                None
            }
        }
    }
}
```

#### Settings Lookup Chain

**In `hook_wiring.rs` — `on_wheel_with_source`:**

```rust
// Current lookup:
let profile = settings.get_profile_for_process(&process_name);
let eff = match profile {
    Some(p) => EffectiveSettings::with_profile(&settings, p),
    None => EffectiveSettings::from_settings(&settings),
};

// New lookup (priority order):
let eff = resolve_effective_settings(&settings, &process_name, &state);
```

**New function `resolve_effective_settings`:**
```rust
fn resolve_effective_settings(
    settings: &AppSettings,
    process_name: &str,
    window_geometry: &dyn WindowGeometry,
    foreground_hwnd: HWND,
) -> EffectiveSettings {
    // 1. Check per-app profile first (existing behavior)
    if let Some(profile) = settings.get_profile_for_process(process_name) {
        return EffectiveSettings::with_profile(settings, profile);
    }

    // 2. Check per-monitor profile
    if let Some(monitor_name) = window_geometry.monitor_for_hwnd(foreground_hwnd) {
        if let Some(monitor_profile) = settings.monitor_profiles.iter()
            .find(|mp| mp.device_name == monitor_name)
        {
            if monitor_profile.profile_id == "__default__" {
                return EffectiveSettings::from_settings(settings);
            }
            if let Some(profile) = settings.profiles.iter()
                .find(|p| p.id == monitor_profile.profile_id)
            {
                return EffectiveSettings::with_profile(settings, profile);
            }
        }
    }

    // 3. Global default
    EffectiveSettings::from_settings(settings)
}
```

**Priority:** Per-app profile > Per-monitor profile > Global default. Per-app always wins (user explicitly assigned). Per-monitor is automatic fallback.

#### Engine Thread — Monitor Change Detection

**Problem:** When user drags an app to a different monitor, the engine needs to switch profiles. Currently no monitor-change detection exists.

**Solution:** On each frame, check if foreground HWND's monitor changed. If so, re-resolve EffectiveSettings.

```rust
// In engine_thread.rs step loop:
let current_hwnd = state.processes.foreground_hwnd();  // new method
let current_monitor = state.window_geometry.monitor_for_hwnd(current_hwnd);

if current_monitor != last_monitor {
    last_monitor = current_monitor;
    // Re-resolve effective settings
    let process_name = state.processes.foreground_process_name();
    let new_eff = resolve_effective_settings(&settings, &process_name, ...);
    eff = new_eff;
}
```

**Note:** `foreground_hwnd()` is a new method on `ProcessQuery` that returns the raw HWND without resolving to process name. This is O(1) — just the Z-order walk + cache check.

**Performance:** `monitor_for_hwnd` is a single `MonitorFromWindow` + `GetMonitorInfoW` call. ~1-2μs. Called once per frame only when foreground HWND changes (detected by PID change, same optimization as F15). Net cost: near-zero.

#### Frontend UI

**New section in Settings → Apps tab:**

```
┌─────────────────────────────────────────────┐
│  Monitor Profiles                           │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🖥 \\.\DISPLAY1 — DELL U2723QE       │  │
│  │ Profile: [Glide (fast)    ▼]          │  │
│  ├───────────────────────────────────────┤  │
│  │ 🖥 \\.\DISPLAY2 — LG HDR 4K          │  │
│  │ Profile: [Default          ▼]         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ℹ Profiles apply when a window is on       │
│    that monitor. App-specific profiles       │
│    always take priority.                     │
└─────────────────────────────────────────────┘
```

**Component: `src/components/settings/MonitorProfiles.tsx`**
- Lists connected monitors (fetched via `list_monitors()` Tauri command)
- Each monitor has a `<Select>` dropdown with available profiles + "Default" option
- Changes persist via `patch({ monitorProfiles: [...] })`

**New Tauri commands in `commands.rs`:**
```rust
#[tauri::command]
fn list_monitors(state: State<'_, AppState>) -> Result<Vec<MonitorInfo>, String> {
    state.window_geometry.list_monitors()
}
```

#### Files Changed

| File | Change |
|------|--------|
| `crates/core/src/settings.rs` | Add `MonitorProfile` struct. Add `monitor_profiles` to `AppSettings`. |
| `crates/platform/src/traits.rs` | Add `WindowGeometry` and `MonitorEnumeration` traits. |
| `crates/platform/src/windows/mod.rs` | Add `window_geometry.rs` module, wire in `build()`. |
| `crates/platform/src/windows/window_geometry.rs` | **New file.** `MonitorFromWindow` + `EnumDisplayMonitors` impl. |
| `crates/platform/src/windows/process_query.rs` | Add `foreground_hwnd()` method. |
| `src-tauri/src/commands.rs` | Add `list_monitors` command. |
| `src-tauri/src/hook_wiring.rs` | Replace profile lookup with `resolve_effective_settings`. |
| `src-tauri/src/engine_thread.rs` | Add monitor change detection in step loop. |
| `src/components/settings/MonitorProfiles.tsx` | **New file.** Monitor profiles UI component. |
| `src/components/Tabs/Apps.tsx` | Import and render `MonitorProfiles`. |
| `src/stores/settingsStore.ts` | Add `monitorProfiles` to store. |
| `src/lib/tauri.ts` | Add `MonitorInfo` type, `list_monitors` invoke wrapper. |
| `src/i18n/locales/en.json` | Add monitor profile section keys. |

---

### F2: UWP/WinUI 3 Force Enable

**Problem:** `auto_disable_windows_apps` automatically disables smoothing for7 known Windows native-smooth apps (Notepad, Edge, UWP apps, etc.). Some users want smoothing on these apps because the native implementation is inferior. Currently no override exists.

**Solution:** Global toggle that bypasses auto-disable entirely.

#### Settings

**Add to `AppSettings`:**
```rust
pub force_enable_all_apps: bool,  // default: false
```

**Add to `EffectiveSettings`:** No change — `force_enable_all_apps` is checked at lookup time, not stored per-frame.

#### Lookup Logic Change

**In `hook_wiring.rs`:**
```rust
// BEFORE:
if settings.auto_disable_windows_apps && is_windows_native_app(&process_name) {
    return HookDecision::Pass;  // skip smoothing
}

// AFTER:
if settings.auto_disable_windows_apps && !settings.force_enable_all_apps
    && is_windows_native_app(&process_name)
{
    return HookDecision::Pass;
}
```

**Also in tray `CurrentAppCard`:**
```rust
// BEFORE: always shows "Windows native" badge for auto-disabled apps
// AFTER: hide badge when force_enable_all_apps is true
if !settings.force_enable_all_apps && is_windows_native_app(&process_name) {
    // show badge
}
```

#### Frontend UI

**Location:** Settings → Apps tab, above the "Auto-disable Windows apps" section.

```
┌─────────────────────────────────────────┐
│  ⚠ Force Smooth on All Apps            │
│                                         │
│  Override auto-disable for Windows      │
│  native apps (Notepad, Edge, etc.)      │
│                                         │
│  [━━━━━━━━━━━━━━━━━○] OFF              │
│                                         │
│  ℹ When enabled, smoothing is applied   │
│    to all apps including those with     │
│    built-in smooth scrolling.           │
└─────────────────────────────────────────┘
```

**Component change in `AppsTab.tsx`:** Add `Switch` + `Label` + `Description` above existing auto-disable section.

**i18n keys to add:**
```json
{
  "settings.apps.force_enable_all": "Force Smooth on All Apps",
  "settings.apps.force_enable_all_desc": "Override auto-disable for Windows native apps (Notepad, Edge, etc.)",
  "settings.apps.force_enable_all_warning": "When enabled, smoothing is applied to all apps including those with built-in smooth scrolling."
}
```

#### Files Changed

| File | Change |
|------|--------|
| `crates/core/src/settings.rs` | Add `force_enable_all_apps: bool` to `AppSettings` (default `false`). |
| `src-tauri/src/hook_wiring.rs` | Add `!settings.force_enable_all_apps` guard to auto-disable check. |
| `src/components/settings/AppsTab.tsx` | Add force-enable switch section. |
| `src/stores/settingsStore.ts` | Add `forceEnableAllApps` to store. |
| `src/i18n/locales/en.json` | Add keys. |
| `src/i18n/locales/*.json` | Update all14 locales. |

---

### F5: Scroll Analytics Dashboard

**Problem:** No usage visibility. Users don't know how much they scroll, which apps dominate, or how their profiles are used.

**Solution:** Lightweight daily summary showing: total scroll distance, active scroll time, top5 apps by distance, and profile switch count. Resets at midnight.

#### Data Model

**New file: `crates/core/src/stats.rs`**
```rust
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyStats {
    pub date: String,                      // "2026-07-07" (local date)
    pub total_scroll_distance_px: f64,     // sum of all eased pixels emitted
    pub total_notches: u64,                // raw notch count
    pub active_time_ms: u64,               // time with non-zero remaining_px
    pub app_distances: HashMap<String, f64>,  // process_name → distance_px
    pub profile_switches: u32,             // number of profile changes
    pub peak_velocity: f64,                // max notches/sec observed
}

impl DailyStats {
    pub fn total_scroll_distance_cm(&self) -> f64 {
        // Assume ~96 DPI → 1px ≈ 0.0265cm at standard scaling
        self.total_scroll_distance_px * 0.0265
    }
}
```

#### Collection Points

**In `engine_thread.rs` — per-frame stats collection:**
```rust
// After engine.step():
if let Some(distance) = engine.last_frame_distance() {
    // non-zero means scroll happened this frame
    stats_collector.record_distance(distance, &current_process_name);
    stats_collector.record_active_time(frame_dt_ms);
}
```

**In `hook_wiring.rs` — notch counting:**
```rust
// In register_notch path:
stats_collector.record_notch();
```

**In `resolve_effective_settings` — profile switch tracking:**
```rust
if new_profile_id != last_profile_id {
    stats_collector.record_profile_switch();
}
```

**Stats collector design:**
```rust
pub struct StatsCollector {
    today: Mutex<DailyStats>,
    save_path: PathBuf,
}

impl StatsCollector {
    pub fn record_distance(&self, px: f64, process_name: &str) {
        let mut stats = self.today.lock();
        stats.total_scroll_distance_px += px;
        *stats.app_distances.entry(process_name.to_string()).or_default() += px;
    }

    pub fn record_active_time(&self, dt_ms: u64) {
        self.today.lock().active_time_ms += dt_ms;
    }

    pub fn record_notch(&self) {
        self.today.lock().total_notches += 1;
    }

    pub fn record_profile_switch(&self) {
        self.today.lock().profile_switches += 1;
    }

    /// Called every60 seconds. Saves to disk. Checks if date changed → reset.
    fn periodic_save(&self) {
        let mut stats = self.today.lock();
        let today = Local::now().format("%Y-%m-%d").to_string();
        if stats.date != today {
            *stats = DailyStats { date: today, ..Default::default() };
        }
        // Atomic write: temp + rename
        let json = serde_json::to_string_pretty(&*stats).unwrap();
        let tmp = self.save_path.with_extension("tmp");
        std::fs::write(&tmp, &json).ok();
        std::fs::rename(&tmp, &self.save_path).ok();
    }
}
```

**Stats file location:** `%APPDATA%/SmoothScroll/stats.json`

#### Frontend Dashboard

**New tab in Settings: "Stats" (between "About" and "Support")**

```
┌─────────────────────────────────────────────┐
│  Today's Scroll Stats                       │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  12.3cm   │  │  45min    │  │  1,847   │  │
│  │  Distance │  │  Active   │  │  Notches │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  Top Apps                                   │
│  ┌─────────────────────────────────────┐    │
│  │ 1. Chrome         ████████  45%     │    │
│  │ 2. VS Code        █████     28%     │    │
│  │ 3. Discord        ███       12%     │    │
│  │ 4. Notepad        ██         8%     │    │
│  │ 5. File Explorer  █          4%     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Peak velocity: 18.3 notches/sec            │
│  Profile switches: 7                        │
└─────────────────────────────────────────────┘
```

**Component: `src/components/settings/StatsTab.tsx`**
- Fetches stats via `get_daily_stats()` Tauri command
- Three stat cards (distance, active time, notch count)
- Top apps list with percentage bars
- Peak velocity + profile switches as secondary info

**New Tauri command:**
```rust
#[tauri::command]
fn get_daily_stats(state: State<'_, AppState>) -> Result<DailyStats, String> {
    Ok(state.stats.today_snapshot())
}
```

**i18n keys to add:**
```json
{
  "stats.title": "Today's Scroll Stats",
  "stats.distance": "Distance",
  "stats.active_time": "Active",
  "stats.notches": "Notches",
  "stats.top_apps": "Top Apps",
  "stats.peak_velocity": "Peak velocity",
  "stats.profile_switches": "Profile switches",
  "stats.notches_unit": "{{count}} notches",
  "stats.active_unit": "{{minutes}}min",
  "stats.distance_unit": "{{cm}}cm"
}
```

#### Files Changed

| File | Change |
|------|--------|
| `crates/core/src/stats.rs` | **New file.** `DailyStats`, `StatsCollector` structs. |
| `crates/core/src/lib.rs` | Add `pub mod stats;` |
| `crates/core/Cargo.toml` | Add `chrono` dependency (for date handling). |
| `src-tauri/src/state.rs` | Add `stats: StatsCollector` to `AppState`. |
| `src-tauri/src/engine_thread.rs` | Call `stats.record_distance()` after each frame. |
| `src-tauri/src/hook_wiring.rs` | Call `stats.record_notch()` and `stats.record_profile_switch()`. |
| `src-tauri/src/commands.rs` | Add `get_daily_stats` command. |
| `src-tauri/src/lib.rs` | Register `get_daily_stats` in invoke_handler. Spawn stats save timer (60s interval). |
| `src/components/settings/StatsTab.tsx` | **New file.** Stats dashboard UI. |
| `src/components/SettingsWindow.tsx` | Add Stats tab. |
| `src/stores/settingsStore.ts` | Add `dailyStats` state + fetch action. |
| `src/lib/tauri.ts` | Add `DailyStats` type, `getDailyStats` invoke wrapper. |
| `src/i18n/locales/en.json` | Add stats keys. |

---

## Phase 3 — Distribution

### F17: Winget Package

**Problem:** SmoothScroll is only available via GitHub Releases (NSIS/MSI installers). Windows users increasingly use `winget` as the default package manager. No winget manifest exists.

**Solution:** Create winget package manifest + GitHub Actions workflow to auto-update manifest on new releases.

#### Manifest Structure

**Repository:** Create `microsoft/winget-pkgs` PR (or personal fork for testing).

**Manifest files:**
```yaml
# Installer manifest (SmoothScroll.SmoothScroll.yaml)
PackageIdentifier: SmoothScroll.SmoothScroll
PackageVersion: <dynamic>  # Updated by CI
InstallerType: nsis
InstallerUrl: https://github.com/nicedayzhu/SmoothScroll/releases/download/v<VERSION>/SmoothScroll_<VERSION>_x64-setup.exe
InstallerSha256: <dynamic>  # Computed by CI
ProductCode: SmoothScroll
Scope: user
InstallModes:
  - interactive
  - silent
  - silentWithProgress
UpgradeBehavior: install
ReleaseDate: <dynamic>
Installers:
  - Architecture: x64
    InstallerUrl: <see above>
    InstallerSha256: <see above>
    ProductCode: SmoothScroll
AppsAndFeaturesEntries:
  - DisplayName: SmoothScroll
    Publisher: SmoothScroll
    InstallerType: nsis
```

```yaml
# Version manifest (SmoothScroll.SmoothScroll.version.yaml)
PackageIdentifier: SmoothScroll.SmoothScroll
PackageVersion: <dynamic>
DefaultLocale: en-US
ManifestType: singleton
ManifestVersion: 1.9.0
```

```yaml
# Locale manifest (SmoothScroll.SmoothScroll.locale.en-US.yaml)
PackageIdentifier: SmoothScroll.SmoothScroll
PackageVersion: <dynamic>
PackageLocale: en-US
PackageName: SmoothScroll
PackageUrl: https://github.com/nicedayzhu/SmoothScroll
Publisher: SmoothScroll
ShortDescription: System-wide smooth scrolling for Windows
Description: SmoothScroll intercepts mouse wheel events and re-emits them as fluid, eased pulses at your display's native refresh rate. Gives Windows the same gliding scroll feel that macOS provides natively.
License: FSL-1.1-Apache-2.0
```

#### GitHub Actions Workflow

**New file: `.github/workflows/winget-update.yml`**

```yaml
name: Update Winget Manifest

on:
  release:
    types: [published]

jobs:
  update-winget:
    runs-on: windows-latest
    steps:
      - name: Compute SHA256
        id: sha
        run: |
          $url = "${{ github.event.release.assets[0].browser_download_url }}"
          Invoke-WebRequest -Uri $url -OutFile installer.exe
          $hash = (Get-FileHash installer.exe -Algorithm SHA256).Hash.ToLower()
          echo "sha256=$hash" >> $env:GITHUB_OUTPUT

      - name: Install wingetcreate
        run: |
          Invoke-WebRequest -Uri https://aka.ms/wingetcreate/latest -OutFile wingetcreate.exe

      - name: Update manifest
        run: |
          .\wingetcreate.exe update SmoothScroll.SmoothScroll `
            --version ${{ github.event.release.tag_name }} `
            --urls "${{ github.event.release.html_url }}/download/${{ github.event.release.tag_name }}/SmoothScroll_*_x64-setup.exe" `
            --submit `
            --token ${{ secrets.WINGET_PAT }}

      - name: Cleanup
        if: always()
        run: Remove-Item installer.exe -ErrorAction SilentlyContinue
```

#### Update Frequency

- Triggered on every GitHub Release publish event
- Auto-submit PR to `microsoft/winget-pkgs` via `wingetcreate --submit`
- Requires `WINGET_PAT` secret (GitHub PAT with `public_repo` scope for winget-pkgs fork)

#### Fallback: Manual Manifest

If auto-submit is not desired initially:

```yaml
# Static manifest for manual PR submission
# Update version + URLs + SHA256 before each release
```

#### Files Changed

| File | Change |
|------|--------|
| `.github/workflows/winget-update.yml` | **New file.** Auto-update workflow. |
| `README.md` | Add winget install instruction: `winget install SmoothScroll` |

#### README Addition

```markdown
## Installation

### Winget (Recommended)
```bash
winget install SmoothScroll
```

### Manual Download
Download the latest installer from [Releases](https://github.com/nicedayzhu/SmoothScroll/releases).
```

---

## Testing Strategy

### Unit Tests

| Feature | Test File | Key Tests |
|---------|-----------|-----------|
| F3 | `crates/core/tests/engine_tests.rs` | Velocity decay accuracy; factor curve monotonicity; direction change recovery; idle timeout reset |
| F4 | `crates/platform/src/windows/display.rs` (inline tests) | EnumDisplaySettings returns valid Hz; fallback to60 on error |
| F15 | `src-tauri/src/game_mode.rs` (inline tests) | PID cache hit skips enumeration; PID change triggers name lookup; known game detection unchanged |
| F1 | `crates/core/tests/settings_tests.rs` | Monitor profile lookup priority (app > monitor > default); empty monitor_profiles falls through |
| F2 | `crates/core/tests/settings_tests.rs` | force_enable_all_apps bypasses auto-disable; default is false |
| F5 | `crates/core/tests/stats_tests.rs` | Daily reset at midnight; distance accumulation; app distance tracking |

### Integration Tests

| Feature | Scenario |
|---------|----------|
| F3+F4 | Engine runs at display-matched frame rate with continuous acceleration |
| F1+F15 | Game mode correctly detects games regardless of monitor profile |
| F2+F5 | Stats accumulate correctly when force-enable is active |

### Benchmark Tests

| Feature | File | Criteria |
|---------|------|----------|
| F3 | `crates/core/benches/engine_benchmarks.rs` | Velocity computation <1μs per notch; factor computation <0.5μs per frame |
| F16 | `crates/core/benches/engine_benchmarks.rs` | All5 edge case benchmarks pass (see F16 section) |

### Manual Testing Checklist

- [ ] **F3:** Scroll slowly then fast — acceleration should be smooth, no "gear shifts"
- [ ] **F3:** Rapid up/down — no visual glitch or direction lag
- [ ] **F3:** Scroll fast, stop, wait1s, scroll again — acceleration starts from1.0
- [ ] **F4:** On60Hz monitor — engine runs at60Hz (check via frame time logging)
- [ ] **F4:** On144Hz monitor — engine runs at144Hz (check via frame time logging)
- [ ] **F15:** Game mode activates on fullscreen games
- [ ] **F15:** Game mode does NOT activate on non-fullscreen apps
- [ ] **F1:** Drag Chrome from monitor1 to monitor2 — scroll feel changes to monitor2's profile
- [ ] **F1:** Per-app profile takes priority over monitor profile
- [ ] **F2:** Toggle force-enable → Notepad gets smooth scrolling
- [ ] **F2:** Toggle off → Notepad back to raw scroll
- [ ] **F5:** Stats tab shows today's distance, time, top apps
- [ ] **F5:** Stats reset at midnight
- [ ] **F17:** `winget install SmoothScroll` works (after manifest merge)

---

## Migration & Backward Compatibility

### Settings Migration (v1 → v2)

```rust
fn migrate_settings(json: &mut serde_json::Value) {
    // Existing v1 migration (excluded_apps → app_profiles)
    // ...

    // NEW: Remove acceleration_delta_ms, add max_velocity
    if let Some(_old) = json.remove("acceleration_delta_ms") {
        tracing::info!("Migrated: removed acceleration_delta_ms, using velocity-based acceleration");
    }
    if json.get("max_velocity").is_none() {
        json["max_velocity"] = serde_json::json!(20.0);
    }

    // NEW: Add force_enable_all_apps (default false)
    if json.get("force_enable_all_apps").is_none() {
        json["force_enable_all_apps"] = serde_json::json!(false);
    }

    // NEW: Add monitor_profiles (default empty)
    if json.get("monitor_profiles").is_none() {
        json["monitor_profiles"] = serde_json::json!([]);
    }
}
```

### Profile Compatibility

Existing `ScrollProfile` struct unchanged — no fields removed or renamed. New fields (`max_velocity`) come from `AppSettings` defaults, not from profiles. Monitor profiles reference existing profile IDs. No profile data migration needed.

### Backward Compatibility Guarantees

- **Settings files:** Old settings load without error (missing fields get defaults).
- **Profiles:** Existing profiles work unchanged. New features use global defaults when profile doesn't specify.
- **IPC commands:** All existing Tauri commands unchanged. New commands are additions only.
- **Frontend:** Existing Zustand store selectors unchanged. New state is additive.
