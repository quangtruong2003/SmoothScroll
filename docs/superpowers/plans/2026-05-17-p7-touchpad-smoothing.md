# P7 — Precision Touchpad Smoothing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect Precision Touchpad (high-frequency, sub-120 deltas) vs mouse wheel, apply pixel-mode smoothing without acceleration for touchpad, normal notch math for wheels.

**Architecture:** New `InputClassifier` in core (event-history-based classification). Engine gains `register_pixels` path bypassing acceleration. Win32 hook captures all wheel events; classifier decides routing. Hook trait extended via default-method to avoid breaking existing impls.

**Tech Stack:** Rust (smoothscroll_core, smoothscroll_platform), Tauri 2 events, React + TypeScript.

**Spec:** [docs/superpowers/specs/2026-05-17-p7-touchpad-smoothing-design.md](../specs/2026-05-17-p7-touchpad-smoothing-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `crates/core/src/input_source.rs` | CREATE | InputSource enum + InputClassifier |
| `crates/core/src/lib.rs` | EDIT | Re-export module |
| `crates/core/src/settings.rs` | EDIT | Touchpad settings |
| `crates/core/src/engine.rs` | EDIT | `on_wheel_with_source`, `register_pixels` path |
| `crates/core/tests/input_source_tests.rs` | CREATE | Classifier tests |
| `crates/core/tests/engine_tests.rs` | EDIT | New pixel-mode tests |
| `crates/platform/src/traits.rs` | EDIT | Extend HookEventSink with `on_*_ext` default methods |
| `crates/platform/src/windows/mouse_hook.rs` | EDIT | Always pass classifier-derived source |
| `src-tauri/src/hook_wiring.rs` | EDIT | Use classifier, dispatch to engine |
| `src-tauri/src/state.rs` | EDIT | last_input_source AtomicU8 for UI |
| `src-tauri/src/commands.rs` | EDIT | New `get_input_source` command |
| `src-tauri/src/lib.rs` | EDIT | Register command |
| `src/components/settings/TouchpadSection.tsx` | CREATE | UI |
| `src/lib/tauri.ts` | EDIT | Types + wrapper |

---

## Task 1: Settings fields

**Files:**
- Modify: `crates/core/src/settings.rs`
- Modify: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Test**

Append to `crates/core/tests/settings_tests.rs`:

```rust
#[test]
fn touchpad_defaults() {
    let s = AppSettings::default();
    assert!(s.touchpad_smoothing_enabled);
    assert_eq!(s.touchpad_pixel_multiplier, 1.0);
    assert_eq!(s.touchpad_acceleration_factor, 1.0);
}

#[test]
fn touchpad_clamp_bounds() {
    let mut s = AppSettings::default();
    s.touchpad_pixel_multiplier = 0.0;
    s.touchpad_acceleration_factor = -5.0;
    s.clamp();
    assert!(s.touchpad_pixel_multiplier >= 0.1);
    assert!(s.touchpad_acceleration_factor >= 0.0);
}
```

- [ ] **Step 2: Run, verify failure**

```bash
cargo test -p smoothscroll_core --test settings_tests touchpad_defaults
```

Expected: FAIL.

- [ ] **Step 3: Add fields**

In `crates/core/src/settings.rs`, in `AppSettings`:

```rust
// Precision Touchpad
pub touchpad_smoothing_enabled: bool,
pub touchpad_pixel_multiplier: f64,
pub touchpad_acceleration_factor: f64,
```

In `Default for AppSettings`:

```rust
touchpad_smoothing_enabled: true,
touchpad_pixel_multiplier: 1.0,
touchpad_acceleration_factor: 1.0,
```

In `clamp()`:

```rust
self.touchpad_pixel_multiplier = self.touchpad_pixel_multiplier.clamp(0.1, 5.0);
self.touchpad_acceleration_factor = self.touchpad_acceleration_factor.clamp(0.0, 3.0);
```

- [ ] **Step 4: Run, verify pass**

```bash
cargo test -p smoothscroll_core --test settings_tests touchpad
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): add touchpad settings"
```

---

## Task 2: InputSource enum + InputClassifier

**Files:**
- Create: `crates/core/src/input_source.rs`
- Create: `crates/core/tests/input_source_tests.rs`
- Modify: `crates/core/src/lib.rs`

- [ ] **Step 1: Tests**

Create `crates/core/tests/input_source_tests.rs`:

```rust
use smoothscroll_core::input_source::{InputClassifier, InputSource};

#[test]
fn standard_wheel_event_is_wheel() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(120, 1000), InputSource::Wheel);
    assert_eq!(c.classify(-120, 1100), InputSource::Wheel);
}

#[test]
fn small_delta_alone_is_high_res_wheel() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(30, 1000), InputSource::HighResWheel);
}

#[test]
fn high_frequency_small_delta_is_touchpad() {
    let mut c = InputClassifier::new();
    for i in 0..7 {
        c.classify(20, 1000 + i * 20);
    }
    assert_eq!(c.classify(20, 1140), InputSource::Touchpad);
}

#[test]
fn old_events_drop_out_of_window() {
    let mut c = InputClassifier::new();
    for i in 0..6 {
        c.classify(20, 1000 + i * 20);
    }
    assert_eq!(c.classify(20, 2000), InputSource::HighResWheel);
}

#[test]
fn zero_delta_is_wheel_default() {
    let mut c = InputClassifier::new();
    assert_eq!(c.classify(0, 1000), InputSource::Wheel);
}
```

- [ ] **Step 2: Run, verify failure**

```bash
cargo test -p smoothscroll_core --test input_source_tests
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `crates/core/src/input_source.rs`:

```rust
//! Classifies wheel events as Wheel / HighResWheel / Touchpad based on
//! delta magnitude and event frequency.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputSource {
    Wheel,
    HighResWheel,
    Touchpad,
}

