# Native Ctrl+Wheel Zoom Contract — Design Specification

**Date:** 2026-07-15  
**Status:** Approved by UX analysis  
**Release target:** Windows Tauri application  
**Non-Windows release behavior:** Native Ctrl/Command+Wheel passthrough

## 1. Context

GitHub issue #5 originally covered silent disabled-profile assignment and a clipped ProfileEditor. Those defects are already fixed. Validation of the profile work exposed a separate defect: Ctrl+Wheel zoom is near normal for one slow detent but becomes abnormally fast during rapid consecutive input, while vertical and horizontal scrolling remain correct.

The cause is architectural. `ZoomAxis` aliases the scroll `Axis`, and `on_wheel_zoom` calls `Axis::register_notch`. Zoom therefore inherits scroll-only behavior:

- `step_size_px` scales every Ctrl+Wheel packet;
- inter-event timing creates velocity;
- `max_velocity` controls gain saturation;
- `acceleration_max` multiplies rapid input;
- an active app profile silently changes zoom through those shared fields;
- frame easing fragments one input packet into several synthetic packets.

For raw Windows wheel delta `120`, default scroll settings can create about `144` zoom units before acceleration and about `1,440` units at the default 10× ceiling. This matches the reproduction: isolated input is tolerable; rapid input grows superlinearly.

Windows is not processing the physical and synthetic packet twice. The current hook swallows physical input when custom zoom runs, rejects injected `SendInput` feedback, extracts signed delta correctly, and applies `zoom_sensitivity` once. The defect is zoom using scroll-distance semantics.

## 2. UX Decision

Ctrl+Wheel is an input packet that applications commonly interpret as zoom. SmoothScroll must preserve native behavior unless the user explicitly requests a magnitude or direction transform.

### 2.1 User mental model

**Customize Ctrl+Wheel zoom** changes submitted wheel amount or direction. It does not:

- create momentum;
- add acceleration;
- smooth application visuals;
- inherit scroll-profile feel;
- generate input after physical input stops.

The target application may interpret, ignore, coalesce, accelerate, clamp, or animate Ctrl+Wheel input. SmoothScroll guarantees packet submission behavior, not identical visible zoom across every application.

### 2.2 Terms

- **Captured packet:** one physical Ctrl+Wheel callback received by the low-level hook.
- **Native pass:** return `HookDecision::Pass`; Windows routes the original packet.
- **Transform command:** deterministic magnitude/sign calculation for one captured packet plus existing sub-unit residual.
- **Emitted packet:** one synthetic best-effort `WM_MOUSEWHEEL` submission.
- **Transform session:** consecutive transformed packets with the same captured target, sensitivity, inversion, and settings epoch.

### 2.3 Native identity path

When all conditions hold:

- customization is enabled;
- sensitivity is exactly 100%;
- inversion is off;

SmoothScroll returns `HookDecision::Pass`. It does not swallow, repost, round, retarget, or inspect the packet through the zoom engine.

Only this path claims exact native payload, routing, cadence, target selection, coordinates, and modifier handling.

### 2.4 Transformed magnitude

Sensitivity is stored canonically as a 5% step from 25% through 400%. Existing persisted `f64` values are clamped and rounded to the nearest 0.05 during settings normalization. Ties round upward. The normalized value `1.0` is exact and selects identity when inversion is off.

Transform state uses integer percentage/fixed-point arithmetic, not floating-point equality:

```text
numerator = raw_signed_delta × sensitivity_percent × polarity
            + prior_residual_numerator
emitted_delta = truncate_toward_zero(numerator / 100)
next_residual_numerator = numerator - emitted_delta × 100
```

Where:

- `sensitivity_percent` is one of `25, 30, ... 400`;
- `polarity` is `-1` only when explicit inversion is enabled;
- `abs(next_residual_numerator) < 100`.

Within one stable transform session, accepted transformed commands conserve cumulative signed magnitude. Native pass, dispatch rejection, epoch reset, and target transition are separate outcomes and do not participate in that conservation equation.

### 2.5 Rapid input, fractional input, and reversal

