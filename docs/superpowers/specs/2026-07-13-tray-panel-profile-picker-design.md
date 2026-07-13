# Tray Panel Profile Picker Design

**Date**: 2026-07-13
**Status**: Approved
**Goal**: Add a per-foreground-app profile picker below the existing `CurrentAppCard` in the Windows tray panel, so users can switch profiles (or default/disable) for the active app without opening Settings.

## Current State

Tray panel (`src/components/TrayPanel.tsx`) shows, inside the `tray-section`:

1. `CurrentAppCard` — foreground app icon + name + on/off Switch for *that app*.
2. Global toggles (Smooth Scrolling, Start with OS).
3. Divider.
4. Action rows (Open Settings, Quit).

The trait the user is missing: there is **no quick way** to assign/change a `ScrollProfile` for the foreground app from the tray. They must open Settings → scroll to Per-App Profiles. The backend already supports this (`assign_app_profile`, `unassign_app_profile`), and `CurrentAppCard` already sees a `ForegroundAppContext` carrying `current_profile_id` and `is_excluded`.

## Target State

```
┌─────────────────────────────────┐
│ ● SmoothScroll    ON            │  ← Header
├─────────────────────────────────┤
│ 📝 Microsoft Word      [●]      │  ← CurrentAppCard (unchanged)
│ Profile: Reading        ▾       │  ← ProfilePill (new, conditional)
├─────────────────────────────────┤
│ Smooth Scrolling       [●]      │
│ Start with Windows     [●]      │
├─────────────────────────────────┤
│ ⚙ Open Settings                 │
│ ⚠ Quit                          │
└─────────────────────────────────┘
```

`ProfilePill` opens a popover anchored to the row:

```
┌─ popover ─────────────────┐
│ ◌  Default (global)       │   ← unassign_app_profile
│ ⊘  Disable for this app   │   ← assign "__disabled__"
│ ─────────────────────────│
│ ▸ Coder                   │   ← assign <id>
│ ● Reading           ✓     │
│   Snappy                  │
└───────────────────────────┘
```

`ProfilePill` only renders when BOTH conditions hold:
- `settings.profiles.length > 0` (user has at least one profile)
- Foreground app detected (`ctx.process_name` truthy) and not Linux

## Architecture

Three new units, one small refactor of an existing one.

### Unit 1 — `useForegroundApp` hook (new)
- **Does**: fetches `ForegroundAppContext` on mount, listens `settings-changed` to refresh, polls every 2 s as a compatibility fallback (same cadence `CurrentAppCard` had).
- **Returns**: `{ ctx, refresh }`. `ctx === null` while loading or on error.
- **Used by**: `CurrentAppCard` (replaces inline `useState`+`useEffect`), `ProfilePill`.

### Unit 2 — `ProfilePill` component (new)
- **Does**: renders `tray-profile-pill` row beneath `CurrentAppCard`. Click toggles popover open. Re-derives label from `ctx` + `profiles` (`Disabled` / profile name / `Default`).
- **Does not**: open Settings by itself; no manual focus trap (delegated to popover).

### Unit 3 — `ProfilePickerPopover` component (new)
- **Does**: listbox with three sections, keyboard nav (↑/↓/Enter/Esc), click-outside close, focus trap while open, anchor-aware flip if it overflows viewport bottom.
- **Options** in order:
  1. **Default (global)** → calls `unassignAppProfile(processName)`. Marks `app_profiles[processName]` absent.
  2. **Disable for this app** → calls `assignAppProfile(processName, "__disabled__")`.
  3. *divider*
  4. User profiles sorted by `name` (locale-aware). If count > 8, render first 7 + a "Manage profiles…" row → invokes the existing `handleOpenSettings`.
- **Tick**: an `aria-selected` row shows a `✓` next to the active profile. Disabled row uses a different icon (not a tick) when active.

### Refactor — `CurrentAppCard.tsx`
- Swap its local `useState`/`useEffect` for `useForegroundApp()`. Behavior identical. Required so `ProfilePill` and `CurrentAppCard` cannot fight each other over the foreground state.

## Data Flow

```
settings (zustand) ─┐
                    ├─► useForegroundApp() ─► ProfilePill ─► ProfilePickerPopover
foreground ipc   ───┘                          │
                                               └─► CurrentAppCard

When user clicks an option in popover:
  unassignAppProfile(name)  | assignAppProfile(name, "__disabled__")
                         \  |  /
                          ▼ ▼
              settingsStore (optimistic mutation via existing actions)
                         │
                         └─► both components re-derive from same source
```

- The two existing store actions `assignAppProfile(processName, profileId)` / `unassignAppProfile(processName)` already perform optimistic local mutation. We DO NOT add new store actions.
- No custom event emitters; rely on `listen('settings-changed')` already handled inside `useForegroundApp`.

