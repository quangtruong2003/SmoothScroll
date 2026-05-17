# SmoothScroll P7 — Precision Touchpad Smoothing Spec

**Date:** 2026-05-17
**Status:** Draft, awaiting user review
**Target:** Windows .exe (Precision Touchpad APIs); macOS later
**Effort:** L (2+ weeks)

## 1. Goal

Smooth scrolling cho Windows Precision Touchpad gestures. Hiện tại touchpad scroll **bypass** mouse hook hiện có vì:

- Touchpad không emit `WM_MOUSEWHEEL` directly trong nhiều case.
- Windows generates "high-precision" wheel events với `mouseData` rất nhỏ (vd 5-30) thay vì standard 120 increments.
- App như Chrome/Edge xử lý raw touchpad events qua DirectManipulation / Pointer events — bypass hook.

Tác động: hàng triệu laptop user **không hưởng** smooth scroll khi dùng touchpad. Đây là **largest TAM** trong roadmap.

## 2. Why this is L-effort

3 architectural challenges:

### 2.1 Multiple input sources

Windows touchpad có 3 modes:
1. **Legacy mode**: emits `WM_MOUSEWHEEL` (works với hook hiện tại, but not "precision").
2. **Precision Touchpad** (Win10+): emits `WM_MOUSEWHEEL` với `mouseData` non-multiple-of-120, signal high-frequency. Hook nhận được nhưng `delta = 30` → engine scaling sai.
3. **Direct Manipulation**: app tự subscribe via `IDirectManipulationManager`. Hook không thấy. Examples: Edge, modern UWP apps.

Phase 1 (this spec): handle case #2 properly. Case #3 cần nghiên cứu thêm — out of scope.

### 2.2 Engine assumes notch-based input

`engine.rs::Axis::register_notch()`:
```rust
let notches = delta as f64 / WHEEL_DELTA as f64;  // delta=30 → notches=0.25
let pixels = notches * settings.step_size_px as f64 * self.accel_factor as f64;
```

Cho touchpad delta=30, ta lấy 0.25 × 120px = 30px. **Nhưng** với touchpad, mỗi delta=30 là **đã là** ~30px hardware-mapped. Ta đang double-multiply.

Fix: detect "high-frequency low-delta" sequence → đối xử như continuous scroll, bypass acceleration.

### 2.3 Acceleration tuned for wheel notches

Acceleration logic dồn 100ms+ giữa các wheel events có lý vì wheel = discrete clicks. Touchpad emit 50+ events/sec → mỗi event đều "fast" → acceleration gấp lên = scroll nhảy đại.

Fix: detect input source → áp dụng different acceleration profile.

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Platform (crates/platform/src/windows/)                 │
│  - mouse_hook.rs:                              [EDIT]    │
│      Distinguish wheel events:                            │
│      - "wheel" — delta multiple of WHEEL_DELTA            │
│      - "touchpad" — non-multiple, sub-120                 │
│      - "high-res wheel" — Logitech, etc.                  │
│  - input_source.rs                             [NEW]     │
│      InputSource enum + classify_event(delta) →          │
│        InputSource based on delta + recent history       │
├──────────────────────────────────────────────────────────┤
│  Core (crates/core/src/)                                 │
│  - engine.rs:                                  [EDIT]    │
│      on_wheel(delta, now_ms, source: InputSource)        │
│      Axis::register_notch dispatches based on source     │
│      New code path: register_pixels(px, now_ms) for      │
│        touchpad/high-res — bypasses notch math           │
│  - settings.rs:                                [EDIT]    │
│      touchpad_smoothing_enabled: bool (default: true)    │
│      touchpad_acceleration_factor: f64 (default: 1.0)    │
│      touchpad_pixel_multiplier: f64 (default: 1.0)       │
├──────────────────────────────────────────────────────────┤
│  Tauri (src-tauri/src/hook_wiring.rs)         [EDIT]    │
│  - HookEventSink::on_wheel signature includes source     │
│  - traits.rs: ModifierKeys → renamed to ScrollEventCtx { │
│      mods: ModifierKeys,                                  │
│      source: InputSource,                                │
│    }                                                      │
├──────────────────────────────────────────────────────────┤
│  React UI                                                │
│  - components/settings/TouchpadSection.tsx     [NEW]     │
│      master toggle                                        │
│      slider: pixel multiplier (0.5x - 2x)                │
│      slider: acceleration factor (0 - 2x)                │
│      live indicator: detected input source 💻🖱️          │
└──────────────────────────────────────────────────────────┘
```

## 4. InputSource classification

```rust
pub enum InputSource {
    /// Standard mouse wheel: delta = ±120, ±240, ...
    Wheel,
    /// High-resolution wheel (Logitech MX Master, etc.):
    /// delta = small fractions of 120, but events spaced like wheel.
    HighResWheel,
    /// Precision touchpad: high-frequency, sub-120 deltas.
    Touchpad,
}