Rapid same-direction input remains linear. If each packet transforms to an integral delta, ten identical packets submit ten equal emitted packets. Faster input feels faster only because captured packets arrive more often.

Fractional transforms preserve source order and cumulative magnitude, not one-to-one packet count. A captured packet may emit nothing until residual crosses one wheel unit. Example: four raw `+1` packets at 25% submit one total `+1` packet.

Reversal preserves every materialized packet in source order. Only un-emitted fractional residual may cancel mathematically. There is no animation queue and therefore no stale old-direction tail.

### 2.6 Submission timing

Accepted transformed packets are submitted in captured source order during the same hook callback. SmoothScroll does not coalesce, debounce, retry, frame-gate, animate, or generate packets after the final captured packet.

`PostMessageW` is asynchronous. Normal Windows/application queue latency may deliver an already-submitted final packet after physical input stops. That is not a SmoothScroll-generated tail and is outside SmoothScroll timing control.

## 3. Outcome Contract

Transform state is calculated immutably as a candidate and committed only for accepted transformed outcomes.

| Outcome | Hook decision | Candidate residual | Synthetic packet |
|---|---|---|---|
| Native identity, customization off, passthrough, bypass | `Pass` | Discard/reset | None |
| Transform produces integer zero | `Swallow` | Commit | None |
| Nonzero packet queued successfully | `Swallow` | Commit | One ordinary packet, except legal overflow split |
| Queue rejected while original can still pass | `Pass` | Discard | None accepted |
| Captured target invalid before queue attempt | `Pass` | Discard | None |
| Queue accepted, target later dies | `Swallow` | Commit | Windows owns queued-message fate; no retry/retarget |

Settings commits increment a zoom transform epoch. The next transformed packet resets stale residual before calculating its candidate. Disabling/re-enabling SmoothScroll or customization also changes the epoch even if no wheel input occurs between transitions.

## 4. Settings and Profile Boundaries

### 4.1 Global zoom settings

Keep persisted fields for backward compatibility:

- `smooth_zoom: bool` — UI meaning becomes **Customize Ctrl+Wheel zoom**;
- `zoom_sensitivity: f64` — canonical values `0.25..=4.0` in 0.05 increments; default `1.0`;
- `zoom_invert: bool` — default `false`.

### 4.2 Scroll settings forbidden from zoom

These fields must have zero effect on zoom policy, delta, emitted packet count, or submission timing:

- `step_size_px`;
- `animation_time_ms`;
- `max_velocity`;
- `acceleration_max`;
- `tail_to_head_ratio`;
- `animation_easing`;
- `easing_mode`;
- scroll-direction settings;
- touchpad scroll multiplier/acceleration;
- active `ScrollProfile` and preset.

Zoom remains global. Per-app zoom settings are not added.

### 4.3 Exact native passthrough

Any of these conditions returns the original Ctrl+Wheel packet unchanged:

- SmoothScroll globally disabled;
- customization off;
- Ctrl passthrough on;
- game mode active;
- captured target policy resolves to excluded, disabled, elevated, or native-bypass;
- transformed dispatch cannot be synchronously queued;
- captured target is invalid before queueing;
- platform is not Windows in this release.

No passthrough outcome registers vertical, horizontal, or zoom engine work.

## 5. Captured Windows Event Context

### 5.1 Portable hook event shape

Add a portable captured-wheel structure to the platform boundary:

```text
CapturedWheelEvent
- delta: i32
- modifiers: ModifierKeys
- source: InputSource
- screen_point: Point
- native_target: Option<NativeWindowId>
```

`NativeWindowId` is an opaque integer handle. Windows populates it; unsupported platforms may leave it absent and must return native passthrough for customization in this release.

Migrate every `HookEventSink` implementation and test stub explicitly. A default adapter may preserve existing non-zoom wheel behavior, but it must not silently enable transformed zoom without captured context.

### 5.2 Hook-time target capture

During the Windows low-level callback:

1. read the source `MSLLHOOKSTRUCT.pt`;
2. resolve leaf HWND with `WindowFromPoint(pt)`;
3. resolve root HWND with `GetAncestor(..., GA_ROOT)` for process/policy identity;
4. store both in Windows-specific captured context if needed by implementation;
5. never query cursor or foreground later for this captured Ctrl+Wheel route.

