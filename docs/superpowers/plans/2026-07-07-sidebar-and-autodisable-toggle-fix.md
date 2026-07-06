# Sidebar spacing cleanup + auto-disable Windows apps toggle fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the sidebar items being visually crammed together (UX cosmetic) AND make the "Auto-disable in Windows apps" toggle in Behavior tab actually take effect for users whose `app_profiles` carry legacy `__disabled__` entries.

**Architecture:** Two independent, surgical edits in the React frontend: (1) update sidebar button className to give items proper vertical spacing and active/inactive states, (2) extend the existing `onAutoDisableWindowsApps` handler so that toggling OFF also strips stale `__disabled__` entries from `app_profiles` for the apps in `NATIVE_SMOOTH_SEED`. No Rust/WASM changes. No Tauri command surface change.

**Tech Stack:** Tauri 2 + React 18 + TypeScript + Tailwind. Vitest + Testing Library for store tests.

**Spec:** `docs/superpowers/specs/2026-07-07-sidebar-and-autodisable-toggle-fix-design.md`

---

## Working Directory

All commands assume the repo root: `d:\SmoothScroll`.

The frontend package manager is `pnpm` — never fall back to npm/yarn (per `feedback-use-pnpm`).

---

## Task 1: Sidebar spacing cleanup

**Files:**
- Modify: `src/components/Sidebar.tsx:78` (button className)
- Modify: `src/components/Sidebar.tsx:69` (parent container — minor padding tweak)

---

- [ ] **Step 1: Update the sidebar list container**

In `src/components/Sidebar.tsx` find this block (lines 69-85):

```tsx
      <div className="native-sidebar-list flex flex-col">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className="sidebar-item relative flex items-center gap-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tab.icon}
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
```

Replace the container `<div>` with:

```tsx
      <div className="native-sidebar-list flex flex-col gap-0.5">
```

(We add `gap-0.5` (2px) as a fallback baseline; per-item padding carries the visual spacing.)

- [ ] **Step 2: Update the per-item button className**

Replace the button's `className` attribute (line 78) with:

```tsx
              className={cn(
                "sidebar-item relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
```

Notes for the engineer:
- `cn` is already imported at the top of the file (line 2: `import { cn } from "@/lib/utils";`).
- `text-foreground` on inactive hover state is intentional; it matches the focus-visible palette.
- The `sidebar-item` class is preserved as a stable hook in case any non-Tailwind selectors (e.g., global CSS) rely on it.

- [ ] **Step 3: Run TypeScript check + visual sanity**

Run:
```bash
cd d:\SmoothScroll
pnpm exec tsc --noEmit
```

Expected: no new errors. (Existing baseline errors, if any, should be unchanged — compare against `git diff HEAD` to confirm this commit introduces zero new ones.)

Then launch the app in dev mode:
```bash
pnpm dev
```

Open the Settings window and verify with the eye:
- Items have visible vertical separation (each button should be roughly 36px tall).
- Active item is visually distinct (light/dark accent background depending on theme).
- Inactive items show a hover background when the cursor enters them.
- Footer (theme switcher, language select, version chip) is unchanged.
- Sidebar width is still 176px (`w-44`); no horizontal layout shift anywhere else.

If anything is off, stop here and adjust the Tailwind class values; do not move to Task 2 yet.

- [ ] **Step 4: Commit**

```bash
cd d:\SmoothScroll
git add src/components/Sidebar.tsx
git commit -m "fix(ui): give sidebar items proper spacing and active state"
```

Expected output ends with `[master <hash>] fix(ui): give sidebar items proper spacing and active state`.

---

## Task 2: Auto-disable Windows apps toggle cleanup

**Files:**
- Modify: `src/components/settings/BehaviorSection.tsx` (extend `onAutoDisableWindowsApps` to remove stale entries on OFF)
- Test: `src/stores/settingsStore.test.ts` (add a coverage test that asserts the cleanup logic queries the right Tauri command)

We chose the test location as the store test because the store is the seam that calls `tauri.unassignAppProfile`. Putting the test there keeps the cleanup trigger testable without rendering React, and exercises the same path the handler will use at runtime.

---

- [ ] **Step 1: Write the failing test for the cleanup trigger**

Open `src/stores/settingsStore.test.ts`. The `vi.mock("@/lib/tauri", ...)` block at lines 33-44 already aliases `unassignAppProfile` to `mocks.mockUnassignAppProfile` — that is what we exercise.

Add a new `describe` block at the end of the outer `describe("settingsStore", ...)`, just before the closing `})` at line 431:

