# QoL Plan 3 — Smart raw-mode (modifier passthrough, Gap #4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user holds Ctrl (or Cmd on macOS) or Alt while scrolling, pass the wheel event through raw — no smoothing, no acceleration. Optionally clear pending inertia on the press transition. User-configurable, defaults ON.

**Architecture:** Add `ModifierPassthrough` struct to `AppSettings`; mirror three booleans into hot-path `EffectiveSettings`; insert one branch in `EngineSink::route_vertical_with_source` and `route_horizontal_with_source` after exclude resolution to early-return `Pass` when modifier intent is detected. Add `Engine::reset_axes()`. Extend `ModifierKeys` with `cmd` for macOS.

**Tech Stack:** Rust workspace, Tauri IPC, React/TS Settings UI.

**Spec:** `docs/superpowers/specs/2026-05-19-qol-pass-design.md` § Gap #4

**Depends on:** none functionally (Plans 1 and 2 are independent). Touches some of the same files in `state.rs` / `lib.rs` / settings types — coordinate merge order.

---

## File map

| Action | Path | Purpose |
|---|---|---|
| Modify | `crates/platform/src/types.rs` | Add `cmd: bool` to `ModifierKeys` |
| Modify | `crates/platform/src/macos/mouse_hook.rs` | Populate `cmd` from `kCGEventFlagMaskCommand` |
| Modify | `crates/core/src/settings.rs` | Add `ModifierPassthrough`, fold three fields into `EffectiveSettings` |
| Modify | `crates/core/src/engine.rs` | Add `reset_axes()` method |
| Modify | `crates/core/tests/engine_tests.rs` | Test `reset_axes` |
| Modify | `crates/core/tests/settings_tests.rs` | Test defaults & serde |
| Modify | `src-tauri/src/hook_wiring.rs` | Modifier branch in both routing methods |
| Modify | `src/lib/tauri.ts` | Add `ModifierPassthrough` type |
| Modify | `src/components/settings/ScrollSection.tsx` (or new section) | "Precision Actions" UI |
| Modify | i18n locale files | New keys |

---

## Task 1: Extend `ModifierKeys` with `cmd`

**Files:**
- Modify: `crates/platform/src/types.rs`

- [ ] **Step 1: Add field**

```rust
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ModifierKeys {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub cmd: bool,
}
```

- [ ] **Step 2: Build**

```
cargo build -p smoothscroll_platform
```

Expected: success (existing call sites that build `ModifierKeys { shift, ctrl, alt }` may break — fix each by appending `cmd: false`).

- [ ] **Step 3: Fix call sites**

Search:
```
grep -rn "ModifierKeys *{" crates src-tauri
```

For every literal that uses positional or named init missing `cmd`, add `cmd: false` (Windows hook can never produce Cmd; tests stubs: `cmd: false`).

- [ ] **Step 4: Build**

```
cargo build --workspace
```

Expected: success.

- [ ] **Step 5: Commit**

```
git add crates/platform/src/types.rs crates/platform/src/windows/mouse_hook.rs src-tauri/src/hook_wiring.rs
git commit -m "feat(platform): add cmd to ModifierKeys"
```

---

## Task 2: macOS hook populates `cmd`

**Files:**
- Modify: `crates/platform/src/macos/mouse_hook.rs`

- [ ] **Step 1: Read existing modifier extraction**

Find where `ModifierKeys` is constructed in the macOS event tap callback. It uses `CGEventGetFlags`. Mask constants: `kCGEventFlagMaskShift`, `kCGEventFlagMaskControl`, `kCGEventFlagMaskAlternate`, `kCGEventFlagMaskCommand`.

- [ ] **Step 2: Add `cmd`**

Locate the construction (something like):

```rust
let mods = ModifierKeys {
    shift: (flags & kCGEventFlagMaskShift) != 0,
    ctrl: (flags & kCGEventFlagMaskControl) != 0,
    alt: (flags & kCGEventFlagMaskAlternate) != 0,
};
```

Change to:

```rust
let mods = ModifierKeys {
    shift: (flags & kCGEventFlagMaskShift) != 0,
    ctrl: (flags & kCGEventFlagMaskControl) != 0,
    alt: (flags & kCGEventFlagMaskAlternate) != 0,
    cmd: (flags & kCGEventFlagMaskCommand) != 0,
};
```

- [ ] **Step 3: Build on macOS**

```
cargo build -p smoothscroll_platform --target aarch64-apple-darwin
```

Expected: success.

- [ ] **Step 4: Commit**