Policy lookup uses the captured root HWND only:

- process identity;
- elevation;
- exclusion/disabled assignment;
- active app profile lookup where still relevant to global bypass policy;
- monitor policy if applicable.

Add HWND-specific process/elevation query methods and cache by captured root HWND, not by later cursor/foreground state.

### 5.3 Transformed target policy

Exact Windows native wheel routing depends on focus, hover-routing OS settings, child controls, mouse capture, owner windows, and application input stack. `PostMessageW` cannot reproduce all of it.

For transformed mode, use this explicit best-effort policy:

- policy identity: captured root HWND;
- emission target: captured leaf HWND under the source point;
- coordinates: captured source screen point;
- inactive windows: still target captured leaf under pointer, matching SmoothScroll’s under-pointer interaction model;
- child controls: post to captured leaf and allow normal `DefWindowProc` parent propagation if the control does not consume it;
- mouse capture, focused-control routing, raw input, and pointer-input consumers: not emulated;
- invalid leaf before submission: native pass and discard candidate state;
- destruction after successful queueing: no retry or replacement target.

This path is documented as best-effort application compatibility. Users can always recover exact behavior by using 100% without inversion, turning customization off, or enabling Ctrl passthrough.

### 5.4 Hook-time modifiers

For Windows Ctrl+Wheel routing, replace the 16 ms sampler snapshot with synchronous hook-callback reads using `GetAsyncKeyState` for:

- Ctrl;
- Shift;
- Alt;
- left, middle, right, X1, and X2 mouse buttons where available.

This is a callback-time state snapshot, not a claim that Windows exposes original `wParam` mouse-key flags through `WH_MOUSE_LL`. Unavailable button state is omitted.

Ctrl selects zoom customization. Shift and supported button flags are preserved in transformed `wParam`; Shift never secretly inverts direction. Alt is captured for passthrough policy but is not encoded as a `WM_MOUSEWHEEL` mouse-key flag.

Transition-boundary tests mock callback-time state explicitly.

## 6. Architecture

### 6.1 Windows zoom bypasses the scroll engine

The Windows Ctrl+Wheel path no longer calls `SmoothScrollEngine::on_wheel_zoom` and no longer signals the display-frame worker for zoom.

Vertical and horizontal paths remain unchanged, including acceleration, easing, profiles, and frame emission.

The existing core zoom axis may remain temporarily only for compilation during platform migration, but Windows tests must prove it is unreachable. Remove shared zoom-axis code only when every platform is migrated to the new contract or native passthrough.

### 6.2 Zoom transform state

Add one small state object scoped to the Windows/Tauri hook sink:

```text
ZoomTransformState
- session_key: target + sensitivity_percent + inversion + epoch
- residual_numerator: signed integer in (-100, 100)
```

Responsibilities:

- calculate candidate state immutably;
- commit only for zero-output accepted transform or successfully queued output;
- reset on session-key change or native pass;
- hold no full-packet backlog, timer, velocity, or animation state.

Repeated target transitions can discard repeated sub-unit intent. Precision guarantee applies only within one stable transform session. This bounded per-transition loss is accepted instead of retaining an unbounded per-window residual map.

### 6.3 Targeted zoom packet seam

Replace context-free Windows zoom emission with an injectable targeted dispatch seam conceptually equivalent to:

```text
queue_zoom_packet(target, screen_point, mouse_key_flags, signed_delta)
    -> Queued | Rejected
```

Hook tests record target, point, flags, delta, outcome, state commit, and order.

Unsupported platform emitters do not implement transformed zoom for this release; their hook routes native Ctrl/Command+Wheel passthrough.

### 6.4 Win32 packing

- Signed wheel delta occupies the signed 16-bit high word of `wParam`.
- `MK_CONTROL` is always present for transformed zoom.
- Captured `MK_SHIFT` and supported mouse-button flags are preserved.
- `lParam` uses the low 16 bits of captured signed screen x/y, matching Win32 message packing. Negative and multi-monitor boundary values require tests. Values outside signed 16-bit representation inherit Win32 truncation limitations and are documented diagnostics, not clamped to a different point.
- Split transformed delta only when outside `-32768..=32767`, using the minimum ordered packet count that preserves aggregate signed delta.
- Validate target immediately before `PostMessageW`. Successful return means queued, not semantically handled.