```tsx
  describe("auto-disable Windows apps toggle cleanup", () => {
    beforeEach(async () => {
      await act(async () => {
        await useSettingsStore.getState().load();
      });
    });

    it("removes stale __disabled__ entries from NATIVE_SMOOTH_SEED apps on toggle OFF", async () => {
      // Simulate legacy state where the user's settings file still carries
      // the entries seeded before seed_native_smooth_excludes became a no-op.
      const settingsWithStaleEntries = {
        ...mockSettings,
        auto_disable_windows_apps: true,
        app_profiles: {
          "Notepad.exe": "__disabled__",
          "SystemSettings.exe": "__disabled__",
          "chrome.exe": "profile-1", // user-added real assignment must NOT be touched
        },
      };
      useSettingsStore.setState({ settings: settingsWithStaleEntries });

      // Trigger patch with the new value (false = user just turned the toggle off).
      await act(async () => {
        useSettingsStore.getState().patch({ auto_disable_windows_apps: false });
        // After patch, unassignAppProfile is awaited sequentially per native app.
        // The test waits one microtask tick for the Promise chain.
        await Promise.resolve();
      });

      // The two native-smooth seeds with __disabled__ should be removed.
      expect(mocks.mockUnassignAppProfile).toHaveBeenCalledWith("Notepad.exe");
      expect(mocks.mockUnassignAppProfile).toHaveBeenCalledWith("SystemSettings.exe");
      // chrome.exe is a real user assignment and must NOT be touched.
      expect(mocks.mockUnassignAppProfile).not.toHaveBeenCalledWith("chrome.exe");
    });
  });
```

- [ ] **Step 2: Run the new test to verify it fails**

Run only this new describe block:
```bash
cd d:\SmoothScroll
pnpm exec vitest run src/stores/settingsStore.test.ts -t "removes stale __disabled__ entries"
```

Expected: this new test FAILS because the cleanup logic is not yet wired into `patch`. (If it passes for an unexpected reason, stop — the wiring is already present from a previous change; verify nothing else is calling these mocks, then skip to step 5.)

- [ ] **Step 3: Add a thin helper on the store for the cleanup**

Edit `src/stores/settingsStore.ts`. Find the `State` interface (lines 28-36) and add a new method signature right after `unassignAppProfile`:

```ts
  /** Cleanup stale __disabled__ entries for Windows native-smooth apps
   *  (legacy leftover from before seed_native_smooth_excludes became a no-op).
   *  No-op when auto_disable_windows_apps is true. */
  cleanupNativeDisabledApps: () => Promise<void>;
}
```

Inside the store factory body (right after the `unassignAppProfile` block at line 157-165), add the implementation:

```ts
  cleanupNativeDisabledApps: async () => {
    const current = get().settings;
    if (!current || current.auto_disable_windows_apps) return;
    const NATIVE_SEED = [
      "Notepad.exe",
      "SystemSettings.exe",
      "ApplicationFrameHost.exe",
      "CalculatorApp.exe",
      "Photos.exe",
      "WinStore.App.exe",
      "msedge.exe",
    ];
    for (const app of NATIVE_SEED) {
      if (current.app_profiles[app] === "__disabled__") {
        try {
          await tauri.unassignAppProfile(app);
        } catch (e) {
          console.error("cleanupNativeDisabledApps failed for", app, e);
        }
      }
    }
  },
```

Notes:
- The `NATIVE_SEED` list here is intentionally duplicated from the Rust source `crates/core/src/settings.rs` line 318. Cross-check before any future edit; they must match.
- Errors per app are swallowed because the cleanup is best-effort; failure to unassign one entry must not block the others. (At worst, the bug persists for that one app.)

- [ ] **Step 4: Wire `cleanupNativeDisabledApps` into `patch` and update the test**

Still in `src/stores/settingsStore.ts`, modify the `patch` function (lines 72-81):

```ts
  patch: (patch) => {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...patch };
    if (patch.theme && patch.theme !== current.theme) {
      applyTheme(patch.theme);
    }
    set({ settings: next });
    debouncedPersist(next);

    // ON -> OFF transition: drop legacy __disabled__ entries for native Windows apps.
    if (
      patch.auto_disable_windows_apps === false &&
      current.auto_disable_windows_apps === true
    ) {
      void get().cleanupNativeDisabledApps();
    }
  },
```

Now go back to the test you added in step 1 and update its body. The test as written calls `patch` and expects `unassignAppProfile` to be invoked. Keep the test identical — the new wiring should satisfy it.

- [ ] **Step 5: Re-run the test to verify it passes**

```bash
cd d:\SmoothScroll
pnpm exec vitest run src/stores/settingsStore.test.ts -t "removes stale __disabled__ entries"
```

Expected: PASS.

- [ ] **Step 6: Run the full store test file to confirm no regression**

```bash
cd d:\SmoothScroll
pnpm exec vitest run src/stores/settingsStore.test.ts
```

Expected: all existing tests still pass alongside the new one.

- [ ] **Step 7: Run TypeScript check**

