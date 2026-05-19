# QoL Plan 2 — Current-app awareness in tray (Gap #3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tray panel shows the foreground app, its assigned profile, suggested category, and one-click controls to switch profile or disable smoothing for that app.

**Architecture:** Snapshot foreground process name into `AppState` *before* the tray panel steals focus, expose via new `get_foreground_app_context` IPC, render `<CurrentAppCard />` in the tray webview reusing existing `assign_app_profile` and exclude IPCs.

**Tech Stack:** Rust (Tauri 2), Windows `K32GetProcessImageFileNameW` already used by `WindowsProcessQuery::process_name_for_pid`, macOS `NSWorkspace::frontmostApplication`, React / TS, existing `<Select>` Radix primitive.

**Spec:** `docs/superpowers/specs/2026-05-19-qol-pass-design.md` § Gap #3

**Depends on:** none (independent of Plan 1).

---

## File map

| Action | Path | Purpose |
|---|---|---|
| Modify | `crates/platform/src/traits.rs` | Extend `ProcessQuery` with `foreground_process_name()` |
| Modify | `crates/platform/src/windows/process_query.rs` | Win impl: pid → name via existing `process_name_for_pid` |
| Modify | `crates/platform/src/macos/process_query.rs` | macOS impl: `NSRunningApplication.frontmostApplication` |
| Modify | `src-tauri/src/state.rs` | Add `last_foreground_at_tray_open: Arc<Mutex<Option<String>>>` |
| Modify | `src-tauri/src/tray.rs` | Snapshot foreground name before panel `show()` |
| Modify | `src-tauri/src/commands.rs` | Add `get_foreground_app_context` command |
| Modify | `src-tauri/src/lib.rs` | Register new command |
| Modify | `src/lib/tauri.ts` | Add `ForegroundAppContext` type |
| Create | `src/components/tray/CurrentAppCard.tsx` | New tray component |
| Modify | `src/components/TrayPanel.tsx` | Render `<CurrentAppCard />` at top |
| Modify | i18n locale files | Add `tray.current_app.*` keys |

---

## Task 1: Extend `ProcessQuery` trait with `foreground_process_name`

**Files:**
- Modify: `crates/platform/src/traits.rs`

- [ ] **Step 1: Add method**

In `crates/platform/src/traits.rs`, extend `ProcessQuery`:

```rust
pub trait ProcessQuery: Send + Sync {
    fn process_name_under_cursor(&self) -> Option<String>;
    fn foreground_process_id(&self) -> Option<u32>;
    fn list_visible_processes(&self) -> Vec<ProcessInfo>;

    /// Process name (file stem of executable) of the current foreground window.
    /// Returns None when there is no foreground window or query fails.
    /// Default impl resolves via `foreground_process_id` then platform-specific
    /// pid → name; Win/Mac override for efficiency.
    fn foreground_process_name(&self) -> Option<String> {
        // Default: subclasses are expected to override.
        None
    }
}
```

- [ ] **Step 2: Build**

```
cargo build -p smoothscroll_platform
```

Expected: success.

- [ ] **Step 3: Commit**

```
git add crates/platform/src/traits.rs
git commit -m "feat(platform): add foreground_process_name to ProcessQuery"
```

---

## Task 2: Windows impl

**Files:**
- Modify: `crates/platform/src/windows/process_query.rs`

- [ ] **Step 1: Add the impl method**

In `crates/platform/src/windows/process_query.rs`, inside `impl ProcessQuery for WindowsProcessQuery`, add (the existing helper `process_name_for_pid` is already exported in this file):

```rust
    fn foreground_process_name(&self) -> Option<String> {
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_null() {
            return None;
        }
        let mut pid: u32 = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        if pid == 0 {
            return None;
        }
        process_name_for_pid(pid)
    }
```

- [ ] **Step 2: Smoke test**

