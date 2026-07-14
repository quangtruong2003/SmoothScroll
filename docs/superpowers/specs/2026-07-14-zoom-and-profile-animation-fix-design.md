# SmoothScroll — Zoom Speed Easing and Profile Animation Fix

**Date:** 2026-07-14
**Status:** Approved by User
**Target:** Core Engine (`crates/core`), Windows/macOS/Linux hook wiring, React UI
**Effort:** S (≈ 2 days including TDD and rollout)

---

## 1. Goal

Address two critical issues in the engine and UI:

1. **Zoom is abnormally fast**: The Zoom axis (`ZoomAxis`) currently shares the scroll axis logic (`Axis::register_notch`), causing it to inherit the scroll's `step_size_px` and high `acceleration_max` (up to 10x-14x). This scales zoom rates exponentially and makes zooming uncontrollable.
2. **Profile animation-time is ignored (Issue #5)**: The background engine thread (`ss-engine`) uses global active settings (`state.effective`) to step animations on all axes, ignoring the specific profile-defined `animation_time_ms` captured when the wheel events occurred.
3. **ProfileEditor panel clips settings (Issue #5)**: On smaller viewports, the edit dialog clips lower settings like "reverse direction" due to lack of an explicit height constraint on the scrollable container.

Goals:
- **Consistent Zoom Speed**: Zoom should scale strictly based on a fixed baseline step and a capped zoom-specific acceleration (maximum 3.0x). It should ignore the scroll step size.
- **Per-axis easing parameters**: Each `Axis` maintains its own active easing settings captured at event registration time, ensuring correct `animation_time_ms` is honored in the background thread.
- **Scrollable ProfileEditor**: Ensure the editor form scrolls gracefully and does not clip settings on smaller viewports.

---

## 2. Technical Approach

### 2.1 Backend Easing and Zoom Easing (in `crates/core/src/engine.rs`)

1. **Add parameters to `Axis` state**:
   Extend `Axis` struct to capture and carry motion settings between `register` and `step` phases.
   ```rust
   struct Axis {
       remaining_px: f64,
       last_notch_ms: u64,
       pub(crate) velocity: f64,
       unit_accum: f64,
       animation_time_ms: i32,
       easing_mode: EasingMode,
       tail_to_head_ratio: i32,
       animation_easing: bool,
   }
   ```

2. **Explicit `Default` for `Axis`**:
   Replace the derived `Default` with an explicit implementation mirroring system default scroll easing values (220ms, QuinticOut, 5, true).

3. **Capture parameters on registration**:
   Modify `register_notch` and `register_pixels` signatures to receive `&EffectiveSettings` and copy easing parameters into the `Axis` instance fields.

4. **Dedicated Zoom register logic**:
   Implement `Axis::register_zoom_notch(&mut self, now_ms: u64, delta: i32, settings: &EffectiveSettings)`:
   - Sets baseline step size to `BASE_STEP_PX` (144.0) instead of using `settings.step_size_px` to decouple zoom notch count from scroll step size.
   - Restricts the maximum acceleration factor to `3.0` (using `ZOOM_ACCEL_MAX = 3.0`) instead of `settings.acceleration_max`.
   - Captures active easing parameters.

### 2.2 Frontend Clipping (in `src/components/settings/ProfileEditor.tsx`)

Add a strict `max-h` constraint to the form container:
```tsx
<div className="flex-1 overflow-y-auto px-6 max-h-[55vh]">
```
This guarantees the scrollable viewport operates correctly when the container hits the height ceiling.

---

## 3. Testing Strategy

1. **Rust Unit Tests (`crates/core/tests/settings_tests.rs`)**:
   - `zoom_axis_ignores_scroll_step_size`: Verify zoom pulse output is identical when vertical `step_size_px` is 144 vs 300.
   - `zoom_axis_caps_acceleration`: Verify zoom acceleration caps at 3.0x even when vertical `acceleration_max` is 14.
   - `axis_retains_easing_parameters_across_step`: Verify `step` uses the animation time captured at register time rather than the one passed in `step` parameters.

2. **React/Tauri Verification**:
   - Verify `ProfileEditor` scrollable section displays a scrollbar and lets users reach bottom items.
   - Run production-mode build to ensure no TypeScript compilation or linter errors.
