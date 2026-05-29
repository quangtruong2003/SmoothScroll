# Smooth Zoom — Design Specification

**Date:** 2026-05-29
**Status:** Draft

## Overview

Implement smooth zoom (Ctrl+Wheel) with the same quality bar as smooth scroll: accumulated inertia, animation easing, and direction inversion. UX is the primary concern — zoom must feel native and fluid.

---

## 1. UX Behavior

### Core Behavior

- **Default: ON.** Smooth zoom is enabled out of the box (unlike smooth horizontal scroll which requires opt-in).
- **Ctrl+Wheel anywhere** → smooth zoom kicks in.
- **Shift+Ctrl+Wheel** → zoom direction is inverted (scroll up = zoom out).
- When `modifier_ctrl_passthrough` is `true` → smooth zoom is bypassed and native Ctrl+Wheel is passed through (backward-compatible with existing behavior).

### Settings

- `smooth_zoom` (`bool`, default: `true`) — master toggle for smooth zoom.
- `zoom_invert` (`bool`, default: `false`) — invert zoom direction.
- `modifier_ctrl_passthrough` (`bool`, default: `false`) — pass Ctrl+Wheel through without smoothing (opt-in, default off).
- `zoom_sensitivity` (`f64`, default: `1.0`) — multiplier on zoom speed.
- All zoom settings share the same timing/easing sliders as scroll (no separate animation settings — keep it simple).

### UX Guards

1. **Cross-app compatibility:** Use `PostMessageW` with `WM_MOUSEWHEEL + MK_CONTROL` (same pattern as horizontal scroll's `MK_SHIFT`). This is the most compatible approach across Figma, VS Code, browsers, and design tools.
2. **Passthrough guard:** If the target window doesn't respond to `PostMessageW`, the wheel event falls back to `SendInput + Ctrl key` sequence (CtrlDown → Wheel → CtrlUp). This is a safety net — we try `PostMessageW` first.
3. **Modifier release:** If user releases Ctrl mid-animation, the remaining zoom animates to completion (same as scroll inertia).
4. **No double-work:** When smooth zoom is active, the native Ctrl+Wheel is swallowed. The engine re-emits its own smoothed zoom events.

---

## 2. Architecture

### Data Flow

```
WM_MOUSEWHEEL + GetAsyncKeyState(VK_CONTROL)
    │
    ▼
ModifierSampler.snapshot() detects Ctrl held
    │
    ▼
route_vertical_with_source()
    ├─ Ctrl held + smooth_zoom ON → route to ZoomAxis
    └─ Ctrl held + modifier_ctrl_passthrough ON → HookDecision::Pass
    │
    ▼
ZoomAxis.register_notch() / ZoomAxis.register_pixels()
    │
    ▼
Engine.thread loop: z.step() → EngineOutput { zoom: i32 }
    │
    ▼
emitter.emit_zoom(units)
    │
    ▼
PostMessageW(hwnd, WM_MOUSEWHEEL, MK_CONTROL | mouseData, l_param)
```

### Engine Changes

- `SmoothScrollEngine` gains a `z: ZoomAxis` field.
- `ZoomAxis` is identical to `Axis` — same accumulation, same easing, same step logic. The only difference is the output routing (zoom channel vs scroll channel).
- `EngineOutput` adds `zoom: i32` field.
- `on_wheel_with_source()` routes to `ZoomAxis` when Ctrl is held and `smooth_zoom` is enabled.
- `modifier_ctrl_passthrough` check happens before `smooth_zoom` check (passthrough wins if enabled).

### Emitter Changes

- `WheelEmitter` trait unchanged (still `emit(vertical, horizontal)`).
- Add `ZoomEmitter` trait: `fn emit_zoom(&self, units: i32) -> Result<()>`.
- `WindowsWheelEmitter` implements `emit_zoom()` using `PostMessageW(hwnd, WM_MOUSEWHEEL, MK_CONTROL | mouseData, l_param)`.
- Fallback: `SendInput` with Ctrl key down/up around wheel event.

### Settings Changes

In `EffectiveSettings`:
- `smooth_zoom: bool` — default `true`
- `zoom_invert: bool` — default `false`
- `zoom_sensitivity: f64` — default `1.0`

### Files Changed

| File | Change |
|------|--------|
| `crates/core/src/engine.rs` | Add `ZoomAxis`, update `EngineOutput`, route Ctrl+Wheel |
| `crates/core/src/settings.rs` | Add `smooth_zoom`, `zoom_invert`, `zoom_sensitivity` |
| `crates/core/src/lib.rs` | Re-export new settings fields |
| `crates/platform/src/windows/wheel_emitter.rs` | Add `ZoomEmitter`, `emit_zoom()` |
| `crates/platform/src/traits.rs` | Add `ZoomEmitter` trait |
| `src-tauri/src/hook_wiring.rs` | Route Ctrl+Wheel to engine, wire zoom emitter |
| `src-tauri/src/state.rs` | Add `zoom_emitter: Arc<dyn ZoomEmitter>` |
| `src/i18n/locales/*.json` | Add `smooth_zoom`, `zoom_invert` translations |
| `src/components/settings/` | Add zoom UI section |

---

## 3. Edge Cases

- **Ctrl+Wheel with horizontal wheel present:** Both axes are independent. A mouse with both vertical wheel and tilt wheel sends separate events. Treat them separately.
- **Rapid modifier switching:** If user alternates Ctrl on/off rapidly, each wheel notch is routed to the correct axis. No state confusion.
- **Zoom during inertia:** If Ctrl is released mid-zoom, remaining zoom completes smoothly.
- **App not handling Ctrl+Wheel:** If `PostMessageW` returns 0 (fails), fall back to `SendInput` sequence.
- **Touchpad pinch gesture:** The codebase already distinguishes `Touchpad` input source. Route pinch to `ZoomAxis` with pixel-based accumulation.

---

## 4. Testing

- Unit test: Ctrl+Wheel routes to `ZoomAxis`, not `Axis v`.
- Unit test: `zoom_invert` flips sign of zoom output.
- Unit test: `smooth_zoom=false` → `HookDecision::Pass`.
- Unit test: `modifier_ctrl_passthrough=true` → `HookDecision::Pass` regardless of `smooth_zoom`.
- Integration test: Engine step with Ctrl+Wheel input produces `zoom` output.
- Integration test: `emit_zoom` encodes `MK_CONTROL` flag correctly.

---

## 5. UI Strings

```json
"smooth_zoom": {
  "title": "Smooth zoom",
  "desc": "Apply smoothing to Ctrl+Wheel zoom in design apps"
},
"zoom_invert": {
  "title": "Invert zoom direction",
  "desc": "Scroll up to zoom out"
},
"zoom_sensitivity": {
  "title": "Zoom sensitivity",
  "desc": "Adjust how fast zooming feels"
}
```

All translated to all 14 supported locales.
