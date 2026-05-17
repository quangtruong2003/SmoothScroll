# P5 — Edge Auto-Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi cursor gần mép trên/dưới của window, tự động scroll continuously với tốc độ tỷ lệ khoảng cách đến mép.

**Architecture:** Pure-Rust velocity computation in core. New `WindowGeometry` trait in platform crate (Win32 impl + macOS stub). Polling thread in app crate at 60Hz feeds `engine.on_wheel`.

**Tech Stack:** Rust (smoothscroll_core, smoothscroll_platform), Tauri 2, React + TypeScript.

**Spec:** [docs/superpowers/specs/2026-05-17-p5-edge-autoscroll-design.md](../specs/2026-05-17-p5-edge-autoscroll-design.md)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `crates/core/src/edge_scroll.rs` | CREATE | Pure compute_velocity logic |
| `crates/core/src/lib.rs` | EDIT | Re-export module |
| `crates/core/src/settings.rs` | EDIT | New fields |
| `crates/core/tests/edge_scroll_tests.rs` | CREATE | Velocity unit tests |
| `crates/platform/src/traits.rs` | EDIT | Add `WindowGeometry` trait |
| `crates/platform/src/types.rs` | EDIT | Add `WindowRect`, `Point` types |
| `crates/platform/src/windows/window_geom.rs` | CREATE | Win32 impl |
| `crates/platform/src/windows/mod.rs` | EDIT | Export window_geom |
| `crates/platform/src/macos/window_geom.rs` | CREATE | macOS stub |
| `crates/platform/src/macos/mod.rs` | EDIT | Export macOS stub |
| `src-tauri/src/edge_scroll_thread.rs` | CREATE | Poll loop |
| `src-tauri/src/state.rs` | EDIT | Add `window_geom` field |
| `src-tauri/src/lib.rs` | EDIT | Spawn thread on startup |
| `src/components/settings/EdgeScrollSection.tsx` | CREATE | UI |
| `src/lib/tauri.ts` | EDIT | Type updates |

---

## Task 1: Add settings fields

**Files:**
- Modify: `crates/core/src/settings.rs`
- Test: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Write test**

Append to `crates/core/tests/settings_tests.rs`:

```rust
#[test]
fn edge_scroll_defaults_to_off() {
    let s = AppSettings::default();
    assert!(!s.edge_scroll_enabled);
    assert_eq!(s.edge_scroll_zone_px, 40);
    assert_eq!(s.edge_scroll_max_notches_per_sec, 5.0);
    assert!(!s.edge_scroll_modifier_required);
}

#[test]
fn edge_scroll_clamp_bounds_zone() {
    let mut s = AppSettings::default();
    s.edge_scroll_zone_px = 5;
    s.clamp();
    assert!(s.edge_scroll_zone_px >= 10);
    s.edge_scroll_zone_px = 9999;
    s.clamp();
    assert!(s.edge_scroll_zone_px <= 200);
}
```

- [ ] **Step 2: Run, verify failure**

```bash
cargo test -p smoothscroll_core --test settings_tests
```

Expected: FAIL — no field `edge_scroll_enabled`.

- [ ] **Step 3: Add fields**

In `crates/core/src/settings.rs`, in `AppSettings` struct after `excluded_apps`:

```rust
// Edge auto-scroll
pub edge_scroll_enabled: bool,
pub edge_scroll_zone_px: i32,
pub edge_scroll_max_notches_per_sec: f64,
pub edge_scroll_modifier_required: bool,
pub edge_scroll_modifier: String,
```

In `Default for AppSettings`:

```rust
edge_scroll_enabled: false,
edge_scroll_zone_px: 40,
edge_scroll_max_notches_per_sec: 5.0,
edge_scroll_modifier_required: false,
edge_scroll_modifier: "Alt".to_string(),
```

In `clamp()`:

```rust
self.edge_scroll_zone_px = self.edge_scroll_zone_px.clamp(10, 200);
self.edge_scroll_max_notches_per_sec = self.edge_scroll_max_notches_per_sec.clamp(0.5, 20.0);
if !["Alt", "Shift", "Ctrl"].contains(&self.edge_scroll_modifier.as_str()) {
    self.edge_scroll_modifier = "Alt".to_string();
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
cargo test -p smoothscroll_core --test settings_tests
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): add edge-scroll settings"
```

---

## Task 2: Create edge_scroll.rs core logic

**Files:**
- Create: `crates/core/src/edge_scroll.rs`
- Create: `crates/core/tests/edge_scroll_tests.rs`
- Modify: `crates/core/src/lib.rs`