## Error Handling

| Case | Handling |
|---|---|
| `invoke` throws on apply | Catch silently, log `console.error`, keep popover open so user can retry. Mirrors `CurrentAppCard.handleToggle` today. |
| `processName` becomes empty mid-flow | `ProfilePill` already guarded — returns `null` and the popover cannot open. |
| Profile in `current_profile_id` was deleted | Fallback label = "Default (global)". Tick won't render for an unknown id. |
| Popover overflows below viewport | Flip above the pill; if still doesn't fit, clamp to available height with internal scroll. |
| Esc / click outside while open | Closes. No state mutation. |
| `settings.profiles` empties while open | Popover closes (effect watches length), pill unmounts. |

## UI States

- **Idle (no profile, no app, or Linux)**: pill not rendered.
- **Idle with profile, app detected**: pill shows "Profile: \<name or Default or Disabled\>".
- **Open**: popover with focus on currently selected row (or "Default" if none).
- **Applying** (instant): popover closes same frame; no spinner (invokes are fast; optimistic).
- **Failed**: popover stays open; no toast, no shake — quiet retry.

## a11y

- Pill: `<button>` with `aria-haspopup="listbox"`, `aria-expanded`.
- Popover: `role="listbox"`; options `role="option"` with `aria-selected`.
- Keyboard: ↑/↓ cycle, Enter applies+closes, Esc closes, Tab closes (focus to next focusable in DOM order).
- Focus trap inside popover while open. Restore focus to pill on close.
- Reduced motion: no animation; the popover just appears.

## Files To Modify

1. **NEW** `src/hooks/useForegroundApp.ts` — extract foreground fetch/refresh.
2. **NEW** `src/components/tray/ProfilePill.tsx` — pill row + caret.
3. **NEW** `src/components/tray/ProfilePickerPopover.tsx` — listbox popover with keyboard + click-outside.
4. **MODIFY** `src/components/tray/CurrentAppCard.tsx` — replace local state with `useForegroundApp()`; no behavior change.
5. **MODIFY** `src/components/TrayPanel.tsx` — render `<ProfilePill>` directly under `<CurrentAppCard>` inside the same `tray-section`, both wrapped in a single guard.
6. **MODIFY** `src/index.css` — add `.tray-profile-pill`, `.tray-profile-popover`, `.tray-profile-option`, `.tray-profile-divider` classes. Do NOT modify existing tray-row classes.
7. **MODIFY** `src/locales/en.json`, `src/locales/vi.json` — add:
   - `tray.profile_label` = "Profile"
   - `tray.profile_default` = "Default (global)"
   - `tray.profile_disable` = "Disable for this app"
   - `tray.profile_disabled` = "Disabled"
   - `tray.profile_manage` = "Manage profiles…"

## Out Of Scope (NOT touched)

- Rust backend (`assign_app_profile`, `unassign_app_profile` already exist).
- `ResizeObserver` panel auto-fit.
- Theme handling, autostart toggle, Open Settings / Quit flows.
- i18n keys outside the listed strings.
- Linux tray (Linux already lacks per-app foreground context; existing guard is preserved).
- Search/filter inside popover (over-engineering — user has at most a handful of profiles).

## Verification

Manual smoke (after `pnpm tauri build` → run exe):
- [ ] With 0 profiles: pill absent.
- [ ] With ≥1 profile + foreground has assigned profile: pill shows that name with caret; popover tick matches.
- [ ] With ≥1 profile + foreground unassigned: pill shows "Default (global)"; popover tick on Default.
- [ ] With ≥1 profile + foreground disabled (toggle off): pill shows "Disabled".
- [ ] Click pill → popover opens, focus on currently-selected row.
- [ ] Click "Disable for this app" → popover closes, `CurrentAppCard` Switch flips off (visual consistency).
- [ ] Click a profile → popover closes, no toast, tray panel still open.
- [ ] Esc closes. Click outside closes.
- [ ] Create a new profile in Settings, return to tray — pill reflects without restart.
- [ ] Delete all profiles in Settings — pill vanishes.
- [ ] Keyboard-only: tab into pill, Enter opens, ↓↓ Enter selects focused option.
- [ ] Reduce-motion OS setting: popover instant, no transition.
- [ ] Linux/macOS behavior unchanged.

Build verification:
- [ ] `pnpm tsc --noEmit` passes.
- [ ] `pnpm tauri build` produces working `.exe`.

## Notes

- The two existing store actions already cover optimistic local mutation + persistence; no backend wiring required.
- One small refactor (`useForegroundApp` extraction) is included because both consumers need identical source-of-truth polling. This is a targeted improvement, not unrelated cleanup.