```
git add crates/platform/src/macos/mouse_hook.rs
git commit -m "feat(platform): macOS hook populates ModifierKeys.cmd"
```

---

## Task 3: `ModifierPassthrough` struct + `AppSettings` field

**Files:**
- Modify: `crates/core/src/settings.rs`
- Test: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Write the failing test**

Append:

```rust
#[test]
fn modifier_passthrough_defaults_on() {
    let s = smoothscroll_core::settings::AppSettings::default();
    assert!(s.modifier_passthrough.ctrl);
    assert!(s.modifier_passthrough.alt);
    assert!(s.modifier_passthrough.clear_inertia_on_press);
}

#[test]
fn modifier_passthrough_round_trips() {
    use smoothscroll_core::settings::{AppSettings, ModifierPassthrough};
    let mut s = AppSettings::default();
    s.modifier_passthrough = ModifierPassthrough { ctrl: false, alt: true, clear_inertia_on_press: false };
    let json = serde_json::to_string(&s).unwrap();
    let back: AppSettings = serde_json::from_str(&json).unwrap();
    assert_eq!(back.modifier_passthrough, s.modifier_passthrough);
}
```

- [ ] **Step 2: Run — verify failure**

```
cargo test -p smoothscroll_core --test settings_tests modifier_passthrough
```

Expected: FAIL.

- [ ] **Step 3: Implement**

In `crates/core/src/settings.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ModifierPassthrough {
    pub ctrl: bool,
    pub alt: bool,
    pub clear_inertia_on_press: bool,
}

impl Default for ModifierPassthrough {
    fn default() -> Self {
        Self { ctrl: true, alt: true, clear_inertia_on_press: true }
    }
}
```

In `AppSettings`:

```rust
    pub modifier_passthrough: ModifierPassthrough,
```

In `Default for AppSettings`:

```rust
            modifier_passthrough: ModifierPassthrough::default(),
```

- [ ] **Step 4: Run — verify pass**

```
cargo test -p smoothscroll_core --test settings_tests modifier_passthrough
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): ModifierPassthrough setting"
```

---

## Task 4: Mirror into `EffectiveSettings`

**Files:**
- Modify: `crates/core/src/settings.rs`
- Test: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Test**

Append:

```rust
#[test]
fn effective_settings_carry_modifier_passthrough() {
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    assert!(eff.modifier_ctrl_passthrough);
    assert!(eff.modifier_alt_passthrough);
    assert!(eff.modifier_clear_inertia);
}
```

- [ ] **Step 2: Verify failure**

```
cargo test -p smoothscroll_core --test settings_tests effective_settings_carry_modifier_passthrough
```

Expected: FAIL.

- [ ] **Step 3: Implement**

In `EffectiveSettings`:

```rust
    pub modifier_ctrl_passthrough: bool,
    pub modifier_alt_passthrough: bool,
    pub modifier_clear_inertia: bool,
```

In `from_settings`:

```rust
            modifier_ctrl_passthrough: s.modifier_passthrough.ctrl,
            modifier_alt_passthrough: s.modifier_passthrough.alt,
            modifier_clear_inertia: s.modifier_passthrough.clear_inertia_on_press,
```

In `with_profile`:

```rust
            modifier_ctrl_passthrough: base.modifier_passthrough.ctrl,
            modifier_alt_passthrough: base.modifier_passthrough.alt,
            modifier_clear_inertia: base.modifier_passthrough.clear_inertia_on_press,
```

- [ ] **Step 4: Verify pass**

```
cargo test -p smoothscroll_core
```

Expected: green.

- [ ] **Step 5: Commit**

```
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): EffectiveSettings carries modifier passthrough flags"
```

---

## Task 5: `Engine::reset_axes()`

**Files:**
- Modify: `crates/core/src/engine.rs`
- Test: `crates/core/tests/engine_tests.rs`

- [ ] **Step 1: Test**

```rust
#[test]
fn reset_axes_clears_pending_work() {
    use smoothscroll_core::engine::SmoothScrollEngine;
    use smoothscroll_core::input_source::InputSource;
    use smoothscroll_core::settings::{AppSettings, EffectiveSettings};
    let s = AppSettings::default();
    let eff = EffectiveSettings::from_settings(&s);
    let mut engine = SmoothScrollEngine::new();
    engine.on_wheel_with_source(120, 0, InputSource::Wheel, &eff);
    engine.on_hwheel_with_source(120, 0, InputSource::Wheel, &eff);
    assert!(engine.has_pending_work());
    engine.reset_axes();
    assert!(!engine.has_pending_work());
}
```

- [ ] **Step 2: Verify failure**