const HISTORY_WINDOW_MS: u64 = 200;
const TOUCHPAD_EVENT_THRESHOLD: usize = 5;
const STANDARD_NOTCH_DELTA: i32 = 120;

pub struct InputClassifier {
    recent: VecDeque<(u64, i32)>,
}

impl Default for InputClassifier {
    fn default() -> Self { Self::new() }
}

impl InputClassifier {
    pub fn new() -> Self {
        Self { recent: VecDeque::with_capacity(32) }
    }

    pub fn classify(&mut self, delta: i32, now_ms: u64) -> InputSource {
        while let Some(&(t, _)) = self.recent.front() {
            if now_ms.saturating_sub(t) > HISTORY_WINDOW_MS {
                self.recent.pop_front();
            } else {
                break;
            }
        }
        self.recent.push_back((now_ms, delta));

        let abs_delta = delta.unsigned_abs() as i32;
        let event_count = self.recent.len();

        if abs_delta == 0 {
            return InputSource::Wheel;
        }
        if event_count > TOUCHPAD_EVENT_THRESHOLD && abs_delta < STANDARD_NOTCH_DELTA {
            return InputSource::Touchpad;
        }
        if abs_delta < STANDARD_NOTCH_DELTA {
            return InputSource::HighResWheel;
        }
        InputSource::Wheel
    }
}
```

Modify `crates/core/src/lib.rs`:

```rust
pub mod input_source;
```

- [ ] **Step 4: Run, verify pass**

```bash
cargo test -p smoothscroll_core --test input_source_tests
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/input_source.rs crates/core/src/lib.rs crates/core/tests/input_source_tests.rs
git commit -m "feat(core): add InputSource + InputClassifier"
```

---

## Task 3: Engine pixel-mode

**Files:**
- Modify: `crates/core/src/engine.rs`
- Modify: `crates/core/tests/engine_tests.rs`

- [ ] **Step 1: Tests**

Append to `crates/core/tests/engine_tests.rs`:

```rust
use smoothscroll_core::engine::SmoothScrollEngine;
use smoothscroll_core::input_source::InputSource;
use smoothscroll_core::settings::AppSettings;