Append to the file:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::traits::ProcessQuery;

    #[test]
    fn foreground_process_name_does_not_panic() {
        let q = WindowsProcessQuery::new();
        let _ = q.foreground_process_name();
    }
}
```

Run:
```
cargo test -p smoothscroll_platform foreground_process_name
```

Expected: PASS.

- [ ] **Step 3: Commit**

```
git add crates/platform/src/windows/process_query.rs
git commit -m "feat(platform): Windows foreground_process_name"
```

---

## Task 3: macOS impl

**Files:**
- Modify: `crates/platform/src/macos/process_query.rs`

- [ ] **Step 1: Inspect file & deps**

Read the file. Confirm `NSWorkspace` is imported (it already is for accessibility-related code, see Plan 1 Task 6 for `objc2-app-kit`). If absent, add the dependency.

- [ ] **Step 2: Add method**

Inside the `impl ProcessQuery for MacosProcessQuery` block:

```rust
    fn foreground_process_name(&self) -> Option<String> {
        use objc2_app_kit::NSWorkspace;
        let workspace = unsafe { NSWorkspace::sharedWorkspace() };
        let app = unsafe { workspace.frontmostApplication() }?;
        // localizedName is what shows in the menu bar / Activity Monitor.
        // Use bundleIdentifier? — process_name has historically been the .exe stem
        // on Windows and the localized name on macOS. Match that convention.
        let name = unsafe { app.localizedName() }?;
        Some(name.to_string())
    }
```

- [ ] **Step 3: Smoke test**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::traits::ProcessQuery;

    #[test]
    fn foreground_process_name_does_not_panic() {
        let q = MacosProcessQuery::new();
        let _ = q.foreground_process_name();
    }
}
```

Run:
```
cargo test -p smoothscroll_platform foreground_process_name
```

Expected: PASS.

- [ ] **Step 4: Commit**

```
git add crates/platform/src/macos/process_query.rs crates/platform/Cargo.toml
git commit -m "feat(platform): macOS foreground_process_name"
```

---

## Task 4: Add `last_foreground_at_tray_open` to `AppState`

**Files:**
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/hook_wiring.rs` (test stubs only)

- [ ] **Step 1: Add field**

In `src-tauri/src/state.rs`:

```rust
    /// Foreground process snapshot taken right before the tray panel is shown.
    /// Consumed (taken) by `get_foreground_app_context` so a stale value does
    /// not leak between tray opens.
    pub last_foreground_at_tray_open: Arc<Mutex<Option<String>>>,
```

- [ ] **Step 2: Initialize in `lib.rs::run`**

In `src-tauri/src/lib.rs`, add to the `AppState { ... }` literal:

```rust
    last_foreground_at_tray_open: Arc::new(Mutex::new(None)),
```

- [ ] **Step 3: Initialize in test stubs**

In `src-tauri/src/hook_wiring.rs`, both `make_state` and `make_state_with_process` `AppState { ... }` literals get:

```rust
    last_foreground_at_tray_open: Arc::new(Mutex::new(None)),
```

- [ ] **Step 4: Build & test**

```
cargo build -p smoothscroll
cargo test -p smoothscroll
```

Expected: success.

- [ ] **Step 5: Commit**

```
git add src-tauri/src/state.rs src-tauri/src/lib.rs src-tauri/src/hook_wiring.rs
git commit -m "feat(app): AppState.last_foreground_at_tray_open"
```

---

## Task 5: Snapshot foreground process before tray panel show

**Files:**
- Modify: `src-tauri/src/tray.rs`

- [ ] **Step 1: Snapshot in `show_tray_panel`**

Modify `show_tray_panel` so it captures the foreground app **before** showing the panel (so the panel itself does not become foreground):

```rust
fn show_tray_panel<R: Runtime>(app: &AppHandle<R>) {
    // Capture foreground BEFORE showing the panel — otherwise the panel becomes
    // the foreground window and we lose the user's actual context.
    if let Some(state) = app.try_state::<Arc<AppState>>() {
        let name = state.processes.foreground_process_name();
        *state.last_foreground_at_tray_open.lock() = name;
    }

    if let Some(win) = app.get_webview_window(PANEL_LABEL) {
        position_panel_at_cursor(app, &win);
        let _ = win.show();
        let _ = win.set_focus();
    }
}
```

- [ ] **Step 2: Same for tray right-click branch**

In `init`, the right-click branch already calls `show_tray_panel(&app)` — so the snapshot logic is centralized via the function above. Verify by reading the right-click branch.

- [ ] **Step 3: Build**

```
cargo build -p smoothscroll
```

Expected: success.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/tray.rs
git commit -m "feat(app): snapshot foreground before tray panel show"
```