```bash
cd d:\SmoothScroll
pnpm exec tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 8: Commit**

```bash
cd d:\SmoothScroll
git add src/stores/settingsStore.ts src/stores/settingsStore.test.ts
git commit -m "fix(settings): cleanup stale native-app __disabled__ entries on toggle OFF"
```

---

## Task 3: Manual end-to-end verification + release build

**Files:** None — pure verification.

---

- [ ] **Step 1: Seed a stale entry into the on-disk settings file**

Locate the live settings file. On Windows it is typically:
```
%APPDATA%\com.SmoothScroll.SmoothScroll\settings.json
```
Open it (close the running SmoothScroll process first). Find `app_profiles` and add or edit entries so that:

```json
"app_profiles": {
  "Notepad.exe": "__disabled__",
  "SystemSettings.exe": "__disabled__"
}
```

(Keep the rest of the file untouched.)

- [ ] **Step 2: Launch app in dev mode and reproduce the bug pre-fix**

```bash
cd d:\SmoothScroll
pnpm dev
```

Without our fix the toggle off has no effect — verify that we are reproducing the bug first by leaving tasks 1 and 2 already committed but rollback is not needed for this step (they are already in `master`); the focus is on the Behavior tab in the running app.

Open Settings → Behavior. Confirm the switch "Tự tắt trong app Windows" is ON. Flip it OFF. Click into Notepad. Scroll-wheel — the smoothness should NOT feel smooth (it is still being passed through), proving the cleanup didn't run yet... but actually with tasks 1+2 in place the fix should now work, so scroll SHOULD feel smooth. If scroll feels smooth, the fix is working. If not, the cleanup failed — investigate before proceeding.

- [ ] **Step 3: Verify settings persistence after toggle**

Quit the dev app cleanly. Re-open `%APPDATA%\com.SmoothScroll.SmoothScroll\settings.json`. Confirm:
- `"auto_disable_windows_apps": false`
- `"app_profiles"` no longer contains `"Notepad.exe"` or `"SystemSettings.exe"` keys (the native-seed entries are gone).

If entries linger, the cleanup logic missed them — re-check `NATIVE_SEED` list in `settingsStore.ts` against `crates/core/src/settings.rs` line 318 and the `patch` conditions in step 4 of Task 2.

- [ ] **Step 4: Flip toggle back ON for default state, commit ready-to-ship state**

Flip the switch back ON in the UI. Quit. Verify the on-disk file shows `"auto_disable_windows_apps": true` and `app_profiles` is unchanged. Stop the dev process with Ctrl+C.

- [ ] **Step 5: Build a local release exe (per `build-locally-before-push` workspace rule)**

```bash
cd d:\SmoothScroll
pnpm run build:wasm
cd src-tauri && npx tauri build
```

Watch the build output. Expected artifact locations:
```
src-tauri/target/release/bundle/nsis/SmoothScroll_<version>_x64-setup.exe
src-tauri/target/release/bundle/msi/SmoothScroll_<version>_x64_en-US.msi
```

(If the WASM build step is unnecessary because src/lib/engine-wasm/ is already populated, skip it. Check with `ls src/lib/engine-wasm/` first; if files are present, run only the second command.)

- [ ] **Step 6: Hand the .exe path off to the user for manual testing**

Do **not** push to master. Report the .exe path to the user and stop. The user will test and confirm before any push. (Per the standing rule `build-locally-before-push`.)

- [ ] **Step 7: Cleanup / out-of-band final commit (only if needed)**

If the manual test in step 2-3 surfaced any defect, fix it as a new commit; otherwise this plan is complete.

---

## Spec Coverage

| Spec section | Task |
|---|---|
| §4.1 sidebar className design | Task 1 (steps 1-2) |
| §4.2 cleanup logic | Task 2 (steps 3-4) |
| §6 manual testing checklist sidebar | Task 1 step 3 + Task 3 step 2 |
| §6 manual testing checklist toggle | Task 2 step 6 + Task 3 steps 2-4 |
| §6 automated test `cleanup_native_disabled_on_toggle_off` | Task 2 steps 1-2 (renamed in our impl to match vitest convention) |
| §7 rollout (local build before push) | Task 3 steps 5-6 |

All spec requirements are covered.

## Self-Review

- **Placeholders:** none. Every code block is complete, every command is exact.
- **Type consistency:** `cleanupNativeDisabledApps` is declared on `State`, implemented once in the factory body, and triggered from `patch`. The test exercises the same `mockUnassignAppProfile` Tauri alias as the production path.
- **DRY:** `NATIVE_SEED` is duplicated by necessity (frontend cannot import from a Rust crate at runtime); a comment points at the canonical source of truth so future edits stay aligned.
- **YAGNI:** No new files created. No abstraction layer added. No new Tauri command surface.
