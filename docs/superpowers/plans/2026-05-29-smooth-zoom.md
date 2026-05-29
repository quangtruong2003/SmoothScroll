# Smooth Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement smooth zoom (Ctrl+Wheel) with animation easing, inversion support, and per-app settings. Default ON. UX is primary concern.

**Architecture:** Ctrl+Wheel routes to a new `ZoomAxis` inside the existing `SmoothScrollEngine`. The axis uses identical accumulation/easing logic to scroll. Output is emitted via `emit_zoom(units)` → `PostMessageW(WM_MOUSEWHEEL, MK_CONTROL | mouseData)`. Shift held during Ctrl+Wheel inverts zoom direction.

**Tech Stack:** Rust (core + platform crates), Tauri, TypeScript/React settings UI

---

## File Map

| File | Change |
|------|--------|
| `crates/core/src/settings.rs` | Add `smooth_zoom`, `zoom_invert`, `zoom_sensitivity` to AppSettings + EffectiveSettings |
| `crates/core/src/engine.rs` | Add `ZoomAxis`, update `EngineOutput`, routing in `on_wheel_with_source`, `step`, `reset_axes`, `has_pending_work` |
| `crates/platform/src/traits.rs` | Add `ZoomEmitter` trait |
| `crates/platform/src/windows/wheel_emitter.rs` | Implement `emit_zoom()` using PostMessageW + MK_CONTROL, with SendInput fallback |
| `src-tauri/src/state.rs` | Add `zoom_emitter: Arc<dyn ZoomEmitter>` to AppState |
| `src-tauri/src/lib.rs` | Wire `zoom_emitter` into AppState |
| `src-tauri/src/hook_wiring.rs` | Route Ctrl+Wheel → ZoomAxis; update tests |
| `src-tauri/src/engine_thread.rs` | Emit zoom via `state.zoom_emitter.emit_zoom()` |
| `src/components/settings/SmoothnessSection.tsx` | Add Smooth Zoom toggle + Zoom Invert toggle |
| `src/i18n/locales/en.json` | Add `smooth_zoom`, `zoom_invert` strings |
| `src/i18n/locales/vi.json` + 12 other files | Add translations |

---

## Task 1: Engine — Settings

**Files:** `crates/core/src/settings.rs`

- [ ] **Step 1: Add zoom fields to AppSettings**

Find the `AppSettings` struct (~line 145). Add after `modifier_passthrough`:

```rust
// Zoom
pub smooth_zoom: bool,
pub zoom_invert: bool,
pub zoom_sensitivity: f64,
```

- [ ] **Step 2: Add default values in AppSettings::default()**

In the `default()` implementation (~line 210), add:

```rust
smooth_zoom: true,
zoom_invert: false,
zoom_sensitivity: 1.0,
```

- [ ] **Step 3: Add clamp in AppSettings::clamp()**

Add after `touchpad_acceleration_factor` clamp:

```rust
self.zoom_sensitivity = self.zoom_sensitivity.clamp(0.25, 4.0);
```

- [ ] **Step 4: Add zoom fields to EffectiveSettings**

In `EffectiveSettings` (~line 376), add:

```rust
pub smooth_zoom: bool,
pub zoom_invert: bool,
pub zoom_sensitivity: f64,
```

- [ ] **Step 5: Populate EffectiveSettings in from_settings() and with_profile()**

In both `from_settings()` (~line 398) and `with_profile()` (~line 421), add:

```rust
smooth_zoom: s.smooth_zoom,
zoom_invert: s.zoom_invert,
zoom_sensitivity: s.zoom_sensitivity,
```

- [ ] **Step 6: Change modifier_ctrl_passthrough default to FALSE**

In `ModifierPassthrough` struct (~line 116), change `ctrl` serde default:

```rust
#[serde(default = "default_false")]
pub ctrl: bool,
```

And add:

```rust
fn default_false() -> bool {
    false
}
```

Update `Default for ModifierPassthrough`:

```rust
impl Default for ModifierPassthrough {
    fn default() -> Self {
        Self {
            ctrl: false, // changed: smooth zoom ON by default
            alt: true,
            clear_inertia_on_press: true,
        }
    }
}
```

- [ ] **Step 7: Commit**

```bash
git add crates/core/src/settings.rs
git commit -m "feat(core): add smooth_zoom settings fields"
```