pub struct InputClassifier {
    recent: VecDeque<(u64, i32)>,  // (timestamp_ms, delta)
}

impl InputClassifier {
    pub fn classify(&mut self, delta: i32, now_ms: u64) -> InputSource {
        // Push event, drop > 200ms old
        self.recent.push_back((now_ms, delta));
        while let Some(&(t, _)) = self.recent.front() {
            if now_ms - t > 200 { self.recent.pop_front(); } else { break; }
        }

        let abs_delta = delta.unsigned_abs();
        let event_count = self.recent.len();

        // > 5 events in 200ms = touchpad
        if event_count > 5 && abs_delta < 120 {
            return InputSource::Touchpad;
        }
        // sub-120 but spaced wheel-like = high-res wheel
        if abs_delta < 120 && abs_delta > 0 {
            return InputSource::HighResWheel;
        }
        InputSource::Wheel
    }
}
```

## 5. Engine pixel-mode

`Axis::register_pixels`:

```rust
fn register_pixels(&mut self, px: f64, now_ms: u64, settings: &AppSettings) {
    // Skip acceleration entirely for pixel input.
    self.last_notch_ms = now_ms;
    self.accel_factor = 1;
    self.remaining_px += px * settings.touchpad_pixel_multiplier;
}
```

In `engine.on_wheel`:
```rust
match source {
    InputSource::Wheel => self.v.register_notch(now_ms, delta * dir, &self.settings),
    InputSource::Touchpad => {
        let px = (delta as f64 / WHEEL_DELTA as f64) * BASE_STEP_PX;  // hardware px
        self.v.register_pixels(px * dir as f64, now_ms, &self.settings)
    },
    InputSource::HighResWheel => {
        // Apply notch math, but with reduced acceleration ramp
        self.v.register_high_res_notch(now_ms, delta * dir, &self.settings)
    },
}
```

## 6. Backward compat for hook trait

`HookEventSink::on_wheel` signature đổi → breaking change cho trait users. Mitigation:
- Default impl: `on_wheel(delta, mods)` calls `on_wheel_ext(delta, mods, InputSource::Wheel)`.
- Existing tests vẫn work.

## 7. Settings JSON schema

```json
{
  "...": "...",
  "touchpad_smoothing_enabled": true,
  "touchpad_pixel_multiplier": 1.0,
  "touchpad_acceleration_factor": 1.0
}
```

Backward compat via `#[serde(default)]`.

## 8. New IPC commands + events

| | Purpose |
|---|---|
| Event `input-source-changed` | UI shows live indicator |

## 9. Migration / risk

- **High risk: existing wheel users.** Misclassifying high-res wheel as touchpad → wrong scroll. Mitigation: A/B test internally, ship behind opt-in flag for first release.
- **Trait breaking change:** wide blast radius — `EngineSink`, all hook tests, macOS sink. Use default-method approach to avoid mass breakage.
- **DirectManipulation apps unsolved:** Chrome scroll vẫn không được smooth. Document trong README.
- **Calibration:** every touchpad model emits different delta scales. `touchpad_pixel_multiplier` slider lets user calibrate.
- **macOS:** entirely different (CGEventTap với pixel deltas as standard). Stub for now; revisit when macOS support resurrects.

## 10. Testing

| Layer | Test |
|---|---|
| Core | `InputClassifier` detects 6 events in 200ms with delta=30 as Touchpad |
| Core | Single delta=120 event → Wheel |
| Core | High-frequency delta=120 → still Wheel (count not enough alone) |
| Core | `register_pixels` does not accelerate (factor stays 1) |
| Core | `register_pixels` respects `touchpad_pixel_multiplier` |
| Engine integration | Touchpad delta sequence → reasonable px output (~1px per delta unit) |
| Manual | Use precision touchpad in long article → smooth like Mac |
| Manual | Use mouse wheel → unchanged behavior |
| Manual | Logitech MX Master high-res mode → smooth, no over-acceleration |

## 11. Out of scope

- DirectManipulation API integration (Chrome/Edge inline)
- macOS port
- Pinch-to-zoom on touchpad
- 3-finger gestures
- Inertia/momentum scrolling like macOS (separate spec)
- Per-device profiles

## 12. Build verification

```bash
cargo test -p smoothscroll_core
cargo test -p smoothscroll_platform
cargo tauri build
```

Smoke:
- [ ] Surface laptop touchpad scroll → smooth, no staircase, no acceleration.
- [ ] Logitech MX Master scroll → smooth, predictable speed.
- [ ] Standard mouse scroll → unchanged from v0.3.0.
- [ ] Live indicator changes from 🖱️ → 💻 when switching input device.
- [ ] Multiplier slider doubles touchpad scroll speed.