#[test]
fn touchpad_input_skips_acceleration() {
    let mut e = SmoothScrollEngine::new(AppSettings::default());
    for i in 0..6 {
        e.on_wheel_with_source(30, i * 20, InputSource::Touchpad);
    }
    assert!(e.has_pending_work());
    let mut total = 0;
    for _ in 0..200 {
        let out = e.step(8.33);
        total += out.vertical;
        if !e.has_pending_work() { break; }
    }
    assert!(total.abs() < 600, "touchpad output too large: {}", total);
}

#[test]
fn touchpad_pixel_multiplier_scales_output() {
    let mut s = AppSettings::default();
    s.touchpad_pixel_multiplier = 2.0;
    let mut e = SmoothScrollEngine::new(s);
    for i in 0..6 {
        e.on_wheel_with_source(30, i * 20, InputSource::Touchpad);
    }
    let mut total = 0;
    for _ in 0..200 {
        total += e.step(8.33).vertical;
        if !e.has_pending_work() { break; }
    }
    assert!(total > 0, "expected positive output");
}

#[test]
fn legacy_on_wheel_still_works() {
    let mut e = SmoothScrollEngine::new(AppSettings::default());
    e.on_wheel(120, 0);
    assert!(e.has_pending_work());
}
```

- [ ] **Step 2: Run, verify failure**

```bash
cargo test -p smoothscroll_core --test engine_tests touchpad
```

Expected: FAIL — `on_wheel_with_source` not found.

- [ ] **Step 3: Add Axis::register_pixels**

In `crates/core/src/engine.rs`, add to `Axis` impl:

```rust
fn register_pixels(&mut self, px: f64, now_ms: u64, multiplier: f64) {
    self.last_notch_ms = now_ms;
    self.accel_factor = 1;
    self.remaining_px += px * multiplier;
}
```

- [ ] **Step 4: Add `on_wheel_with_source` to engine**

In `SmoothScrollEngine` impl:

```rust
pub fn on_wheel_with_source(&mut self, delta: i32, now_ms: u64, source: crate::input_source::InputSource) {
    use crate::input_source::InputSource;
    let dir = if self.settings.reverse_wheel_direction { -1 } else { 1 };
    match source {
        InputSource::Wheel | InputSource::HighResWheel => {
            self.v.register_notch(now_ms, delta * dir, &self.settings);
        }
        InputSource::Touchpad => {
            if !self.settings.touchpad_smoothing_enabled {
                self.v.register_notch(now_ms, delta * dir, &self.settings);
                return;
            }
            let px = (delta as f64 / crate::constants::WHEEL_DELTA as f64)
                * crate::constants::BASE_STEP_PX
                * dir as f64;
            self.v.register_pixels(px, now_ms, self.settings.touchpad_pixel_multiplier);
        }
    }
}

pub fn on_hwheel_with_source(&mut self, delta: i32, now_ms: u64, source: crate::input_source::InputSource) {
    use crate::input_source::InputSource;
    let dir = if self.settings.reverse_wheel_direction { -1 } else { 1 };
    match source {
        InputSource::Wheel | InputSource::HighResWheel => {
            self.h.register_notch(now_ms, delta * dir, &self.settings);
        }
        InputSource::Touchpad => {
            if !self.settings.touchpad_smoothing_enabled {
                self.h.register_notch(now_ms, delta * dir, &self.settings);
                return;
            }
            let px = (delta as f64 / crate::constants::WHEEL_DELTA as f64)
                * crate::constants::BASE_STEP_PX
                * dir as f64;
            self.h.register_pixels(px, now_ms, self.settings.touchpad_pixel_multiplier);
        }
    }
}
```

Replace existing `on_wheel`/`on_hwheel` bodies with delegation:

```rust
pub fn on_wheel(&mut self, delta: i32, now_ms: u64) {
    self.on_wheel_with_source(delta, now_ms, crate::input_source::InputSource::Wheel);
}

