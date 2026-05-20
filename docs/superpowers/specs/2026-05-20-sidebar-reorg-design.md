# Sidebar Reorganization & Test-Scroll Removal

**Date:** 2026-05-20
**Status:** Approved (design phase)
**Owner:** quangtruong2003

## Problem

Two issues reported by users:

1. **Settings hard to find.** The "Scroll" tab packs 8 sections into a single
   route (`ScrollSection`, `AppearanceSection`, `DirectionSection`,
   `PrecisionActionsSection`, `EdgeScrollSection`, `KeyboardScrollSection`,
   `TouchpadSection`, plus `LivePreviewPanel`). Users scroll through a long
   list to find a single toggle.
2. **Two redundant scroll-test surfaces.** `TestSandboxSection` (in General
   tab, with A/B compare mode) and `LivePreviewPanel` (collapsible at top of
   Scroll tab) both exist solely so the user can "feel" current scroll
   settings. The owner has decided neither is needed.

## Goals

- Reduce cognitive load per tab so each settings group is scannable.
- Remove both scroll-test surfaces from the main settings UI.
- Keep onboarding's preview engine intact (it has its own legitimate use of
  `ScrollPreviewArea` / `useWasmEngine` / `SamplePreviewContent`).
- No behavior change to scroll engine, profiles, or persisted settings.

## Non-Goals

- No changes to the scroll engine, settings schema, or Tauri commands.
- No changes to onboarding flow or its embedded preview.
- No deletion of pre-existing dead code beyond what these changes orphan.
- No translation copy review beyond the keys this change introduces or
  retires.

## Design

### New sidebar structure (5 → 7 tabs)

| # | TabKey       | Label (en)  | Sections                                      | Notes                  |
|---|--------------|-------------|-----------------------------------------------|------------------------|
| 1 | `general`    | General     | `BatteryHint`, `EnableHeader`, `HealthCheck`  | `TestSandbox` removed  |
| 2 | `scroll`     | Scroll      | `ScrollSection`, `DirectionSection`, `AppearanceSection` | `LivePreview` removed; reduced from 8 → 3 |
| 3 | `devices`    | Devices     | `KeyboardScrollSection`, `TouchpadSection`    | New tab                |
| 4 | `advanced`   | Advanced    | `PrecisionActionsSection`, `EdgeScrollSection`| New tab                |
| 5 | `apps`       | Apps        | `ProfilesSection`, `ExcludedAppsSection`      | Unchanged              |
| 6 | `behavior`   | Behavior    | `BehaviorSection`, `GameModeSection`          | Renamed from `preferences` |
| 7 | `about`      | About       | `AboutSection`, `BackupSection`, `StatsSection` | Unchanged           |

### Rationale

- **Splitting Scroll.** Eight sections in one tab is the root cause of the
  "hard to find" complaint. Devices (keyboard + touchpad) and Advanced
  (precision modifier keys + edge autoscroll) are natural sub-groupings:
  users mentally search by *which input device am I using* and *is this a
  power-user toggle*.
- **`preferences` → `behavior`.** "Preferences" is content-free in a
  settings page where everything is a preference. "Behavior" describes what
  is actually there: app behavior toggles + game-mode toggle.
- **3 sections per non-trivial tab** keeps each route scannable without
  scrolling on the default window size.

### Icons

Use `lucide-react` icons consistent with the existing palette:

- `general` — `Activity` (unchanged)
- `scroll` — `Sliders` (unchanged)
- `devices` — `Keyboard` (new) — covers keyboard + touchpad input
- `advanced` — `Wrench` (new) — power-user toggles
- `apps` — `AppWindow` (unchanged)
- `behavior` — `Settings` (was on `preferences` — moves with the rename)
- `about` — `Info` (unchanged)

### File-level changes

**Modified**
- `src/components/Sidebar.tsx`
  - `TabKey` union: drop `"preferences"`, add `"devices" | "advanced" | "behavior"`.
  - Update `TABS` array (order matches table above).
  - Add icon imports for `Keyboard`, `Wrench`.
- `src/routes/Settings.tsx`
  - Remove imports + JSX for `TestSandboxSection`, `LivePreviewPanel`.
  - Add `case "devices"` and `case "advanced"` blocks.
  - Rename `case "preferences"` → `case "behavior"`.
  - Move `KeyboardScrollSection`, `TouchpadSection` out of the `scroll`
    case into the new `devices` case.
  - Move `PrecisionActionsSection`, `EdgeScrollSection` out of `scroll`
    into the new `advanced` case.

**Deleted**
- `src/components/settings/TestSandboxSection.tsx`
- `src/components/preview/LivePreviewPanel.tsx`
- `src/components/preview/ScrollComparePane.tsx` *(only consumer was
  `TestSandboxSection`; verified by grep)*

**Kept (used by onboarding)**
- `src/components/preview/ScrollPreviewArea.tsx`
- `src/components/preview/useWasmEngine.ts`
- `src/components/preview/sampleContent.tsx`

### i18n keys

14 locale files in `src/i18n/locales/`: `de`, `en`, `es`, `fr`, `hi`, `id`,
`it`, `ja`, `ko`, `pt-BR`, `ru`, `tr`, `vi`, `zh`.

**Added** (per locale):
- `tabs.devices.label` — "Devices" / equivalent
- `tabs.devices.title` — page heading
- `tabs.devices.description` — short subtitle
- `tabs.advanced.label` — "Advanced" / equivalent
- `tabs.advanced.title`
- `tabs.advanced.description`
- `tabs.behavior.label` — "Behavior" / equivalent
- `tabs.behavior.title`
- `tabs.behavior.description`

**Retired** (safe to delete; no remaining consumers after this change):
- `tabs.preferences.label/title/description`
- `section.test_scroll`
- `test_scroll.*`
- `compare.*`
- `preview_hint.*`

Each locale file is updated in the same commit so no language falls back to
English mid-flight.

### Tray / external entry points

- `src-tauri/src/commands.rs::navigate_to` is generic — emits whatever
  string the frontend asks for. No Rust change needed.
- `src/components/TrayPanel.tsx` only emits `'excluded-apps'`, which the
  Settings listener already maps to `tab="apps"`. Unchanged.
- Grep confirmed: no code path emits `'preferences'`.

## Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| User muscle memory: `preferences` rename | Sidebar is the only entry — no deep links exist. Low impact. |
| 7 tabs taller than 5 in the sidebar | Sidebar is `flex flex-col` with footer pinned via `mt-auto`. At 7 tabs × ~36px = 252px plus footer, comfortably fits the min window height. |
| WASM bundle size | `useWasmEngine` stays (onboarding still uses it). No bundle-size win, but no regression either. |
| Locale drift across 14 files | Single commit touches all locales together; reviewer can diff in one pass. |

## Verification

- Build passes: `pnpm build` (Vite + tsc).
- Rust untouched, but sanity check: `cargo check` from `src-tauri/`.
- Manual smoke (per-tab): each new/renamed tab renders its expected
  sections, sidebar highlights correctly, no console errors.
- Onboarding wizard still shows preview area (regression check on the
  shared preview components).
- Tray "Excluded apps" entry still navigates to the `apps` tab.

## Out of Scope (explicit)

- Translation copy quality for the 9 new strings × 13 locales — initial
  pass uses straightforward translations; native-speaker review can land
  separately.
- Sidebar visual redesign (icon refresh, grouping headers, collapsing).
- Any change to the scroll engine, settings persistence, or default values.