---

## Task 6: `get_foreground_app_context` IPC command

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs` (register handler)

- [ ] **Step 1: Define response struct**

At the top of `commands.rs`, near other `#[derive(Serialize)]` types:

```rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct ForegroundAppContext {
    pub process_name: Option<String>,
    pub suggested_category: Option<smoothscroll_core::app_categories::AppCategory>,
    pub suggested_category_label: Option<String>,
    pub current_profile_id: Option<String>,
    pub is_excluded: bool,
}
```

- [ ] **Step 2: Implement command**

```rust
#[tauri::command]
pub fn get_foreground_app_context(
    state: State<'_, Arc<AppState>>,
) -> ForegroundAppContext {
    use smoothscroll_core::app_categories::classify_app;

    // Take (consume) the tray-time snapshot. Fall back to a live query if
    // the snapshot is empty (e.g., this command was invoked outside tray flow).
    let process_name = {
        let mut guard = state.last_foreground_at_tray_open.lock();
        guard.take()
    }.or_else(|| state.processes.foreground_process_name());

    let Some(name) = process_name.as_ref() else {
        return ForegroundAppContext {
            process_name: None,
            suggested_category: None,
            suggested_category_label: None,
            current_profile_id: None,
            is_excluded: false,
        };
    };

    let category = classify_app(name);
    let s = state.settings.read();
    let is_excluded = s.is_excluded(name);
    let current_profile_id = s.app_profiles.get(name).cloned();

    ForegroundAppContext {
        process_name: Some(name.clone()),
        suggested_category: Some(category),
        suggested_category_label: Some(category.label().to_string()),
        current_profile_id,
        is_excluded,
    }
}
```

- [ ] **Step 3: Register**

In `src-tauri/src/lib.rs`, add to `tauri::generate_handler![...]`:

```rust
            commands::get_foreground_app_context,
```

- [ ] **Step 4: Build**

```
cargo build -p smoothscroll
```

Expected: success.

- [ ] **Step 5: Smoke test**

Add an integration test in `src-tauri/src/commands.rs` (gated `#[cfg(test)]`) — but most coverage will be at the React component level. For the Rust side, add a regression test in `hook_wiring.rs::tests` using `make_state_with_process`:

(Skip this step if the testing harness for commands is too involved; the React-side test in Task 9 covers the contract.)

- [ ] **Step 6: Commit**

```
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(app): get_foreground_app_context IPC command"
```

---

## Task 7: Frontend types

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add type**

```typescript
export type AppCategory =
  | "Browser"
  | "IDE"
  | "Terminal"
  | "Office"
  | "Creative"
  | "Communication"
  | "Reader"
  | "Game"
  | "Other";

export interface ForegroundAppContext {
  process_name: string | null;
  suggested_category: AppCategory | null;
  suggested_category_label: string | null;
  current_profile_id: string | null;
  is_excluded: boolean;
}
```

(Confirm exact `AppCategory` variants by reading `crates/core/src/app_categories.rs` first — replace the union above with the actual variants.)

- [ ] **Step 2: TS check**

```
pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/lib/tauri.ts
git commit -m "feat(ui): ForegroundAppContext type"
```

---

## Task 8: `<CurrentAppCard />` component