```
cargo test -p smoothscroll_core --test engine_tests reset_axes
```

Expected: FAIL.

- [ ] **Step 3: Implement**

In `crates/core/src/engine.rs`, add to `impl SmoothScrollEngine`:

```rust
pub fn reset_axes(&mut self) {
    self.v.remaining_px = 0.0;
    self.v.unit_accum = 0.0;
    self.h.remaining_px = 0.0;
    self.h.unit_accum = 0.0;
}
```

- [ ] **Step 4: Verify pass**

```
cargo test -p smoothscroll_core --test engine_tests reset_axes
```

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add crates/core/src/engine.rs crates/core/tests/engine_tests.rs
git commit -m "feat(core): SmoothScrollEngine::reset_axes"
```

---

## Task 6: Modifier passthrough branch in `EngineSink`

**Files:**
- Modify: `src-tauri/src/hook_wiring.rs`

- [ ] **Step 1: Add tests first**

Add helpers and tests inside the existing `mod tests`:

```rust
fn ctrl_only() -> ModifierKeys {
    ModifierKeys { shift: false, ctrl: true, alt: false, cmd: false }
}
fn alt_only() -> ModifierKeys {
    ModifierKeys { shift: false, ctrl: false, alt: true, cmd: false }
}
fn cmd_only() -> ModifierKeys {
    ModifierKeys { shift: false, ctrl: false, alt: false, cmd: true }
}

#[test]
fn ctrl_wheel_passes_through_when_passthrough_enabled() {
    let s = AppSettings::default(); // ctrl passthrough = true
    let state = make_state(s);
    let sink = EngineSink::new(state.clone());
    assert_eq!(sink.on_wheel(120, ctrl_only()), HookDecision::Pass);
    assert!(!state.engine.lock().has_pending_work());
}

#[test]
fn ctrl_wheel_smooths_when_passthrough_disabled() {
    let mut s = AppSettings::default();
    s.modifier_passthrough.ctrl = false;
    let state = make_state(s);
    let sink = EngineSink::new(state.clone());
    assert_eq!(sink.on_wheel(120, ctrl_only()), HookDecision::Swallow);
}

#[test]
fn alt_wheel_passes_through_when_enabled() {
    let s = AppSettings::default();
    let state = make_state(s);
    let sink = EngineSink::new(state.clone());
    assert_eq!(sink.on_wheel(120, alt_only()), HookDecision::Pass);
}

#[cfg(target_os = "macos")]
#[test]
fn cmd_wheel_passes_through_macos() {
    let s = AppSettings::default();
    let state = make_state(s);
    let sink = EngineSink::new(state.clone());
    assert_eq!(sink.on_wheel(120, cmd_only()), HookDecision::Pass);
}

#[test]
fn ctrl_press_clears_inertia() {
    let s = AppSettings::default();
    let state = make_state(s);
    let sink = EngineSink::new(state.clone());
    // Build pending work without modifier
    sink.on_wheel(120, no_mods());
    assert!(state.engine.lock().has_pending_work());
    // Press ctrl
    let _ = sink.on_wheel(120, ctrl_only());
    assert!(!state.engine.lock().has_pending_work(), "inertia should clear on modifier press");
}
```

- [ ] **Step 2: Verify failure**

```
cargo test -p smoothscroll --lib hook_wiring
```

Expected: new tests FAIL.

- [ ] **Step 3: Implement branch**

In `route_vertical_with_source`, after the exclude resolution and before `update_last_source`, add:

```rust
#[cfg(target_os = "macos")]
let precision = (mods.cmd && eff.modifier_ctrl_passthrough)
    || (mods.alt && eff.modifier_alt_passthrough);
#[cfg(not(target_os = "macos"))]
let precision = (mods.ctrl && eff.modifier_ctrl_passthrough)
    || (mods.alt && eff.modifier_alt_passthrough);

if precision {
    if eff.modifier_clear_inertia {
        self.state.engine.lock().reset_axes();
    }
    return HookDecision::Pass;
}
```

Important: place this **after** the existing Shift branch so Shift+horizontal-smoothness behaviour is preserved. Read the function carefully — Shift branch already comes first to prefer horizontal smoothing semantics.

In `route_horizontal_with_source`, add the same `precision` calculation and early-return.

- [ ] **Step 4: Verify pass**

```
cargo test -p smoothscroll --lib hook_wiring
```

Expected: green, including existing regression tests like `shift_with_setting_on_swallows_and_routes_to_h`.

- [ ] **Step 5: Commit**

```
git add src-tauri/src/hook_wiring.rs
git commit -m "feat(app): pass-through Ctrl/Alt+wheel for precision actions"
```

---

## Task 7: Frontend types

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add type**

```typescript
export interface ModifierPassthrough {
  ctrl: boolean;
  alt: boolean;
  clear_inertia_on_press: boolean;
}