pub fn on_hwheel(&mut self, delta: i32, now_ms: u64) {
    self.on_hwheel_with_source(delta, now_ms, crate::input_source::InputSource::Wheel);
}
```

- [ ] **Step 5: Run engine tests, verify pass**

```bash
cargo test -p smoothscroll_core --test engine_tests
```

Expected: PASS — including all existing tests.

- [ ] **Step 6: Commit**

```bash
git add crates/core/src/engine.rs crates/core/tests/engine_tests.rs
git commit -m "feat(core): engine pixel-mode for touchpad input"
```

---

## Task 4: Hook trait extension (default method)

**Files:**
- Modify: `crates/platform/src/traits.rs`

- [ ] **Step 1: Extend trait**

In `crates/platform/src/traits.rs`, modify `HookEventSink`:

```rust
pub trait HookEventSink: Send + Sync {
    fn on_wheel(&self, delta: i32, mods: ModifierKeys) -> HookDecision;
    fn on_hwheel(&self, delta: i32) -> HookDecision;

    fn on_wheel_ext(&self, delta: i32, mods: ModifierKeys, _source: smoothscroll_core::input_source::InputSource) -> HookDecision {
        self.on_wheel(delta, mods)
    }
    fn on_hwheel_ext(&self, delta: i32, _source: smoothscroll_core::input_source::InputSource) -> HookDecision {
        self.on_hwheel(delta)
    }
}
```

- [ ] **Step 2: Verify compile**

```bash
cargo check -p smoothscroll_platform
```

Expected: PASS — existing impls unchanged.

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/traits.rs
git commit -m "feat(platform): extend HookEventSink with on_*_ext default methods"
```

---

## Task 5: Win32 mouse_hook uses InputClassifier

**Files:**
- Modify: `crates/platform/src/windows/mouse_hook.rs`

- [ ] **Step 1: Update HookContext**

In `crates/platform/src/windows/mouse_hook.rs`, modify `HookContext`:

```rust
struct HookContext {
    sink: Arc<dyn HookEventSink>,
    modifiers: Arc<ModifierState>,
    classifier_v: Mutex<smoothscroll_core::input_source::InputClassifier>,
    classifier_h: Mutex<smoothscroll_core::input_source::InputClassifier>,
    epoch: std::time::Instant,
}
```

In `install`, populate:

```rust
*HOOK_CONTEXT.lock() = Some(Arc::new(HookContext {
    sink,
    modifiers: modifier_state,
    classifier_v: Mutex::new(smoothscroll_core::input_source::InputClassifier::new()),
    classifier_h: Mutex::new(smoothscroll_core::input_source::InputClassifier::new()),
    epoch: std::time::Instant::now(),
}));
```

- [ ] **Step 2: Use classifier in low_level_proc**

Replace the dispatch block in `low_level_proc`:

```rust
let now_ms = ctx.epoch.elapsed().as_millis() as u64;
let decision = match msg {
    x if x == WM_MOUSEWHEEL => {
        let source = ctx.classifier_v.lock().classify(delta, now_ms);
        ctx.sink.on_wheel_ext(delta, mods, source)
    }
    x if x == WM_MOUSEHWHEEL => {
        let source = ctx.classifier_h.lock().classify(delta, now_ms);
        ctx.sink.on_hwheel_ext(delta, source)
    }
    _ => HookDecision::Pass,
};
```

- [ ] **Step 3: Verify compile**

```bash
cargo check -p smoothscroll_platform --target x86_64-pc-windows-msvc
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/windows/mouse_hook.rs
git commit -m "feat(platform/win): classify wheel events with InputClassifier"
```

---

## Task 6: hook_wiring routes by source

**Files:**
- Modify: `src-tauri/src/hook_wiring.rs`
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: AppState field**

Modify `src-tauri/src/state.rs`:

```rust
pub last_input_source: Arc<std::sync::atomic::AtomicU8>,
```

In production AppState ctor + test stub helpers in `make_state(...)` and `make_state_with_process(...)`:

```rust
last_input_source: Arc::new(std::sync::atomic::AtomicU8::new(0)),
```

- [ ] **Step 2: EngineSink ext methods**