- [ ] **Step 1: Write tests**

Create `crates/core/tests/edge_scroll_tests.rs`:

```rust
use smoothscroll_core::edge_scroll::compute_velocity;

#[test]
fn middle_of_window_returns_zero() {
    let v = compute_velocity(500, 0, 1000, 40, 5.0);
    assert_eq!(v, 0.0);
}

#[test]
fn bottom_edge_returns_positive() {
    let v = compute_velocity(990, 0, 1000, 40, 5.0);
    assert!(v > 0.0);
}

#[test]
fn top_edge_returns_negative() {
    let v = compute_velocity(10, 0, 1000, 40, 5.0);
    assert!(v < 0.0);
}

#[test]
fn at_exact_edge_returns_max_speed() {
    let v = compute_velocity(1000, 0, 1000, 40, 5.0);
    assert!((v - 5.0).abs() < 0.01);
}

#[test]
fn outside_zone_returns_zero() {
    let v = compute_velocity(950, 0, 1000, 40, 5.0);
    assert_eq!(v, 0.0);
}

#[test]
fn velocity_is_quadratic() {
    let v = compute_velocity(980, 0, 1000, 40, 5.0);
    assert!((v - 1.25).abs() < 0.01);
}

#[test]
fn cursor_outside_window_returns_zero() {
    let v = compute_velocity(-10, 0, 1000, 40, 5.0);
    assert_eq!(v, 0.0);
}
```

- [ ] **Step 2: Run, verify failure**

```bash
cargo test -p smoothscroll_core --test edge_scroll_tests
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create edge_scroll.rs**

Create `crates/core/src/edge_scroll.rs`:

```rust
//! Edge auto-scroll velocity computation. Pure function, no I/O.

pub fn compute_velocity(
    cursor_y: i32,
    window_top: i32,
    window_bottom: i32,
    zone_size_px: i32,
    max_speed: f64,
) -> f64 {
    if cursor_y < window_top || cursor_y > window_bottom {
        return 0.0;
    }
    if zone_size_px <= 0 || max_speed <= 0.0 {
        return 0.0;
    }
    let from_top = cursor_y - window_top;
    let from_bot = window_bottom - cursor_y;

    if from_top < zone_size_px {
        let intensity = 1.0 - (from_top as f64 / zone_size_px as f64);
        -max_speed * intensity * intensity
    } else if from_bot < zone_size_px {
        let intensity = 1.0 - (from_bot as f64 / zone_size_px as f64);
        max_speed * intensity * intensity
    } else {
        0.0
    }
}
```

Modify `crates/core/src/lib.rs` — add:

```rust
pub mod edge_scroll;
```

- [ ] **Step 4: Run, verify pass**

```bash
cargo test -p smoothscroll_core --test edge_scroll_tests
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/edge_scroll.rs crates/core/src/lib.rs crates/core/tests/edge_scroll_tests.rs
git commit -m "feat(core): add edge-scroll velocity computation"
```

---

## Task 3: WindowGeometry trait + types

**Files:**
- Modify: `crates/platform/src/types.rs`
- Modify: `crates/platform/src/traits.rs`

- [ ] **Step 1: Types**

Append to `crates/platform/src/types.rs`:

```rust
#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct Point { pub x: i32, pub y: i32 }

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct WindowRect {
    pub left: i32, pub top: i32,
    pub right: i32, pub bottom: i32,
}
```

- [ ] **Step 2: Trait**

Append to `crates/platform/src/traits.rs`:

```rust
use crate::types::{Point, WindowRect};

pub trait WindowGeometry: Send + Sync {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)>;
}
```

- [ ] **Step 3: Verify**

```bash
cargo check -p smoothscroll_platform
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/types.rs crates/platform/src/traits.rs
git commit -m "feat(platform): add WindowGeometry trait"
```

---

## Task 4: Win32 implementation

**Files:**
- Create: `crates/platform/src/windows/window_geom.rs`
- Modify: `crates/platform/src/windows/mod.rs`

- [ ] **Step 1: Implementation**

Create `crates/platform/src/windows/window_geom.rs`:

```rust
#![cfg(windows)]

use crate::traits::WindowGeometry;
use crate::types::{Point, WindowRect};
use std::mem;
use windows_sys::Win32::Foundation::{HWND, POINT, RECT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetAncestor, GetCursorPos, GetWindowRect, WindowFromPoint, GA_ROOT,
};

pub struct WindowsWindowGeometry;

