# S2 — macOS Scroll Correctness (A3, A4)

## 1. Context
- **A3 [VERIFIED]** `crates/platform/src/macos/event_tap.rs:218-219, 232`: `on_wheel_ext`/`on_hwheel_ext` results are discarded (`_v_decision`/`_h_decision`); callback always `return event`. On Windows, `HookDecision::Swallow` suppresses the original event; macOS passes it through AND the engine emits eased pulses → **double-scroll risk**.
- **A4 [REPORTED]** macOS stubs: `process_name_under_cursor`=None, `list_visible_processes`=empty, `fullscreen.rs`=false, `window_geom.rs`=stub.

## 2. Current Behavior
- Original scroll event always reaches the target app; engine also injects synthetic eased scroll. If the engine does not compensate, scroll distance doubles.
- macOS cannot detect app-under-cursor, visible processes, or fullscreen → per-app profile / game-mode limited.

## 3. Desired Behavior
- A3: macOS scroll is single (no double-scroll). Either (a) suppress the original event's delta when the engine handles it, or (b) confirm engine runs in `instant_mode` on macOS so no extra distance is added. Document the chosen design explicitly.
- A4: define requirements + acceptance criteria (below); detailed design deferred.

## 4. Acceptance Criteria
- [ ] **A3**: scrolling on macOS produces eased motion WITHOUT doubling native distance (measured or unit-tested on the engine path).
- [ ] **A4-visibility**: documented requirement — `process_name_under_cursor` returns the foreground app process name.
- [ ] **A4-fullscreen**: documented requirement — `is_foreground_fullscreen` detects fullscreen foreground windows.
- [ ] **A4-process-list**: documented requirement — `list_visible_processes` returns visible apps for the picker.
- [ ] No regression on Windows/Linux scroll.

## 5. Test Plan
- A3: a unit/integration test on the macOS engine path asserting original+synthetic distance is not additive (or that original delta is zeroed when swallowed).
- A4: acceptance verified by later implementation plan (manual + targeted unit tests per criteria above).

## 6. Implementation Notes
- A3: clarify intent with author. If swallow is intended, zero the original event's delta before `return event` (set `kCGScrollWheelEventDeltaAxis1/2` and `PointDelta` to 0). If instant_mode is intended, ensure `EffectiveSettings::instant_mode` is set for macOS.
- A4: defer to separate plan; this spec only captures criteria.

## 7. Risks / Out-of-scope
- Do NOT tune easing curves — only correctness.
- A4 detailed implementation is OUT OF SCOPE here (criteria-only).