In `src-tauri/src/hook_wiring.rs`, add to `EngineSink`:

```rust
fn route_vertical_with_source(&self, delta: i32, mods: ModifierKeys, source: smoothscroll_core::input_source::InputSource) -> HookDecision {
    if !self.state.enabled.load(Ordering::Relaxed) {
        return HookDecision::Pass;
    }
    if self.resolve_active().is_none() {
        return HookDecision::Pass;
    }
    let (shift_to_horizontal, horizontal_smoothness) = {
        let s = self.state.engine.lock().settings().clone();
        (s.shift_key_horizontal, s.horizontal_smoothness)
    };

    self.update_last_source(source);

    let now = self.now_ms();

    if mods.shift && shift_to_horizontal {
        if horizontal_smoothness {
            self.state.engine.lock().on_hwheel_with_source(delta, now, source);
            self.state.engine_signal.signal();
            HookDecision::Swallow
        } else {
            HookDecision::Pass
        }
    } else {
        self.state.engine.lock().on_wheel_with_source(delta, now, source);
        self.state.engine_signal.signal();
        HookDecision::Swallow
    }
}

fn route_horizontal_with_source(&self, delta: i32, source: smoothscroll_core::input_source::InputSource) -> HookDecision {
    if !self.state.enabled.load(Ordering::Relaxed) {
        return HookDecision::Pass;
    }
    if self.resolve_active().is_none() {
        return HookDecision::Pass;
    }
    let horizontal_smoothness = self.state.engine.lock().settings().horizontal_smoothness;
    if !horizontal_smoothness {
        return HookDecision::Pass;
    }
    self.update_last_source(source);
    let now = self.now_ms();
    self.state.engine.lock().on_hwheel_with_source(delta, now, source);
    self.state.engine_signal.signal();
    HookDecision::Swallow
}

fn update_last_source(&self, source: smoothscroll_core::input_source::InputSource) {
    use smoothscroll_core::input_source::InputSource;
    let code: u8 = match source {
        InputSource::Wheel => 0,
        InputSource::HighResWheel => 1,
        InputSource::Touchpad => 2,
    };
    self.state.last_input_source.store(code, std::sync::atomic::Ordering::Relaxed);
}
```

Override trait default methods:

```rust
impl HookEventSink for EngineSink {
    fn on_wheel(&self, delta: i32, mods: ModifierKeys) -> HookDecision {
        self.route_vertical(delta, mods)
    }
    fn on_hwheel(&self, delta: i32) -> HookDecision {
        self.route_horizontal(delta)
    }
    fn on_wheel_ext(&self, delta: i32, mods: ModifierKeys, source: smoothscroll_core::input_source::InputSource) -> HookDecision {
        self.route_vertical_with_source(delta, mods, source)
    }
    fn on_hwheel_ext(&self, delta: i32, source: smoothscroll_core::input_source::InputSource) -> HookDecision {
        self.route_horizontal_with_source(delta, source)
    }
}
```

- [ ] **Step 3: Run tests**

```bash
cargo test -p smoothscroll-app
```