impl WindowGeometry for WindowsWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        unsafe {
            let mut pt: POINT = mem::zeroed();
            if GetCursorPos(&mut pt) == 0 { return None; }
            let hwnd: HWND = WindowFromPoint(pt);
            if hwnd.is_null() { return None; }
            let top = GetAncestor(hwnd, GA_ROOT);
            let mut rc: RECT = mem::zeroed();
            if GetWindowRect(top, &mut rc) == 0 { return None; }
            Some((
                Point { x: pt.x, y: pt.y },
                WindowRect { left: rc.left, top: rc.top, right: rc.right, bottom: rc.bottom },
            ))
        }
    }
}
```

Modify `crates/platform/src/windows/mod.rs`:

```rust
pub mod window_geom;
pub use window_geom::WindowsWindowGeometry;
```

- [ ] **Step 2: Verify (Windows)**

```bash
cargo check -p smoothscroll_platform --target x86_64-pc-windows-msvc
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add crates/platform/src/windows/
git commit -m "feat(platform/win): WindowGeometry impl"
```

---

## Task 5: macOS stub

**Files:**
- Create: `crates/platform/src/macos/window_geom.rs`
- Modify: `crates/platform/src/macos/mod.rs`

- [ ] **Step 1: Stub**

Create `crates/platform/src/macos/window_geom.rs`:

```rust
#![cfg(target_os = "macos")]

use crate::traits::WindowGeometry;
use crate::types::{Point, WindowRect};

pub struct MacosWindowGeometry;

impl WindowGeometry for MacosWindowGeometry {
    fn cursor_in_window(&self) -> Option<(Point, WindowRect)> {
        None
    }
}
```

Modify `crates/platform/src/macos/mod.rs`:

```rust
pub mod window_geom;
pub use window_geom::MacosWindowGeometry;
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/macos/
git commit -m "feat(platform/macos): stub WindowGeometry"
```

---

## Task 6: Edge scroll polling thread

**Files:**
- Create: `src-tauri/src/edge_scroll_thread.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: AppState field**

Modify `src-tauri/src/state.rs` — add:

```rust
pub window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry>,
```

- [ ] **Step 2: Wire in lib.rs init**

In `src-tauri/src/lib.rs`, where `AppState` is constructed:

```rust
#[cfg(windows)]
let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
    Arc::new(smoothscroll_platform::windows::WindowsWindowGeometry);
#[cfg(target_os = "macos")]
let window_geom: Arc<dyn smoothscroll_platform::traits::WindowGeometry> =
    Arc::new(smoothscroll_platform::macos::MacosWindowGeometry);
```

Add `window_geom` to `AppState { ... }` literal.

- [ ] **Step 3: Update test stub**

In `src-tauri/src/hook_wiring.rs` test mod, add `StubWindowGeom`:

```rust
struct StubWindowGeom;
impl smoothscroll_platform::traits::WindowGeometry for StubWindowGeom {
    fn cursor_in_window(&self) -> Option<(smoothscroll_platform::types::Point, smoothscroll_platform::types::WindowRect)> {
        None
    }
}
```

In `make_state(...)` and `make_state_with_process(...)`, add:

```rust
window_geom: Arc::new(StubWindowGeom),
```

- [ ] **Step 4: Create polling module**

Create `src-tauri/src/edge_scroll_thread.rs`:

```rust
use crate::state::AppState;
use smoothscroll_core::constants::WHEEL_DELTA;
use smoothscroll_core::edge_scroll::compute_velocity;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

pub fn spawn(state: Arc<AppState>) -> thread::JoinHandle<()> {
    thread::Builder::new()
        .name("ss-edge-scroll".into())
        .spawn(move || run(state))
        .expect("spawn edge-scroll thread")
}

fn run(state: Arc<AppState>) {
    let epoch = Instant::now();
    let mut last_emit = Instant::now();
    let mut accumulated = 0.0f64;

    loop {
        thread::sleep(Duration::from_millis(16));
        let s = state.settings.read();
        if !state.enabled.load(Ordering::Relaxed) || !s.edge_scroll_enabled {
            accumulated = 0.0;
            drop(s);
            thread::sleep(Duration::from_millis(100));
            continue;
        }
        let zone = s.edge_scroll_zone_px;
        let max_speed = s.edge_scroll_max_notches_per_sec;
        drop(s);

        let Some((pt, rect)) = state.window_geom.cursor_in_window() else {
            accumulated = 0.0;
            continue;
        };
        let v = compute_velocity(pt.y, rect.top, rect.bottom, zone, max_speed);
        if v == 0.0 {
            accumulated = 0.0;
            continue;
        }

        let now = Instant::now();
        let dt = now.duration_since(last_emit).as_secs_f64();
        last_emit = now;
        accumulated += v * dt;

        if accumulated.abs() >= 1.0 {
            let notches = accumulated.trunc() as i32;
            accumulated -= notches as f64;
            let delta = notches * WHEEL_DELTA;
            let now_ms = epoch.elapsed().as_millis() as u64;
            state.engine.lock().on_wheel(delta, now_ms);
            state.engine_signal.signal();
        }
    }
}
```