The existing fallback incorrectly represents Ctrl via `KEYEVENTF_UNICODE` and scan code `0x1D`. Do not use it unchanged. Initial implementation omits `SendInput` fallback: synchronous `PostMessageW` rejection returns native pass. A corrected, self-tagged fallback requires separate compatibility evidence.

## 7. UI and Accessibility

### 7.1 Windows-only surface for this release

Render zoom customization controls only on Windows. Linux and macOS route Ctrl/Command+Wheel natively until platform-specific specs satisfy the same packet contract.

Persisted fields remain portable but inactive outside Windows. Add routing tests for Tauri macOS, standalone macOS engine, Linux X11, and Linux Wayland proving no synthetic zoom is generated in this release.

### 7.2 Controls

- Master: **Customize Ctrl+Wheel zoom**.
- Sensitivity: **Zoom sensitivity**, 25%–400%, 5% step, default 100%.
- Inversion: **Invert Ctrl+Wheel zoom direction**, default off.
- Reset: **Reset zoom amount and direction**; resets sensitivity to 100% and inversion off without changing master state.

Slider value 100% is labeled **Native amount**, not “Native,” because inversion still requires synthetic delivery.

Show effective status **Native Ctrl+Wheel** only when:

- customization is off; or
- customization is on, sensitivity is 100%, and inversion is off.

Otherwise show **Compatibility transform** with help:

> SmoothScroll submits adjusted Ctrl+Wheel input. Some apps may handle adjusted input differently.

### 7.3 Disabled and keyboard behavior

When master is off:

- sensitivity and inversion remain visible but disabled and leave tab order;
- reset remains enabled and resets saved dependent values;
- visible group help says: “Turn on Customize Ctrl+Wheel zoom to use these settings”;
- the same help is associated programmatically with the master/group and dependent controls.

Keyboard order when master is on: master, sensitivity, inversion, reset. When off: master, reset.

### 7.4 Accessibility

- Native switch/range/button semantics.
- Slider exposes `aria-valuetext` as percentage plus “Native amount” at 100%.
- Visible, unobscured focus.
- Clickable row/label affordance provides at least 44×44 CSS px target without requiring the visual switch track itself to be 44 px tall.
- Text contrast at least 4.5:1; component/focus contrast at least 3:1.
- No wheel-packet live announcements.
- Test narrow layout and 200% text zoom without clipping.

### 7.5 Reduced Motion

SmoothScroll generates no zoom animation under this contract. Windows Reduce Motion changes no submitted packet payload, order, or intentional delay.

The current core bug where instant mode emits `zoom: 0` while zoom remains pending disappears from the Windows path because Windows owns no zoom engine state.

## 8. Device Semantics

`Wheel`, `HighResWheel`, and Ctrl+Wheel packets classified as `Touchpad` use identical raw-unit transforms. `InputSource` is telemetry only for zoom.

Scroll touchpad multiplier, smoothing, and acceleration have zero effect. Precision gestures delivered through APIs other than Ctrl+Wheel remain native and are outside scope.

Examples:

- Identity `+30,+30,+30,+30` passes as four native packets.
- Inversion at 100% submits `-30,-30,-30,-30`.
- At 25%, raw `+30,+30,+30,+30` may submit `+7,+8,+7,+8`; order and cumulative `+30` are preserved.
- At 25%, four raw `+1` packets submit one cumulative `+1` packet.
- At 25%, `+1,-1` returns residual to zero and submits nothing.

## 9. Error Handling and Safety

- Native identity and bypass paths never create candidate transform state.
- Candidate state commits only after zero-output transform acceptance or successful queueing.
- Queue rejection returns native pass and discards candidate state.
- Invalid captured target before queueing returns native pass.
- Queue success followed by target destruction is not retried or retargeted.
- Settings changes affect new packets only and advance transform epoch.
- Never infer semantic support from `PostMessageW` success.
- Never route failed zoom into vertical or horizontal smoothing.
- Log target, queue outcome, and OS error only; do not log window text or user content.