Expected: PASS — existing hook_wiring tests still pass (legacy `on_wheel` path unchanged).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/hook_wiring.rs src-tauri/src/state.rs
git commit -m "feat(tauri): hook wiring routes events by InputSource"
```

---

## Task 7: IPC + TS types

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add IPC command**

Append to `src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn get_input_source(state: State<'_, Arc<AppState>>) -> &'static str {
    match state.last_input_source.load(Ordering::Relaxed) {
        1 => "HighResWheel",
        2 => "Touchpad",
        _ => "Wheel",
    }
}
```

- [ ] **Step 2: Register**

In `src-tauri/src/lib.rs` invoke handler:

```rust
commands::get_input_source,
```

- [ ] **Step 3: TS wrapper + AppSettings**

Append to `src/lib/tauri.ts`:

```typescript
export type InputSourceLabel = "Wheel" | "HighResWheel" | "Touchpad";
```

Inside `tauri` object:

```typescript
async getInputSource(): Promise<InputSourceLabel> {
  return invoke<InputSourceLabel>("get_input_source");
},
```

In `AppSettings` interface:

```typescript
touchpad_smoothing_enabled: boolean;
touchpad_pixel_multiplier: number;
touchpad_acceleration_factor: number;
```

- [ ] **Step 4: Verify build**

```bash
cargo check -p smoothscroll-app && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat(tauri): get_input_source IPC + TS types"
```

---

## Task 8: TouchpadSection UI

**Files:**
- Create: `src/components/settings/TouchpadSection.tsx`
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Component**

Create `src/components/settings/TouchpadSection.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { tauri, type InputSourceLabel } from "@/lib/tauri";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICON: Record<InputSourceLabel, string> = {
  Wheel: "🖱️",
  HighResWheel: "🖱️ ⚡",
  Touchpad: "💻",
};

export function TouchpadSection() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  const [source, setSource] = useState<InputSourceLabel>("Wheel");

  useEffect(() => {
    const interval = setInterval(() => {
      tauri.getInputSource().then(setSource);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precision touchpad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded p-2 text-sm bg-muted">
          Detected: {ICON[source]} {source}
        </div>

        <div className="flex items-center justify-between">
          <Label>Enable touchpad smoothing</Label>
          <Switch
            checked={settings.touchpad_smoothing_enabled}
            onCheckedChange={(v) => patch({ touchpad_smoothing_enabled: v })}
          />
        </div>

        <div>
          <Label>Pixel multiplier: {settings.touchpad_pixel_multiplier.toFixed(2)}x</Label>
          <Slider
            min={0.5} max={3} step={0.1}
            value={[settings.touchpad_pixel_multiplier]}
            onValueChange={([v]) => patch({ touchpad_pixel_multiplier: v })}
            disabled={!settings.touchpad_smoothing_enabled}
          />
        </div>

        <div>
          <Label>Acceleration factor: {settings.touchpad_acceleration_factor.toFixed(2)}x</Label>
          <Slider
            min={0} max={3} step={0.1}
            value={[settings.touchpad_acceleration_factor]}
            onValueChange={([v]) => patch({ touchpad_acceleration_factor: v })}
            disabled={!settings.touchpad_smoothing_enabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Register**

In `src/routes/Settings.tsx`, in Behavior tab:

```tsx
<TouchpadSection />
```

- [ ] **Step 3: TS compile + dev**

```bash
npx tsc --noEmit && npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/TouchpadSection.tsx src/routes/Settings.tsx
git commit -m "feat(ui): touchpad settings + live source indicator"
```

---

## Task 9: Final smoke + build

- [ ] **Step 1: Build**

```bash
cargo tauri build
```

Expected: SUCCESS.

- [ ] **Step 2: Manual smoke (Windows laptop required)**

- [ ] On Surface/laptop with precision touchpad: scroll long article → smooth, no acceleration ramp.
- [ ] Live indicator changes to "💻 Touchpad" when using touchpad.
- [ ] Switch to mouse wheel → indicator changes to "🖱️ Wheel".
- [ ] Logitech MX Master high-res mode → indicator "🖱️ ⚡ HighResWheel".
- [ ] Pixel multiplier 2x → touchpad scroll noticeably faster.
- [ ] Disable touchpad_smoothing_enabled → touchpad falls back to legacy notch math.
- [ ] Standard mouse scroll unchanged from v0.3.0 behavior.

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: P7 final fixes" --allow-empty
```

---

## Self-Review Checklist

- [x] Spec section 3 architecture → Tasks 2, 3, 4, 5, 6
- [x] Spec section 4 InputClassifier → Task 2
- [x] Spec section 5 engine pixel-mode → Task 3
- [x] Spec section 6 trait backward compat → Task 4
- [x] Spec section 7 schema → Task 1
- [x] Spec section 8 input-source UI → Task 7+8 (replaced event with polling for simplicity)
- [x] Spec section 10 testing → Tasks 1-3 + Task 9 manual