---

## Task 2: Engine — Core Logic

**Files:** `crates/core/src/engine.rs`

- [ ] **Step 1: Update EngineOutput**

Change from:

```rust
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct EngineOutput {
    pub vertical: i32,
    pub horizontal: i32,
}
```

To:

```rust
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct EngineOutput {
    pub vertical: i32,
    pub horizontal: i32,
    pub zoom: i32,
}
```

- [ ] **Step 2: Add ZoomAxis type alias**

Add after the `Axis` struct and impl block (~line 104):

```rust
// ZoomAxis is identical to Axis — same accumulation, easing, step logic.
// Only difference is output routing (zoom channel vs scroll).
type ZoomAxis = Axis;
```

- [ ] **Step 3: Add `z: ZoomAxis` to SmoothScrollEngine**

Change:

```rust
#[derive(Debug)]
pub struct SmoothScrollEngine {
    v: Axis,
    h: Axis,
    z: ZoomAxis,
}
```

- [ ] **Step 4: Update SmoothScrollEngine::new()**

```rust
pub fn new() -> Self {
    Self {
        v: Axis::default(),
        h: Axis::default(),
        z: ZoomAxis::default(),
    }
}
```

- [ ] **Step 5: Update on_wheel_with_source to route Ctrl+Wheel to ZoomAxis**

Change the routing logic in `on_wheel_with_source` (~line 120). The current function body routes everything to `self.v`. We need to add Ctrl detection.

The current routing:
```rust
if mods.shift && eff.horizontal_smoothness {
    let h_delta = if eff.horizontal_invert { -delta } else { delta };
    engine.on_hwheel_with_source(h_delta, now, source, &eff);
} else if mods.shift {
    return HookDecision::Pass;
} else {
    engine.on_wheel_with_source(delta, now, source, &eff);
}
```

Replace with:

```rust
let ctrl_pressed = cfg_if::cfg_if! {
    #[cfg(target_os = "macos")] { mods.cmd }
    #[cfg(not(target_os = "macos"))] { mods.ctrl }
};

if ctrl_pressed && eff.smooth_zoom {
    let dir = if (mods.shift && eff.zoom_invert) || (!mods.shift && eff.reverse_wheel_direction) {
        -1
    } else {
        1
    };
    // Apply zoom_sensitivity: >1.0 = faster zoom, <1.0 = slower
    let sensitivity = eff.zoom_sensitivity.clamp(0.25, 4.0);
    let scaled_delta = ((delta as f64) * sensitivity) as i32;
    self.z.register_notch(now, scaled_delta * dir, settings);
} else if mods.shift && eff.horizontal_smoothness {
    let h_delta = if eff.horizontal_invert { -delta } else { delta };
    self.on_hwheel_with_source(h_delta, now, source, settings);
} else if mods.shift {
    return HookDecision::Pass;
} else {
    self.v.register_notch(now, delta, settings);
}
```

Note: Remove the `let dir = ... reverse_wheel_direction` block at the top of the function — we now handle direction per-axis inside the routing branches.

- [ ] **Step 6: Update step() to include zoom output**

Change `step()` (~line 178). Replace the function body:

```rust
pub fn step(&mut self, dt_ms: f64, settings: &EffectiveSettings) -> EngineOutput {
    if settings.instant_mode {
        let v = self.v.flush_instant();
        let h = if settings.horizontal_smoothness {
            self.h.flush_instant()
        } else {
            0
        };
        return EngineOutput {
            vertical: v,
            horizontal: h,
            zoom: 0,
        };
    }
    let v = self.v.step(dt_ms, settings);
    let h = if settings.horizontal_smoothness {
        self.h.step(dt_ms, settings)
    } else {
        0
    };
    let z = if settings.smooth_zoom {
        self.z.step(dt_ms, settings)
    } else {
        0
    };
    EngineOutput {
        vertical: v,
        horizontal: h,
        zoom: z,
    }
}
```

- [ ] **Step 7: Update has_pending_work() to include zoom**

```rust
pub fn has_pending_work(&self) -> bool {
    self.v.remaining_px.abs() >= 0.1
        || self.h.remaining_px.abs() >= 0.1
        || self.z.remaining_px.abs() >= 0.1
}
```

- [ ] **Step 8: Update reset_axes() to include zoom**