## 10. Testing Strategy

### 10.1 Settings normalization

- Values below 0.25 clamp to 0.25.
- Values above 4.0 clamp to 4.0.
- Arbitrary legacy values round to nearest 0.05; tie rounds upward.
- Normalized 1.0 selects exact identity when inversion is off.
- Serde round-trip preserves normalized values.

### 10.2 Pure transform arithmetic

- Raw `+120` produces `+30`, `+60`, `+120`, `+240`, `+480` at 25%, 50%, 100%, 200%, 400%.
- Inversion changes sign only.
- Signed division truncates toward zero.
- Positive/negative fractional and rapid-reversal sequences preserve bounded residual.
- Integral transforms are cadence-independent at 5 ms, 50 ms, and 500 ms intervals.
- Stable-session cumulative error remains below one wheel unit.
- Target/config/epoch transitions reset residual; rapid transition tests document accepted sub-unit loss.
- Signed 16-bit overflow uses minimum ordered split while preserving total.

### 10.3 Outcome-state tests

Verify every row in §3, including candidate commit/discard behavior and disable/re-enable epoch reset without intervening wheel input.

### 10.4 Hook policy and routing

- Identity returns `Pass` and registers no engine/emitter work.
- Customization off, Ctrl passthrough, bypass, excluded, elevated, non-Windows, and dispatch rejection return exact native pass.
- Policy is resolved from captured root HWND, not later cursor/foreground state.
- Transformed emission uses captured leaf HWND and point.
- Moving pointer/focus after capture cannot retarget the packet.
- Invalid leaf before queueing passes native; destruction after queue success causes no retry.
- Ctrl+Shift preserves Shift; Shift does not invert.
- Equal source sequences labeled Wheel, HighResWheel, or Touchpad create equal transform results.
- Active profile and every scroll field produce identical zoom behavior.
- No transformed input enters vertical/horizontal/zoom engine axes or signals worker zoom work.

### 10.5 Windows packing and dispatch seam

- Positive/negative signed high-word delta.
- `MK_CONTROL`, Shift, and supported button flags.
- Negative coordinates, `-32768`, `32767`, and low-word truncation outside representable range.
- Captured leaf HWND used exactly; no `GetCursorPos` or `WindowFromPoint` in emitter.
- Queue accepted/rejected outcomes.
- Ordered overflow split.

### 10.6 UI tests

- Windows-only rendering and non-Windows absence/unavailability.
- Master dependent-state behavior and saved-value preservation.
- 25%–400% range, 5% step, fixed-point patch value, keyboard adjustment, reset.
- Correct “Native Ctrl+Wheel” versus “Compatibility transform” status.
- 100% plus inversion never claims native delivery.
- Accessible names, `aria-valuetext`, help association, disabled tab order, focus, target size, narrow layout, and 200% text zoom.

### 10.7 Manual Windows compatibility matrix

The verification report records exact Windows build, display refresh rate, mouse/high-resolution device model, app versions, settings, and tester. Required concrete targets:

- Microsoft Edge stable: normal webpage and built-in PDF viewer;
- Mozilla Firefox stable: normal webpage;
- Visual Studio Code stable: editor zoom;
- Figma web in Microsoft Edge stable: canvas zoom;
- Microsoft Paint from the installed Windows build: canvas zoom;
- Windows Photos from the installed Windows build: image zoom;
- Microsoft Word desktop if installed; otherwise LibreOffice Writer stable, with substitution recorded.

For each target:

- compare native identity path against customization off;
- test 50%, 100% inverted, and 200% transformed paths;
- test one slow detent, sub-120 packets when hardware supports them, ten rapid detents, reversal, Ctrl+Shift, child/root control areas, inactive under-pointer window, and target switching;
- distinguish queue-level assertions from visible application behavior;
- record apps that reject or reinterpret posted `WM_MOUSEWHEEL` instead of treating that as an engine retry condition.

Release sign-off requires the implementation report plus user validation of the local Windows installer, following project release policy.

## 11. Acceptance Criteria

