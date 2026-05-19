# QoL Plan 5 — Onboarding wizard (Gap #1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-run users complete a 3-step wizard (use case → feel → try) that maps to a curated preset and writes a completion timestamp so the wizard never appears again unless explicitly re-run.

**Architecture:** Add `onboarding_completed_at: Option<u64>` to `AppSettings`. Add `apply_onboarding_preset` IPC. Frontend shows a full-screen modal at Settings mount time when timestamp is `None` and settings still match defaults. Step 3 reuses `<ScrollPreviewArea>` from Plan 4. About tab gets a "Re-run setup" button.

**Tech Stack:** Rust + Tauri IPC, React, reuse Plan 4's WASM preview, `useReducer` for wizard state.

**Spec:** `docs/superpowers/specs/2026-05-19-qol-pass-design.md` § Gap #1

**Depends on:** Plan 4 (`<ScrollPreviewArea>` and `useWasmEngine`). Plans 1 + 3 land first so the preset patches can include `respect_reduce_motion` (no — wizard doesn't touch RM) and `modifier_passthrough` (yes, Coder/Designer presets enable it).

---

## File map

| Action | Path | Purpose |
|---|---|---|
| Modify | `crates/core/src/settings.rs` | Add `onboarding_completed_at: Option<u64>` |
| Modify | `crates/core/tests/settings_tests.rs` | Default + serde tests |
| Create | `crates/core/src/onboarding.rs` | `(use_case, feel) -> SettingsPatch` mapping |
| Modify | `crates/core/src/lib.rs` | Re-export `onboarding` |
| Modify | `src-tauri/src/commands.rs` | Add `apply_onboarding_preset` |
| Modify | `src-tauri/src/lib.rs` | Register command |
| Modify | `src/lib/tauri.ts` | Type for `onboarding_completed_at` + `OnboardingPreset` |
| Create | `src/components/onboarding/OnboardingWizard.tsx` | 3-step modal |
| Create | `src/components/onboarding/wizardReducer.ts` | State machine |
| Create | `src/components/onboarding/presetMatrix.ts` | UI-side mirror for Step 3 preview |
| Modify | `src/routes/Settings.tsx` | Mount wizard when condition met |
| Modify | `src/components/settings/AboutSection.tsx` | "Re-run setup" button |
| Modify | i18n locale files | `onboarding.*` keys |

---

## Task 1: Add `onboarding_completed_at` field

**Files:**
- Modify: `crates/core/src/settings.rs`
- Test: `crates/core/tests/settings_tests.rs`

- [ ] **Step 1: Test**

```rust
#[test]
fn onboarding_completed_at_defaults_to_none() {
    let s = smoothscroll_core::settings::AppSettings::default();
    assert!(s.onboarding_completed_at.is_none());
}

#[test]
fn onboarding_completed_at_round_trips() {
    let mut s = smoothscroll_core::settings::AppSettings::default();
    s.onboarding_completed_at = Some(1_700_000_000);
    let json = serde_json::to_string(&s).unwrap();
    let back: smoothscroll_core::settings::AppSettings = serde_json::from_str(&json).unwrap();
    assert_eq!(back.onboarding_completed_at, Some(1_700_000_000));
}
```

- [ ] **Step 2: Verify failure**

```
cargo test -p smoothscroll_core --test settings_tests onboarding_completed_at
```

Expected: FAIL.

- [ ] **Step 3: Implement**

In `AppSettings`:

```rust
    pub onboarding_completed_at: Option<u64>,
```

In `Default`:

```rust
            onboarding_completed_at: None,
```

- [ ] **Step 4: Verify pass**

```
cargo test -p smoothscroll_core
```

Expected: green.

- [ ] **Step 5: Commit**

```
git add crates/core/src/settings.rs crates/core/tests/settings_tests.rs
git commit -m "feat(core): onboarding_completed_at field"
```

---

## Task 2: Preset matrix module

**Files:**
- Create: `crates/core/src/onboarding.rs`
- Modify: `crates/core/src/lib.rs`
- Test: `crates/core/tests/onboarding_tests.rs`

- [ ] **Step 1: Test**

Create `crates/core/tests/onboarding_tests.rs`:

```rust
use smoothscroll_core::onboarding::{apply_preset, UseCase, Feel};
use smoothscroll_core::settings::AppSettings;

#[test]
fn coder_balanced_uses_default_baseline() {
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::Coder, Feel::Balanced);
    // Should match defaults broadly except modifier passthrough remains ON.
    assert!(s.modifier_passthrough.ctrl);
    assert!(s.modifier_passthrough.alt);
}

#[test]
fn designer_glide_enables_modifier_passthrough_and_smaller_step() {
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::Designer, Feel::Glide);
    assert!(s.modifier_passthrough.ctrl);
    assert!(s.modifier_passthrough.alt);
    assert_eq!(s.step_size_px, 80);
}

#[test]
fn reader_snappy_increases_step_and_reduces_time() {
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::Reader, Feel::Snappy);
    assert!(s.step_size_px > 120);
    assert!(s.animation_time_ms < 360);
}

#[test]
fn apply_preset_sets_completed_timestamp_via_caller_not_here() {
    // The pure function does not mutate the timestamp; that's the caller's job.
    let mut s = AppSettings::default();
    apply_preset(&mut s, UseCase::General, Feel::Balanced);
    assert!(s.onboarding_completed_at.is_none());
}
```

- [ ] **Step 2: Verify failure**

```
cargo test -p smoothscroll_core --test onboarding_tests
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`crates/core/src/onboarding.rs`:

```rust
//! Onboarding preset matrix. Pure: takes settings, mutates fields. The caller
//! is responsible for stamping `onboarding_completed_at` and persisting.

use crate::easing::EasingMode;
use crate::settings::{AppSettings, ModifierPassthrough};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UseCase { Reader, Coder, Designer, General }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Feel { Glide, Balanced, Snappy }

pub fn apply_preset(s: &mut AppSettings, use_case: UseCase, feel: Feel) {
    // Baseline: defaults already applied where called. Tweak per (use_case, feel).
    match (use_case, feel) {
        (UseCase::Reader, Feel::Glide) => mac_like(s),
        (UseCase::Reader, Feel::Balanced) => { default_baseline(s); s.step_size_px = 100; },
        (UseCase::Reader, Feel::Snappy) => fast(s),

        (UseCase::Coder, Feel::Glide) => { default_baseline(s); s.animation_time_ms = 300; enable_mp(s); },
        (UseCase::Coder, Feel::Balanced) => { default_baseline(s); enable_mp(s); },
        (UseCase::Coder, Feel::Snappy) => { snappy(s); enable_mp(s); },

        (UseCase::Designer, Feel::Glide) => { mac_like(s); s.step_size_px = 80; enable_mp(s); },
        (UseCase::Designer, Feel::Balanced) => { default_baseline(s); enable_mp(s); },
        (UseCase::Designer, Feel::Snappy) => { fast(s); enable_mp(s); },

        (UseCase::General, Feel::Glide) => mac_like(s),
        (UseCase::General, Feel::Balanced) => default_baseline(s),
        (UseCase::General, Feel::Snappy) => snappy(s),
    }
}

fn default_baseline(s: &mut AppSettings) {
    s.step_size_px = 120;
    s.animation_time_ms = 360;
    s.acceleration_delta_ms = 70;
    s.acceleration_max = 7;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn mac_like(s: &mut AppSettings) {
    s.step_size_px = 100;
    s.animation_time_ms = 500;
    s.acceleration_delta_ms = 80;
    s.acceleration_max = 6;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn fast(s: &mut AppSettings) {
    s.step_size_px = 160;
    s.animation_time_ms = 280;
    s.acceleration_delta_ms = 50;
    s.acceleration_max = 10;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn snappy(s: &mut AppSettings) {
    s.step_size_px = 200;
    s.animation_time_ms = 200;
    s.acceleration_delta_ms = 30;
    s.acceleration_max = 14;
    s.easing_mode = EasingMode::ExponentialOut;
    s.animation_easing = true;
}
fn enable_mp(s: &mut AppSettings) {
    s.modifier_passthrough = ModifierPassthrough { ctrl: true, alt: true, clear_inertia_on_press: true };
}
```

- [ ] **Step 4: Re-export**

In `crates/core/src/lib.rs`:

```rust
pub mod onboarding;
```

- [ ] **Step 5: Verify pass**

```
cargo test -p smoothscroll_core
```

Expected: green.

- [ ] **Step 6: Commit**

```
git add crates/core/src/onboarding.rs crates/core/src/lib.rs crates/core/tests/onboarding_tests.rs
git commit -m "feat(core): onboarding preset matrix"
```

---

## Task 3: `apply_onboarding_preset` IPC

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement command**

In `commands.rs`:

```rust
#[tauri::command]
pub fn apply_onboarding_preset(
    state: State<'_, Arc<AppState>>,
    use_case: String,
    feel: String,
) -> Result<(), String> {
    use smoothscroll_core::onboarding::{apply_preset, Feel, UseCase};
    let uc = match use_case.as_str() {
        "Reader" => UseCase::Reader,
        "Coder" => UseCase::Coder,
        "Designer" => UseCase::Designer,
        "General" => UseCase::General,
        _ => return Err(format!("invalid use_case '{use_case}'")),
    };
    let f = match feel.as_str() {
        "Glide" => Feel::Glide,
        "Balanced" => Feel::Balanced,
        "Snappy" => Feel::Snappy,
        _ => return Err(format!("invalid feel '{feel}'")),
    };

    let mut snapshot = state.settings.read().clone();
    apply_preset(&mut snapshot, uc, f);
    snapshot.onboarding_completed_at = Some(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    );
    snapshot.clamp();

    smoothscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    state.commit_settings(snapshot);
    Ok(())
}

#[tauri::command]
pub fn skip_onboarding(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut snapshot = state.settings.read().clone();
    snapshot.onboarding_completed_at = Some(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    );
    smoothscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    state.commit_settings(snapshot);
    Ok(())
}

#[tauri::command]
pub fn reset_onboarding(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut snapshot = state.settings.read().clone();
    snapshot.onboarding_completed_at = None;
    smoothscroll_core::settings::save(&snapshot).map_err(|e| e.to_string())?;
    state.commit_settings(snapshot);
    Ok(())
}
```

- [ ] **Step 2: Register**

In `lib.rs`, `tauri::generate_handler![...]`:

```rust
            commands::apply_onboarding_preset,
            commands::skip_onboarding,
            commands::reset_onboarding,
```

- [ ] **Step 3: Build**

```
cargo build -p smoothscroll
```

Expected: success.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(app): onboarding IPC (apply, skip, reset)"
```

---

## Task 4: Frontend types & preset mirror

**Files:**
- Modify: `src/lib/tauri.ts`
- Create: `src/components/onboarding/presetMatrix.ts`

- [ ] **Step 1: Types**

In `src/lib/tauri.ts`:

```typescript
export type OnboardingUseCase = "Reader" | "Coder" | "Designer" | "General";
export type OnboardingFeel = "Glide" | "Balanced" | "Snappy";

export interface AppSettings {
  // existing
  onboarding_completed_at: number | null;
}
```

- [ ] **Step 2: UI-side mirror for Step 3 preview**

`src/components/onboarding/presetMatrix.ts`:

```typescript
import type { AppSettings, OnboardingUseCase, OnboardingFeel } from "@/lib/tauri";

export function applyPresetUI(
  base: AppSettings,
  useCase: OnboardingUseCase,
  feel: OnboardingFeel,
): AppSettings {
  const s = { ...base };
  const macLike = () => Object.assign(s, { step_size_px: 100, animation_time_ms: 500, acceleration_delta_ms: 80, acceleration_max: 6 });
  const fast    = () => Object.assign(s, { step_size_px: 160, animation_time_ms: 280, acceleration_delta_ms: 50, acceleration_max: 10 });
  const snappy  = () => Object.assign(s, { step_size_px: 200, animation_time_ms: 200, acceleration_delta_ms: 30, acceleration_max: 14 });
  const def     = () => Object.assign(s, { step_size_px: 120, animation_time_ms: 360, acceleration_delta_ms: 70, acceleration_max: 7 });
  const enableMP = () => { s.modifier_passthrough = { ctrl: true, alt: true, clear_inertia_on_press: true }; };

  const k = `${useCase}/${feel}`;
  switch (k) {
    case "Reader/Glide":     macLike(); break;
    case "Reader/Balanced":  def(); s.step_size_px = 100; break;
    case "Reader/Snappy":    fast(); break;
    case "Coder/Glide":      def(); s.animation_time_ms = 300; enableMP(); break;
    case "Coder/Balanced":   def(); enableMP(); break;
    case "Coder/Snappy":     snappy(); enableMP(); break;
    case "Designer/Glide":   macLike(); s.step_size_px = 80; enableMP(); break;
    case "Designer/Balanced":def(); enableMP(); break;
    case "Designer/Snappy":  fast(); enableMP(); break;
    case "General/Glide":    macLike(); break;
    case "General/Balanced": def(); break;
    case "General/Snappy":   snappy(); break;
  }
  return s;
}
```

- [ ] **Step 3: TS check**

```
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add src/lib/tauri.ts src/components/onboarding/presetMatrix.ts
git commit -m "feat(ui): onboarding types + preset mirror"
```

---

## Task 5: Wizard state machine

**Files:**
- Create: `src/components/onboarding/wizardReducer.ts`

- [ ] **Step 1: Implement**

```typescript
import type { OnboardingUseCase, OnboardingFeel } from "@/lib/tauri";

export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  step: WizardStep;
  useCase: OnboardingUseCase | null;
  feel: OnboardingFeel | null;
}

export type WizardAction =
  | { type: "set_use_case"; value: OnboardingUseCase }
  | { type: "set_feel"; value: OnboardingFeel }
  | { type: "next" }
  | { type: "back" }
  | { type: "reset" };

export const initialWizardState: WizardState = {
  step: 1,
  useCase: null,
  feel: null,
};

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "set_use_case": return { ...state, useCase: action.value };
    case "set_feel":     return { ...state, feel: action.value };
    case "next":
      if (state.step === 1 && state.useCase)
        return { ...state, step: 2 };
      if (state.step === 2 && state.feel)
        return { ...state, step: 3 };
      return state;
    case "back":
      if (state.step === 3) return { ...state, step: 2 };
      if (state.step === 2) return { ...state, step: 1 };
      return state;
    case "reset": return initialWizardState;
  }
}
```

- [ ] **Step 2: Commit**

```
git add src/components/onboarding/wizardReducer.ts
git commit -m "feat(ui): onboarding wizard reducer"
```

---

## Task 6: `<OnboardingWizard />` component

**Files:**
- Create: `src/components/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useReducer, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ScrollPreviewArea } from "@/components/preview/ScrollPreviewArea";
import { useWasmEngine } from "@/components/preview/useWasmEngine";
import { SamplePreviewContent } from "@/components/preview/sampleContent";
import { useSettingsStore } from "@/stores/settingsStore";
import { applyPresetUI } from "./presetMatrix";
import {
  initialWizardState, wizardReducer,
} from "./wizardReducer";
import type { OnboardingUseCase, OnboardingFeel } from "@/lib/tauri";

interface Props { onClose: () => void; }

const USE_CASES: OnboardingUseCase[] = ["Reader", "Coder", "Designer", "General"];
const FEELS: OnboardingFeel[] = ["Glide", "Balanced", "Snappy"];

export function OnboardingWizard({ onClose }: Props) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const baseSettings = useSettingsStore((s) => s.settings);
  const reload = useSettingsStore((s) => s.load);

  const previewSettings = baseSettings && state.useCase && state.feel
    ? applyPresetUI(baseSettings, state.useCase, state.feel)
    : baseSettings;
  const engine = useWasmEngine(previewSettings ?? null);

  const finish = async () => {
    if (!state.useCase || !state.feel) return;
    await invoke("apply_onboarding_preset", {
      useCase: state.useCase,
      feel: state.feel,
    });
    await reload();
    onClose();
  };

  const skip = async () => {
    await invoke("skip_onboarding");
    await reload();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
      <div className="w-[600px] max-w-[90vw] rounded-xl border border-border bg-background p-6 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t(`onboarding.step${state.step}.title`)}</h2>
          <button className="text-xs text-muted-foreground" onClick={skip}>{t("onboarding.skip")}</button>
        </header>

        {state.step === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("onboarding.step1.subtitle")}</p>
            {USE_CASES.map((uc) => (
              <button
                key={uc}
                onClick={() => dispatch({ type: "set_use_case", value: uc })}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm
                  ${state.useCase === uc ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <strong>{t(`onboarding.use_case.${uc}.label`)}</strong>
                <div className="text-xs text-muted-foreground">{t(`onboarding.use_case.${uc}.help`)}</div>
              </button>
            ))}
          </div>
        )}

        {state.step === 2 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("onboarding.step2.subtitle")}</p>
            {FEELS.map((f) => (
              <button
                key={f}
                onClick={() => dispatch({ type: "set_feel", value: f })}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm
                  ${state.feel === f ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <strong>{t(`onboarding.feel.${f}.label`)}</strong>
                <div className="text-xs text-muted-foreground">{t(`onboarding.feel.${f}.help`)}</div>
              </button>
            ))}
          </div>
        )}

        {state.step === 3 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("onboarding.step3.subtitle")}</p>
            <ScrollPreviewArea engine={engine} active={true}>
              <SamplePreviewContent />
            </ScrollPreviewArea>
          </div>
        )}

        <footer className="mt-4 flex justify-between">
          <Button variant="outline" onClick={() => dispatch({ type: "back" })} disabled={state.step === 1}>
            {t("onboarding.back")}
          </Button>
          {state.step < 3 ? (
            <Button
              onClick={() => dispatch({ type: "next" })}
              disabled={(state.step === 1 && !state.useCase) || (state.step === 2 && !state.feel)}
            >
              {t("onboarding.next")}
            </Button>
          ) : (
            <Button onClick={finish}>{t("onboarding.finish")}</Button>
          )}
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TS check**

```
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add src/components/onboarding/OnboardingWizard.tsx
git commit -m "feat(ui): OnboardingWizard component"
```

---

## Task 7: Mount wizard from Settings

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Add detection logic**

After the existing `useEffect`s in `SettingsPage`:

```tsx
const [wizardOpen, setWizardOpen] = useState(false);

useEffect(() => {
  if (loading || !settings) return;
  if (settings.onboarding_completed_at != null) return;

  // Skip if user appears to have already tweaked things — assume migrated.
  const def = {
    step_size_px: 120,
    animation_time_ms: 360,
    acceleration_delta_ms: 70,
    acceleration_max: 7,
  };
  const tweaked =
    settings.step_size_px !== def.step_size_px ||
    settings.animation_time_ms !== def.animation_time_ms ||
    settings.acceleration_delta_ms !== def.acceleration_delta_ms ||
    settings.acceleration_max !== def.acceleration_max;

  if (tweaked) {
    void invoke("skip_onboarding");
    return;
  }
  setWizardOpen(true);
}, [loading, settings]);
```

(Add `settings` selector and `invoke` import.)

- [ ] **Step 2: Render**

In the JSX (after Sidebar/main wrapper):

```tsx
{wizardOpen && <OnboardingWizard onClose={() => setWizardOpen(false)} />}
```

Add import:

```tsx
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
```

- [ ] **Step 3: TS check**

```
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add src/routes/Settings.tsx
git commit -m "feat(ui): show onboarding wizard on first run"
```

---

## Task 8: "Re-run setup" in About tab

**Files:**
- Modify: `src/components/settings/AboutSection.tsx`

- [ ] **Step 1: Add button**

Read the existing About section. Add a button row:

```tsx
import { invoke } from "@tauri-apps/api/core";
// ...
<Button
  variant="outline"
  onClick={async () => {
    await invoke("reset_onboarding");
    await reload();
    // Settings.tsx detection effect will re-open wizard on next render.
  }}
>
  {t("about.rerun_setup")}
</Button>
```

- [ ] **Step 2: TS check**

```
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add src/components/settings/AboutSection.tsx
git commit -m "feat(ui): re-run setup button in About"
```

---

## Task 9: i18n keys

**Files:**
- Modify: English locale file

- [ ] **Step 1: Add**

```json
"onboarding": {
  "skip": "Skip",
  "back": "Back",
  "next": "Next",
  "finish": "Looks good — finish",
  "step1": {
    "title": "What do you mostly do?",
    "subtitle": "We'll pick smart defaults for your work."
  },
  "step2": {
    "title": "How should it feel?",
    "subtitle": "Pick a starting feel. You can fine-tune later."
  },
  "step3": {
    "title": "Try it out",
    "subtitle": "Scroll the area below. If it feels right, finish."
  },
  "use_case": {
    "Reader":   { "label": "Reader",   "help": "Articles, PDFs, long pages." },
    "Coder":    { "label": "Coder",    "help": "VS Code, JetBrains, terminals." },
    "Designer": { "label": "Designer", "help": "Photoshop, Figma, video editors." },
    "General":  { "label": "General",  "help": "A mix of everything." }
  },
  "feel": {
    "Glide":    { "label": "Glide",    "help": "Slow, mac-like, smooth." },
    "Balanced": { "label": "Balanced", "help": "Recommended default." },
    "Snappy":   { "label": "Snappy",   "help": "Fast with little inertia." }
  }
},
"about": { "rerun_setup": "Re-run setup wizard" }
```

(Merge into existing namespace; do not duplicate `about`.)

- [ ] **Step 2: Commit**

```
git add src/i18n/...
git commit -m "feat(ui): onboarding i18n keys"
```

---

## Task 10: Final verification

- [ ] **Step 1: Tests + lints**

```
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
pnpm tsc --noEmit
```

- [ ] **Step 2: Manual smoke**

| Scenario | Expected |
|---|---|
| Fresh `settings.json` deleted, app start, open Settings | Wizard opens automatically |
| Wizard Step 1 → Coder, Step 2 → Snappy, Step 3 → finish | Settings reflect snappy + modifier passthrough on |
| Skip Step 1 | Wizard closes, `onboarding_completed_at` set |
| Re-open Settings | Wizard does not re-appear |
| About → Re-run setup | Wizard re-appears |
| Pre-existing user (settings tweaked) | Wizard does not auto-open; timestamp set silently |

- [ ] **Step 3: Final commit if needed**

```
git status
```

Expected: clean.