```rust
pub fn reset_axes(&mut self) {
    self.v.remaining_px = 0.0;
    self.v.unit_accum = 0.0;
    self.h.remaining_px = 0.0;
    self.h.unit_accum = 0.0;
    self.z.remaining_px = 0.0;
    self.z.unit_accum = 0.0;
}
```

- [ ] **Step 9: Commit**

```bash
git add crates/core/src/engine.rs
git commit -m "feat(core): add ZoomAxis to SmoothScrollEngine with routing logic"
```

---

## Task 3: Platform — ZoomEmitter Trait

**Files:** `crates/platform/src/traits.rs`

- [ ] **Step 1: Add ZoomEmitter trait**

Add after the `WheelEmitter` trait (~line 50):

```rust
/// Emits synthetic zoom events (Ctrl+Wheel).
pub trait ZoomEmitter: Send + Sync {
    fn emit_zoom(&self, units: i32) -> Result<()>;
}
```

- [ ] **Step 2: Commit**

```bash
git add crates/platform/src/traits.rs
git commit -m "feat(platform): add ZoomEmitter trait"
```

---

## Task 4: Platform — Windows Implementation

**Files:** `crates/platform/src/windows/wheel_emitter.rs`

- [ ] **Step 1: Import ZoomEmitter trait and new Windows API**

Change the imports from:

```rust
use crate::traits::WheelEmitter;
```

To:

```rust
use crate::traits::{WheelEmitter, ZoomEmitter};
```

Add to `windows_sys::Win32::UI::WindowsAndMessaging` import:

`VK_CONTROL` and `KEYBDINPUT`, `KEYBD_EVENT_FLAGS`, `KEYEVENTF_KEYUP`, `INPUT_KEYBOARD`.

Actually, check what the emitter file already imports. We need `SendInput`, `INPUT`, `INPUT_0`, `INPUT_KEYBOARD`, `KEYBDINPUT`, `KEYEVENTF_KEYUP`, `VK_CONTROL`.

Add to the import block:

```rust
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYEVENTF_KEYUP,
    KEYBD_EVENT_FLAGS, MOUSEINPUT, MOUSEEVENTF_WHEEL, VK_CONTROL,
};
```

And add `GetAsyncKeyState` to Foundation import:

```rust
use windows_sys::Win32::Foundation::{GetAsyncKeyState, GetLastError, POINT};
```

- [ ] **Step 2: Implement ZoomEmitter for WindowsWheelEmitter**

Add after the `WheelEmitter` impl block (~line 36):

```rust
impl ZoomEmitter for WindowsWheelEmitter {
    fn emit_zoom(&self, units: i32) -> Result<()> {
        if units == 0 {
            return Ok(());
        }

        // Try PostMessageW first (most compatible with design apps like Figma)
        if let Ok(()) = emit_zoom_via_post_message(units) {
            return Ok(());
        }

        // Fallback: SendInput sequence — Ctrl down → Wheel → Ctrl up
        emit_zoom_via_send_input(units)
    }
}
```

- [ ] **Step 3: Add emit_zoom_via_post_message function**

Add after `emit_horizontal` (~line 80):

```rust
const MK_CONTROL: usize = 0x0008;

fn emit_zoom_via_post_message(units: i32) -> Result<()> {
    unsafe {
        let mut pt = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut pt) == 0 {
            return Err(PlatformError::Os("GetCursorPos failed".into()));
        }

        let hwnd = WindowFromPoint(pt);
        if hwnd.is_null() {
            return Err(PlatformError::Os("WindowFromPoint returned null".into()));
        }

        let root = GetAncestor(hwnd, GA_ROOT);
        let target = if !root.is_null() { root } else { hwnd };

        // units is already in wheel units; encode as signed 16-bit in mouseData
        let mouse_data = ((units as u32) << 16) as usize;
        let w_param = MK_CONTROL | mouse_data;
        let l_param = ((pt.y as usize) << 16) | (pt.x as usize & 0xFFFF);

        if PostMessageW(target, WM_MOUSEWHEEL, w_param as _, l_param as _) == 0 {
            return Err(PlatformError::Os(format!(
                "PostMessageW failed with error {}",
                GetLastError()
            )));
        }
        Ok(())
    }
}
```

- [ ] **Step 4: Add emit_zoom_via_send_input fallback**