export interface AppSettings {
  // ... existing
  modifier_passthrough: ModifierPassthrough;
}
```

- [ ] **Step 2: TS check**

```
pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/lib/tauri.ts
git commit -m "feat(ui): ModifierPassthrough type"
```

---

## Task 8: "Precision Actions" Settings UI

**Files:**
- Create or modify: `src/components/settings/PrecisionActionsSection.tsx`
- Modify: `src/routes/Settings.tsx` (mount in Scroll tab)

- [ ] **Step 1: Create component**

```tsx
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/switch";
import { SettingRow } from "./SettingRow";

const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");

export function PrecisionActionsSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const patch = useSettingsStore((s) => s.patch);
  if (!settings) return null;

  const mp = settings.modifier_passthrough;

  const update = (partial: Partial<typeof mp>) =>
    patch({ modifier_passthrough: { ...mp, ...partial } });

  return (
    <section className="space-y-2">
      <header>
        <h3 className="text-sm font-semibold">{t("precision.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("precision.help")}</p>
      </header>
      <SettingRow
        label={isMac ? t("precision.cmd_label") : t("precision.ctrl_label")}
        help={t("precision.ctrl_help")}
      >
        <Switch checked={mp.ctrl} onCheckedChange={(v) => update({ ctrl: v })} />
      </SettingRow>
      <SettingRow label={t("precision.alt_label")} help={t("precision.alt_help")}>
        <Switch checked={mp.alt} onCheckedChange={(v) => update({ alt: v })} />
      </SettingRow>
      <SettingRow label={t("precision.clear_inertia_label")} help={t("precision.clear_inertia_help")}>
        <Switch
          checked={mp.clear_inertia_on_press}
          onCheckedChange={(v) => update({ clear_inertia_on_press: v })}
        />
      </SettingRow>
    </section>
  );
}
```

- [ ] **Step 2: Mount in Settings**

In `src/routes/Settings.tsx`, in the Scroll tab JSX, add `<PrecisionActionsSection />` after `<DirectionSection />` (or wherever fits):

```tsx
import { PrecisionActionsSection } from "@/components/settings/PrecisionActionsSection";
// ...
<DirectionSection />
<PrecisionActionsSection />
```

- [ ] **Step 3: TS check**

```
pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/components/settings/PrecisionActionsSection.tsx src/routes/Settings.tsx
git commit -m "feat(ui): Precision Actions section"
```

---

## Task 9: i18n keys

**Files:**
- Modify: English locale file

- [ ] **Step 1: Add**

```json
"precision": {
  "title": "Precision actions",
  "help": "Pass wheel events through raw when modifier keys signal a precision action like zoom or font size.",
  "ctrl_label": "Pass-through Ctrl + wheel",
  "cmd_label": "Pass-through Cmd + wheel",
  "ctrl_help": "Recommended for zoom (Photoshop, Figma, browsers, VS Code).",
  "alt_label": "Pass-through Alt + wheel",
  "alt_help": "Recommended for editors and timelines (Premiere, DAWs).",
  "clear_inertia_label": "Clear inertia when modifier pressed",
  "clear_inertia_help": "Stop pending smooth scroll the moment a modifier is pressed so zoom feels immediate."
}
```

- [ ] **Step 2: Commit**

```
git add src/i18n/...
git commit -m "feat(ui): precision i18n keys"
```

---

## Task 10: Final verification

- [ ] **Step 1: Tests**

```
cargo test --workspace
pnpm tsc --noEmit
```

Expected: green.

- [ ] **Step 2: Lints**

```
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
```

- [ ] **Step 3: Manual smoke**

| Action | Expected |
|---|---|
| In VS Code, Ctrl+wheel | Font size changes by exactly one step per notch |
| In Photoshop, Ctrl+wheel | Zoom feels crisp, no inertia after release |
| In Premiere, Alt+wheel on timeline | Zoom levels move discretely |
| Shift+wheel | Still horizontal smooth (regression preserved) |
| Plain wheel | Smooth as before |
| Toggle Ctrl passthrough off → Ctrl+wheel in VS Code | Old smoothed feel returns |

- [ ] **Step 4: Bench regression**

```
cargo bench -p smoothscroll_core --bench engine
```

Expected: ±5% baseline.

- [ ] **Step 5: Final commit**

```
git status
```

Expected: clean.