1. Native identity returns the original packet unchanged.
2. Ten rapid integral transforms submit ten equal commands; no superlinear gain.
3. Fractional transforms preserve source order and stable-session cumulative magnitude within one wheel unit; packet count may differ.
4. Each captured packet submits at most one ordinary emitted packet, except minimum legal signed-16-bit overflow split.
5. Zoom behavior is independent of active profile and every scroll setting.
6. SmoothScroll never generates transformed zoom after the final captured packet.
7. Normal OS/application queue latency is not treated as generated tail.
8. Disabled customization, bypasses, and unsupported platforms are exact native passthrough.
9. Reduced Motion cannot strand zoom engine work.
10. Vertical and horizontal scroll behavior remains unchanged.
11. Captured root HWND exclusively controls policy; captured leaf HWND exclusively controls best-effort transformed delivery.
12. Pointer/focus movement cannot retarget accepted transformed input.
13. 100% with inversion never claims native delivery in UI.
14. Manual matrix records exact environment and separates native compatibility from best-effort transformed behavior.
15. Local release installer is built and handed to the user before any release-triggering push.

## 12. Rollout and Platform Scope

### 12.1 Windows

Implement the complete contract in this spec. Transformed mode is best-effort `WM_MOUSEWHEEL` compatibility; identity/pass modes are exact native behavior.

### 12.2 Linux and macOS

Until platform-specific specs satisfy the same contract:

- Linux X11/Wayland must not generate synthetic Ctrl+Wheel zoom;
- Tauri macOS and standalone macOS engine must not generate synthetic Command/Control+Wheel zoom;
- controls are Windows-only;
- modifier zoom input passes natively.

Separate specs are required because:

- X11 cannot currently swallow original input reliably;
- Linux emitters have a wheel-unit/event-count mismatch;
- Wayland has separate Ctrl-injection concerns;
- macOS requires corrected CoreGraphics field IDs, modifier agreement, and synthetic-event filtering.

## 13. Non-goals

- Zoom acceleration, even with a lower cap.
- Zoom inertia or easing.
- Per-profile/per-app zoom settings.
- Hidden compatibility heuristics or response detection.
- Universal 120-unit quantization.
- Pinch translation.
- `SendInput` fallback in the initial implementation.
- Unrelated profile-editor or assignment fixes.

## 14. Superseded Decisions

For Windows, this spec supersedes these choices in `2026-05-29-smooth-zoom-design.md`:

- zoom sharing scroll `Axis` and easing;
- zoom inertia after Ctrl release;
- claims that `PostMessageW` failure/success reveals application response;
- Shift+Ctrl secretly inverting direction;
- “Smooth zoom” as the user-facing model.

It also supersedes the deleted working-tree design `2026-07-14-zoom-and-profile-animation-fix-design.md`. Its 3× acceleration cap and continued easing reduce but do not remove cadence-dependent gain and packet fragmentation.

## 15. Expected File Surfaces

Implementation planning must inspect and likely touch:

- `crates/platform/src/types.rs` — portable captured event/native target types;
- `crates/platform/src/traits.rs` — captured event and targeted dispatch contract;
- `crates/platform/src/windows/mouse_hook.rs` — callback-time target, point, modifier capture;
- `crates/platform/src/windows/process_query.rs` — HWND-specific policy queries/cache;
- `crates/platform/src/windows/wheel_emitter.rs` — targeted best-effort packet queueing;
- all `HookEventSink`/zoom emitter implementations and test stubs — explicit trait migration;
- `src-tauri/src/hook_wiring.rs` — HWND policy, identity pass, immediate transform outcomes;
- `src-tauri/src/state.rs` — transform epoch/residual state;
- `crates/core/src/settings.rs` — 5% normalization;
- `crates/core/src/engine.rs` — Windows zoom path unreachable; cleanup only if platform-safe;
- `src/stores/settingsStore.ts` — expose zoom sensitivity;
- `src/components/settings/DirectionSection.tsx` — Windows control model and status;
- shared settings-row/control accessibility only where needed for 44×44 hit area/help association;
- locale files;
- focused Rust, Tauri, UI, and platform routing tests.

No new dependency is required.