Add after `emit_zoom_via_post_message`:

```rust
fn emit_zoom_via_send_input(units: i32) -> Result<()> {
    // Fallback: Ctrl keydown → Wheel → Ctrl keyup via SendInput
    unsafe {
        let cb = mem::size_of::<INPUT>() as i32;

        // Ctrl down
        let ctrl_down = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_CONTROL as u16,
                    wScan: 0,
                    dwFlags: KEYBD_EVENT_FLAGS(0),
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };

        // Wheel
        let wheel = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: units as u32,
                    dwFlags: MOUSEEVENTF_WHEEL,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };

        // Ctrl up
        let ctrl_up = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_CONTROL as u16,
                    wScan: 0,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };

        let inputs = [ctrl_down, wheel, ctrl_up];
        let sent = SendInput(3, inputs.as_ptr(), cb);
        if sent != 3 {
            return Err(PlatformError::Os(format!(
                "SendInput injected {}/3 events for zoom",
                sent
            )));
        }
        Ok(())
    }
}
```

Note: The `emit_zoom` function in `impl ZoomEmitter` should NOT return the `Err` from `emit_zoom_via_post_message` if it fails — it should try the fallback. Use `if let Ok(())` pattern.

- [ ] **Step 5: Commit**

```bash
git add crates/platform/src/windows/wheel_emitter.rs
git commit -m "feat(platform): implement ZoomEmitter for Windows via PostMessageW+MK_CONTROL"
```

---

## Task 5: State — Wire ZoomEmitter

**Files:** `src-tauri/src/state.rs`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Add zoom_emitter to AppState**

In `state.rs`, change the import:

```rust
use smoothscroll_platform::traits::{
    Autostart, FullscreenDetector, Hotkey, HotkeyHandle, MouseHook,
    ProcessQuery, WheelEmitter, ZoomEmitter, WindowGeometry,
};
```

Add to `AppState` struct (~line 30):

```rust
pub zoom_emitter: Arc<dyn ZoomEmitter>,
```

- [ ] **Step 2: Wire in lib.rs**

In `lib.rs`, find where `AppState` is constructed (~line 69). Add `zoom_emitter: platform.wheel_emitter.clone()`.

Wait — the platform only exposes `wheel_emitter`. We need to add `zoom_emitter` to the platform interface. 

Actually, `WindowsWheelEmitter` implements BOTH `WheelEmitter` AND `ZoomEmitter`. So we can just clone the same `Arc` and use it as both types. The `Arc<dyn WheelEmitter>` can be `Arc<dyn ZoomEmitter>` too.

In `lib.rs`, add after the `emitter` field in AppState construction:

```rust
zoom_emitter: platform.wheel_emitter.clone(),
```

And update the `use` statement to import `ZoomEmitter`:

```rust
use smoothscroll_platform::traits::{
    Autostart, FullscreenDetector, Hotkey, HotkeyHandle, MouseHook,
    ProcessQuery, WheelEmitter, ZoomEmitter, WindowGeometry,
};
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat(app): wire ZoomEmitter into AppState"
```

---

## Task 6: Engine Thread — Emit Zoom

**Files:** `src-tauri/src/engine_thread.rs`

- [ ] **Step 1: Update wheel emit to also emit zoom**

Change the emission block (~line 81):

```rust
let output = state.engine.lock().step(dt_ms, &eff);
if output.vertical != 0 || output.horizontal != 0 {
    if let Err(e) = state.emitter.emit(output.vertical, output.horizontal) {
        tracing::warn!(error = %e, "wheel emit failed");
    }
}
if output.zoom != 0 {
    if let Err(e) = state.zoom_emitter.emit_zoom(output.zoom) {
        tracing::warn!(error = %e, "zoom emit failed");
    }
}
```

- [ ] **Step 2: Update has_pending_work check in engine thread**