**Files:**
- Create: `src/components/tray/CurrentAppCard.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ForegroundAppContext, AppSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

const DISABLED_PROFILE_ID = "__disabled__";
const DEFAULT_VALUE = "__default__"; // sentinel for "no profile assigned"

export function CurrentAppCard() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings) as AppSettings | null;
  const profiles = settings?.profiles ?? [];

  const [ctx, setCtx] = useState<ForegroundAppContext | null>(null);

  const refresh = useCallback(async () => {
    try {
      const c = await invoke<ForegroundAppContext>("get_foreground_app_context");
      setCtx(c);
    } catch {
      setCtx(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const un = listen("settings-changed", () => void refresh());
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => {
      un.then((u) => u()).catch(() => {});
      window.clearInterval(interval);
    };
  }, [refresh]);

  if (!ctx?.process_name) return null;

  const currentValue = ctx.is_excluded
    ? DISABLED_PROFILE_ID
    : (ctx.current_profile_id ?? DEFAULT_VALUE);

  const onSelect = async (value: string) => {
    const name = ctx.process_name!;
    if (value === DEFAULT_VALUE) {
      await invoke("unassign_app_profile", { processName: name });
      await invoke("remove_excluded_app", { name });
    } else if (value === DISABLED_PROFILE_ID) {
      await invoke("assign_app_profile", { processName: name, profileId: DISABLED_PROFILE_ID });
    } else {
      await invoke("assign_app_profile", { processName: name, profileId: value });
    }
    await refresh();
  };

  const onToggleDisable = async (checked: boolean) => {
    const name = ctx.process_name!;
    if (checked) {
      await invoke("assign_app_profile", { processName: name, profileId: DISABLED_PROFILE_ID });
    } else {
      await invoke("unassign_app_profile", { processName: name });
    }
    await refresh();
  };

  return (
    <div className="mx-2 my-2 rounded-lg border border-border bg-accent/30 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("tray.current_app.heading")}
      </div>
      <div className="mt-1 truncate text-sm font-medium">{ctx.process_name}</div>
      {ctx.suggested_category_label && (
        <div className="text-xs text-muted-foreground">
          {t("tray.current_app.category", { category: ctx.suggested_category_label })}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("tray.current_app.profile")}</span>
        <Select value={currentValue} onValueChange={onSelect}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VALUE}>{t("tray.current_app.default")}</SelectItem>
            <SelectItem value={DISABLED_PROFILE_ID}>{t("tray.current_app.disabled")}</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs">
        <Switch
          checked={ctx.is_excluded}
          onCheckedChange={onToggleDisable}
        />
        <span>{t("tray.current_app.disable_for_this_app")}</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: TS check**

```
pnpm tsc --noEmit
```

Expected: clean (after adding i18n keys in Task 10).

- [ ] **Step 3: Commit**

```
git add src/components/tray/CurrentAppCard.tsx
git commit -m "feat(ui): CurrentAppCard component"
```

---

## Task 9: Render `<CurrentAppCard />` in TrayPanel

**Files:**
- Modify: `src/components/TrayPanel.tsx`

- [ ] **Step 1: Add import & render**

After the header `<div>` and before "Quick Access" section in `TrayPanel.tsx`:

```tsx
import { CurrentAppCard } from "./tray/CurrentAppCard";
```

```tsx
{/* Current foreground app */}
<CurrentAppCard />
```

- [ ] **Step 2: Manual smoke**

```
pnpm tauri dev
```

- Right-click tray with Notepad open → card shows "Notepad", category Other / Reader, profile Default, toggle off
- Toggle "Disable for this app" → settings-changed fires → re-fetch → toggle stays on
- Open the dropdown, select Disabled / Default / a profile → committed and reflected after refresh

- [ ] **Step 3: Commit**

```
git add src/components/TrayPanel.tsx
git commit -m "feat(ui): show CurrentAppCard at top of tray panel"
```

---

## Task 10: i18n keys

**Files:**
- Modify: English locale file (and any others ready for translation)

- [ ] **Step 1: Add keys**

```json
"tray": {
  "current_app": {
    "heading": "Current app",
    "category": "Category: {{category}}",
    "profile": "Profile",
    "default": "Default",
    "disabled": "Disabled (pass-through)",
    "disable_for_this_app": "Disable smoothing for this app"
  },
  "...existing tray keys...": {}
}
```

(Merge into existing `tray` block — do not duplicate.)

- [ ] **Step 2: Verify renders**

```
pnpm tauri dev
```

Reopen tray. All strings localized correctly.

- [ ] **Step 3: Commit**

```
git add src/i18n/...
git commit -m "feat(ui): tray.current_app i18n keys"
```

---

## Task 11: Final verification

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

Expected: clean.

- [ ] **Step 3: Manual smoke matrix**

| Foreground app | Profiles defined | Expected card |
|---|---|---|
| Notepad | none | Process="notepad", Profile=Default, Disabled toggle off |
| (none — Desktop) | any | Card hidden |
| Photoshop | "Creative" profile assigned | Card shows profile selected; switching to Default unassigns |
| Anything | n/a | Toggle "Disable" sets exclude; turning off removes |

- [ ] **Step 4: Commit if needed**

```
git status
```

Expected: clean.
