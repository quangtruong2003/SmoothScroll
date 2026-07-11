# S4 — UI & Landing Cleanup (C1, C2, C3, C4, D1)

## 1. Context
- **C1 [VERIFIED]** `src/lib/settings.ts`: `AppSettings` camelCase model differs from the canonical snake_case model in `src/lib/tauri.ts`; no importer.
- **C2 [VERIFIED]** `src/lib/i18n.ts`: stub `i18n` (en-only) superseded by `src/i18n/index.ts` (14 locales).
- **C3 [REPORTED]** `src/components/settings/AddAppDialog.tsx`: orphan, not imported anywhere.
- **C4 [REPORTED]** `src/components/settings/ExcludedAppsSection.tsx`: file named "excluded" but renders App Profiles (`app_profiles`).
- **D1 [REPORTED]** `landing/e2e/dot-grid-overlay.spec.ts` expects mouse-tracking (`--mx/--my`) but `landing/components/BackgroundDotGrid.tsx` is static.

## 2. Current Behavior
- Dead `settings.ts` and `i18n.ts` linger; orphan `AddAppDialog`; misnamed section; landing E2E asserts behavior the component doesn't implement.

## 3. Desired Behavior
- C1/C2: remove dead files after confirming no imports (grep).
- C3: wire `AddAppDialog` into the App Profiles flow OR remove.
- C4: rename `ExcludedAppsSection.tsx` → `AppProfilesSection.tsx` (content already correct) OR rename the section title to match.
- D1: sync test and impl — either upgrade `BackgroundDotGrid` to mouse-tracking (per approved `2026-05-18-background-dot-grid-design.md`) OR change the E2E to assert static overlay.

## 4. Acceptance Criteria
- [ ] `grep -r "lib/settings"` and `grep -r "lib/i18n"` find no importers → files deleted; `pnpm build` passes.
- [ ] `AddAppDialog` either integrated or removed; no orphan component remains.
- [ ] Section filename/title consistent.
- [ ] `landing/e2e` passes (dot-grid test matches impl).

## 5. Test Plan
- C1/C2: removal verified by `pnpm build` + `pnpm lint` (no unresolved import).
- C3/C4: visual/structural check; no regression in settings UI.
- D1: run `playwright` dot-grid spec green.

## 6. Implementation Notes
- C1/C2: `grep -r "from \"@/lib/settings\""` / `"@/lib/i18n"` before delete.
- C4: prefer rename file to `AppProfilesSection.tsx` (content already App Profiles) — less churn than rewording.
- D1: recommend upgrading dot-grid to cursor-follow (design already approved) rather than weakening the test.

## 7. Risks / Out-of-scope
- Do not alter the canonical `tauri.ts` model or the real `src/i18n/index.ts`.
- No settings-UI UX redesign.