The `has_pending_work` check in the engine thread loop (~line 61) calls `state.engine.lock().has_pending_work()` — this now includes zoom. No code change needed.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/engine_thread.rs
git commit -m "feat(app): emit zoom events from engine thread"
```

---

## Task 7: Hook Wiring — Route Ctrl+Wheel

**Files:** `src-tauri/src/hook_wiring.rs`

- [ ] **Step 1: The routing is already in the engine (Task 2, Step 5)**

The `on_wheel_with_source` in the engine now handles Ctrl routing internally. The hook wiring doesn't need to change — it just calls `engine.on_wheel_with_source()` which routes correctly.

BUT we need to update the test stubs. Find `StubEmitter` in the tests (~line 324):

```rust
struct StubEmitter;
impl WheelEmitter for StubEmitter {
    fn emit(&self, _v: i32, _h: i32) -> Result<()> {
        Ok(())
    }
}
```

We need to also implement `ZoomEmitter` for `StubEmitter`:

```rust
impl ZoomEmitter for StubEmitter {
    fn emit_zoom(&self, _units: i32) -> Result<()> {
        Ok(())
    }
}
```

Add to the import at the top of the test module:

```rust
use smoothscroll_platform::traits::{
    Autostart, FullscreenDetector, HookEventSink, HookHandle, Hotkey, HotkeyHandle,
    MouseHook, ProcessQuery, WheelEmitter, ZoomEmitter, WindowGeometry,
};
```

- [ ] **Step 2: Update drain_engine helper to handle zoom**

The `drain_engine` test helper (~line 471) currently ignores zoom. Update it:

```rust
fn drain_engine(state: &Arc<AppState>) -> (i32, i32) {
    let eff = state.effective.load_full();
    let mut v = 0;
    let mut h = 0;
    for _ in 0..500 {
        let out = state.engine.lock().step(1000.0 / 120.0, &eff);
        v += out.vertical;
        h += out.horizontal;
        // zoom is emitted but not counted in this test helper
        if !state.engine.lock().has_pending_work() {
            break;
        }
    }
    (v, h)
}
```

- [ ] **Step 3: Update tests that rely on modifier_ctrl_passthrough=true**

The test `ctrl_wheel_passes_through_when_passthrough_enabled` (~line 655) still works — Ctrl+Wheel passes through when `modifier_passthrough.ctrl = true`.

The test `ctrl_wheel_smooths_when_passthrough_disabled` (~line 669) now needs to check that zoom is produced instead of vertical scroll. Update it:

```rust
#[test]
fn ctrl_wheel_smooths_when_passthrough_disabled() {
    let mut s = AppSettings::default();
    s.modifier_passthrough.ctrl = false;
    let state = make_state(s);
    let sink = EngineSink::new(state.clone());
    let mods = ModifierKeys {
        shift: false,
        ctrl: true,
        alt: false,
        cmd: false,
    };
    assert_eq!(sink.on_wheel(120, mods), HookDecision::Swallow);

    // Drain engine and verify zoom output (not vertical)
    let eff = state.effective.load_full();
    let mut zoom_total = 0i32;
    for _ in 0..500 {
        let out = state.engine.lock().step(1000.0 / 120.0, &eff);
        zoom_total += out.zoom;
        if !state.engine.lock().has_pending_work() {
            break;
        }
    }
    assert!(zoom_total != 0, "expected zoom emission, got 0");
    assert_eq!(state.engine.lock().step(1000.0 / 120.0, &eff).vertical, 0,
        "zoom should not produce vertical output");
}
```

- [ ] **Step 4: Add test for zoom inversion via Shift**

Add new test after `ctrl_wheel_smooths_when_passthrough_disabled`:

```rust
#[test]
fn ctrl_shift_wheel_zoom_inverts_when_setting_on() {
    let mut s = AppSettings::default();
    s.modifier_passthrough.ctrl = false;
    s.zoom_invert = true;
    let state = make_state(s);
    let sink = EngineSink::new(state.clone());
    let mods = ModifierKeys {
        shift: true,
        ctrl: true,
        alt: false,
        cmd: false,
    };
    sink.on_wheel(120, mods);

    let eff = state.effective.load_full();
    let mut zoom_total = 0i32;
    for _ in 0..500 {
        let out = state.engine.lock().step(1000.0 / 120.0, &eff);
        zoom_total += out.zoom;
        if !state.engine.lock().has_pending_work() {
            break;
        }
    }
    assert!(zoom_total < 0, "zoom_invert=true should make zoom negative");
}
```

- [ ] **Step 5: Update make_state and make_state_with_process test helpers**

Add `zoom_emitter: Arc::new(StubEmitter)` to both helper functions (~line 395 and ~line 436).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/hook_wiring.rs
git commit -m "test(hook_wiring): add zoom routing tests and update stubs"
```