- [ ] **Step 5: Spawn**

In `src-tauri/src/lib.rs`:
- Add `pub mod edge_scroll_thread;` near top.
- In setup callback:
  ```rust
  crate::edge_scroll_thread::spawn(state.clone());
  ```

- [ ] **Step 6: Verify build**

```bash
cargo check -p smoothscroll-app
cargo test -p smoothscroll-app  # ensure hook_wiring tests still compile
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/edge_scroll_thread.rs src-tauri/src/state.rs src-tauri/src/lib.rs src-tauri/src/hook_wiring.rs
git commit -m "feat(tauri): edge-scroll polling thread"
```

---

## Task 7: UI section

**Files:**
- Create: `src/components/settings/EdgeScrollSection.tsx`
- Modify: `src/lib/tauri.ts`
- Modify: `src/routes/Settings.tsx` (or where sections compose)

- [ ] **Step 1: Update AppSettings TS type**

In `src/lib/tauri.ts`, add:

```typescript
edge_scroll_enabled: boolean;
edge_scroll_zone_px: number;
edge_scroll_max_notches_per_sec: number;
edge_scroll_modifier_required: boolean;
edge_scroll_modifier: string;
```

- [ ] **Step 2: Create section**

Create `src/components/settings/EdgeScrollSection.tsx`:

```tsx
import { useSettingsStore } from "@/stores/settingsStore";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function EdgeScrollSection() {
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edge auto-scroll</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Enable edge auto-scroll</Label>
          <Switch
            checked={settings.edge_scroll_enabled}
            onCheckedChange={(v) => patch({ edge_scroll_enabled: v })}
          />
        </div>
        <div>
          <Label>Zone size: {settings.edge_scroll_zone_px}px</Label>
          <Slider
            min={10} max={200} step={5}
            value={[settings.edge_scroll_zone_px]}
            onValueChange={([v]) => patch({ edge_scroll_zone_px: v })}
            disabled={!settings.edge_scroll_enabled}
          />
        </div>
        <div>
          <Label>Max speed: {settings.edge_scroll_max_notches_per_sec.toFixed(1)} notches/s</Label>
          <Slider
            min={0.5} max={20} step={0.5}
            value={[settings.edge_scroll_max_notches_per_sec]}
            onValueChange={([v]) => patch({ edge_scroll_max_notches_per_sec: v })}
            disabled={!settings.edge_scroll_enabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Register in Settings tab**

In `src/routes/Settings.tsx`, in the appropriate tab content:

```tsx
<EdgeScrollSection />
```

- [ ] **Step 4: TS compile + dev**

```bash
npx tsc --noEmit && npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/EdgeScrollSection.tsx src/lib/tauri.ts src/routes/Settings.tsx
git commit -m "feat(ui): edge-scroll settings section"
```

---

## Task 8: Final smoke + build

- [ ] **Step 1: Build installer**

```bash
cargo tauri build
```

Expected: SUCCESS.

- [ ] **Step 2: Manual smoke**

Install + run on long Wikipedia article:
- [ ] Toggle ON → cursor at bottom 40px → continuous smooth scroll down.
- [ ] Cursor away from edge → scroll stops.
- [ ] Top edge → scroll up.
- [ ] Reduce max speed → scroll slower.
- [ ] Toggle OFF → no auto-scroll.

- [ ] **Step 3: Commit fixes**

```bash
git add -A && git commit -m "chore: P5 final fixes" --allow-empty
```

---

## Self-Review Checklist

- [x] Spec section 3 velocity formula → Task 2
- [x] Spec section 4 polling loop → Task 6
- [x] Spec section 6 schema → Task 1
- [x] Spec section 9 testing → Tasks 2 + 8

**Note:** Modifier-required gating is deferred — full keyboard modifier check requires reusing the keyboard sampler from P4. UI toggle exists but has no backend effect until P4 lands. Tracked as out-of-scope for this plan.