---

## Task 8: UI — Settings Components

**Files:** `src/components/settings/SmoothnessSection.tsx`, `src/i18n/locales/*.json`

- [ ] **Step 1: Add locale strings**

In `src/i18n/locales/en.json`, add under `settings`:

```json
"smooth_zoom": {
  "title": "Smooth zoom",
  "desc": "Apply smoothing to Ctrl+Wheel zoom in design apps"
},
"zoom_invert": {
  "title": "Invert zoom direction",
  "desc": "Scroll up to zoom out"
},
```

Add the same keys (with translations) to all 13 other locale files:
- `vi.json` — smooth_zoom: "Zoom mượt", zoom_invert: "Đảo chiều zoom"
- `zh.json` — smooth_zoom: "平滑缩放", zoom_invert: "反转缩放方向"
- `ja.json` — smooth_zoom: "スムーズズーム", zoom_invert: "ズーム方向を反転"
- `de.json` — smooth_zoom: "Sanftes Zoomen", zoom_invert: "Zoomrichtung umkehren"
- `fr.json` — smooth_zoom: "Zoom fluide", zoom_invert: "Inverser le sens du zoom"
- `es.json` — smooth_zoom: "Zoom suave", zoom_invert: "Invertir dirección del zoom"
- `it.json` — smooth_zoom: "Zoom fluido", zoom_invert: "Inverti direzione zoom"
- `ko.json` — smooth_zoom: "부드러운 줌", zoom_invert: "줌 방향 반전"
- `ru.json` — smooth_zoom: "Плавное масштабирование", zoom_invert: "Инвертировать направление зума"
- `pt-BR.json` — smooth_zoom: "Zoom suave", zoom_invert: "Inverter direção do zoom"
- `tr.json` — smooth_zoom: "Duyarlı yakınlaştırma", zoom_invert: "Yakınlaştırma yönünü tersine çevir"
- `hi.json` — smooth_zoom: "स्मूथ ज़ूम", zoom_invert: "ज़ूम दिशा उलटें"
- `id.json` — smooth_zoom: "Zoom halus", zoom_invert: "Balik arah zoom"

- [ ] **Step 2: Add SmoothZoomSection component**

Create `src/components/settings/SmoothZoomSection.tsx`:

```tsx
import { useSettingsStore } from '~/stores/settingsStore';
import { Toggle } from '~/components/ui/toggle';
import { useTranslation } from 'react-i18next';

export function SmoothZoomSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="space-y-4">
      <Toggle
        label={t('settings.smooth_zoom.title')}
        description={t('settings.smooth_zoom.desc')}
        checked={settings.smooth_zoom}
        onChange={(checked) =>
          updateSettings({ smooth_zoom: checked })
        }
      />

      {settings.smooth_zoom && (
        <Toggle
          label={t('settings.zoom_invert.title')}
          description={t('settings.zoom_invert.desc')}
          checked={settings.zoom_invert}
          onChange={(checked) =>
            updateSettings({ zoom_invert: checked })
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into Settings page**

In `src/routes/Settings.tsx`, import and add `<SmoothZoomSection />` in the settings layout, likely in the Smoothness section or as its own section.

- [ ] **Step 4: Add to settingsStore if needed**

Check `src/stores/settingsStore.ts` — if `smooth_zoom` and `zoom_invert` fields aren't in the store's settings type, add them.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SmoothZoomSection.tsx src/routes/Settings.tsx src/stores/settingsStore.ts src/i18n/locales/*.json
git commit -m "feat(ui): add smooth zoom settings UI"
```

---

## Task 9: Build & Verify

- [ ] **Step 1: Run Rust tests**

```bash
cd D:/SmoothScroll/src-tauri && cargo test --release
```

Expected: all 19+ tests pass (18 existing + ctrl_wheel_smooths_when_passthrough_disabled + ctrl_shift_wheel_zoom_inverts_when_setting_on)

- [ ] **Step 2: Build WASM**

```bash
cd D:/SmoothScroll && npm run build:wasm
```

- [ ] **Step 3: Build full app**

```bash
cd D:/SmoothScroll/src-tauri && npx tauri build
```

Output: `src-tauri/target/release/bundle/nsis/SmoothScroll_<version>_x64-setup.exe`

- [ ] **Step 4: Hand path to user for testing**
