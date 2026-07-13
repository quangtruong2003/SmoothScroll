# Tray Panel Profile Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users assign a profile to the foreground app directly from the tray panel using a small inline profile picker without opening Settings.

**Architecture:** Extract foreground-app polling into a shared `useForegroundApp` hook, add a conditionally-rendered `ProfilePill` beneath `CurrentAppCard`, and open a lightweight `ProfilePickerPopover` listbox that calls the existing `assignAppProfile`/`unassignAppProfile` store actions. CSS is purely additive (`tray-profile-*` classes) to avoid layout regressions.

**Tech Stack:** React 19 + TypeScript, Zustand store, Tauri2 invoke/listen, shared `tray-row` CSS system, Vitest + Testing Library

## Global Constraints

- Preserve existing tray behavior and `CurrentAppCard` on/off logic.
- `ProfilePill` renders only when `settings.profiles.length > 0` AND a foreground app is detected AND platform is not Linux.
- No new IPC commands or backend changes.
- No toast/confirm; apply on click. If apply fails, keep popover open (matches existing error handling style).
- Add only these i18n keys: `tray.profile_label`, `tray.profile_default`, `tray.profile_disable`, `tray.profile_disabled`, `tray.profile_manage`.

---

## File Structure

### New Files

| Path | Responsibility |
|---|---|
| `src/hooks/useForegroundApp.ts` | Shared foreground-app fetch + 2s refresh + `settings-changed` listener |
| `src/components/tray/ProfilePill.tsx` | Inline pill row beneath current app card; owns popover toggle |
| `src/components/tray/ProfilePickerPopover.tsx` | Anchored listbox popover; keyboard + apply-on-click |
| `src/hooks/__tests__/useForegroundApp.test.tsx` | Unit tests for hook contract |
| `src/components/tray/__tests__/ProfilePill.test.tsx` | Unit tests for pill render + store calls |

### Modified Files

| Path | What changes |
|---|---|
| `src/components/tray/CurrentAppCard.tsx` | Swap local state/effects for `useForegroundApp()` |
| `src/components/TrayPanel.tsx` | Render `<ProfilePill />` under `<CurrentAppCard />` when visible |
| `src/index.css` | Add minimal `.tray-profile-*` classes |
| `src/i18n/locales/*.json` | Add profile picker i18n keys to all 14 locale files |

---

## Tasks

### Task 1: Extract shared foreground app hook

**Files:**

- Create: `src/hooks/useForegroundApp.ts`
- Modify: `src/components/tray/CurrentAppCard.tsx`
- Test: `src/hooks/__tests__/useForegroundApp.test.tsx`

**Interfaces:**

- Consumes: existing Tauri listener/events
- Produces: `export function useForegroundApp(): { ctx: ForegroundAppContext | null; refresh: () => Promise<void> }`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/hooks/__tests__/useForegroundApp.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useForegroundApp } from '../useForegroundApp';
import { tauri } from '@/lib/tauri';

vi.mock('@/lib/tauri', () => ({
  tauri: {
    getForegroundAppContext: vi.fn().mockResolvedValue({
      process_name: 'chrome.exe',
      current_profile_id: null,
      is_excluded: false,
    }),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

test('fetches foreground context on mount', async () => {
  const { result } = renderHook(() => useForegroundApp());
  expect(result.current.ctx).toBeNull();
  await act(async () => {});
  expect(result.current.ctx?.process_name).toBe('chrome.exe');
});

test('refresh updates context', async () => {
  const { result } = renderHook(() => useForegroundApp());
  await act(async () => {});
  (tauri.getForegroundAppContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    process_name: 'code.exe',
    current_profile_id: 'p1',
    is_excluded: false,
  });
  await act(async () => result.current.refresh());
  expect(result.current.ctx?.process_name).toBe('code.exe');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/hooks/__tests__/useForegroundApp.test.tsx --reporter verbose`

Expected: FAIL because `src/hooks/useForegroundApp.ts` does not exist yet.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useForegroundApp.ts
import { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { tauri, type ForegroundAppContext } from '@/lib/tauri';

const POLL_INTERVAL_MS = 2000;

export function useForegroundApp(): {
  ctx: ForegroundAppContext | null;
  refresh: () => Promise<void>;
} {
  const [ctx, setCtx] = useState<ForegroundAppContext | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await tauri.getForegroundAppContext();
      setCtx(next);
    } catch {
      setCtx(null);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const unlisten = listen('settings-changed', () => void refresh());
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);

    return () => {
      void unlisten.then((u) => u()).catch(() => {});
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { ctx, refresh };
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run src/hooks/__tests__/useForegroundApp.test.tsx --reporter verbose`

Expected: PASS for both tests.

- [ ] **Step 5: Refactor CurrentAppCard.tsx to use the hook**

```tsx
// src/components/tray/CurrentAppCard.tsx (partial)
import { useCallback } from 'react';
import { useForegroundApp } from '@/hooks/useForegroundApp';
import { tauri } from '@/lib/tauri';

export function CurrentAppCard() {
  const { ctx, refresh } = useForegroundApp();

  const handleToggle = useCallback(async (enabled: boolean) => {
    const name = ctx?.process_name;
    if (!name) return;
    if (enabled) {
      await tauri.unassignAppProfile(name).catch(() => {});
    } else {
      await tauri.assignAppProfile(name, '__disabled__').catch(() => {});
    }
    await refresh();
  }, [ctx?.process_name, refresh]);

  // ...rest unchanged
}
```

- [ ] **Step 6: Run tray build checks**

Run: `pnpm tsc --noEmit --pretty false && pnpm vitest run src/components/tray --reporter verbose`

Expected: TypeScript clean; existing tray tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useForegroundApp.ts src/hooks/__tests__/useForegroundApp.test.tsx src/components/tray/CurrentAppCard.tsx
git -c attributions.disabled=true commit -m "refactor: extract shared foreground app hook for tray"
```

---

### Task 2: Implement ProfilePill with popover

**Files:**

- Create: `src/components/tray/ProfilePill.tsx`
- Create: `src/components/tray/ProfilePickerPopover.tsx`
- Test: `src/components/tray/__tests__/ProfilePill.test.tsx`

**Interfaces:**

- Consumes: `useForegroundApp()`, `useSettingsStore` (settings + assign/unassign actions)
- Produces: `export function ProfilePill(): React.ReactNode`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/tray/__tests__/ProfilePill.test.tsx
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePill } from '../ProfilePill';
import { useSettingsStore } from '@/stores/settingsStore';

const mockInvoke = vi.fn();

vi.mock('@/hooks/useForegroundApp', () => ({
  useForegroundApp: () => ({
    ctx: {
      process_name: 'Notepad.exe',
      current_profile_id: 'p1',
      is_excluded: false,
    },
    refresh: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

beforeEach(() => {
  useSettingsStore.setState({
    settings: {
      profiles: [{ id: 'p1', name: 'Reading', step_size_px: 80, animation_time_ms: 200, acceleration_max: 1.5, tail_to_head_ratio: 0.7, animation_easing: true, easing_mode: 'ExponentialOut', reverse_wheel_direction: false, horizontal_smoothness: false }],
      app_profiles: { 'Notepad.exe': 'p1' },
    },
  } as any);
  mockInvoke.mockResolvedValue(null);
});

test('renders current profile name', () => {
  render(<ProfilePill />);
  expect(screen.getByText(/Reading/)).toBeInTheDocument();
});

test('opens popover on click and selects disable option', async () => {
  render(<ProfilePill />);
  await userEvent.click(screen.getByRole('button', { name: /profile/i }));
  const listbox = await screen.findByRole('listbox');
  await userEvent.click(within(listbox).getByRole('option', { name: /disable for this app/i }));
  expect(mockInvoke).toHaveBeenCalledWith('assign_app_profile', { processName: 'Notepad.exe', profileId: '__disabled__' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnvitest run src/components/tray/__tests__/ProfilePill.test.tsx --reporter verbose`

Expected: FAIL because `ProfilePill.tsx` does not exist yet.

- [ ] **Step 3: Implement ProfilePill.tsx**

```tsx
// src/components/tray/ProfilePill.tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { useForegroundApp } from '@/hooks/useForegroundApp';
import { useSettingsStore } from '@/stores/settingsStore';
import { ProfilePickerPopover } from './ProfilePickerPopover';

export function ProfilePill(): React.ReactNode | null {
  const { t } = useTranslation();
  const { ctx } = useForegroundApp();
  const settings = useSettingsStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const profiles = settings?.profiles ?? [];
  const processName = ctx?.process_name ?? '';
  const profileId = processName ? settings?.app_profiles[processName] : undefined;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!processName || profiles.length === 0) return null;

  const selectedLabel = ctx?.is_excluded
    ? t('tray.profile_disabled')
    : profiles.find((p) => p.id === profileId)?.name ?? t('tray.profile_default');

  return (
    <div ref={rootRef} className="tray-row">
      <span className="tray-row-label tray-profile-pill-label">
        {t('tray.profile_label')}: {selectedLabel}
      </span>
      <button
        type="button"
        className="tray-row-icon"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <ProfilePickerPopover
          processName={processName}
          selectedProfileId={profileId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement ProfilePickerPopover.tsx**

```tsx
// src/components/tray/ProfilePickerPopover.tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Check, Ban, Globe } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  processName: string;
  selectedProfileId?: string;
  onClose: () => void;
}

export function ProfilePickerPopover({ processName, selectedProfileId, onClose }: Props) {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const ref = useRef<HTMLDivElement | null>(null);

  const profiles = (settings?.profiles ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .slice(0, 8);

  const apply = async (profileId: string | null) => {
    try {
      if (profileId === null) {
        await invoke('unassign_app_profile', { processName });
      } else {
        await invoke('assign_app_profile', { processName, profileId });
      }
      onClose();
    } catch {
      // keep popover open for retry
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="tray-profile-popover" role="listbox" tabIndex={-1}>
      <button
        type="button"
        role="option"
        aria-selected={selectedProfileId === undefined}
        className="tray-profile-option"
        onClick={() => apply(null)}
      >
        <Globe className="h-4 w-4" />
        <span>{t('tray.profile_default')}</span>
        {selectedProfileId === undefined && <Check className="ml-auto h-4 w-4" />}
      </button>
      <button
        type="button"
        role="option"
        aria-selected={selectedProfileId === '__disabled__'}
        className="tray-profile-option"
        onClick={() => apply('__disabled__')}
      >
        <Ban className="h-4 w-4" />
        <span>{t('tray.profile_disable')}</span>
        {selectedProfileId === '__disabled__' && <Check className="ml-auto h-4 w-4" />}
      </button>
      <div className="tray-profile-divider" />
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={selectedProfileId === p.id}
          className="tray-profile-option"
          onClick={() => apply(p.id)}
        >
          <span>{p.name}</span>
          {selectedProfileId === p.id && <Check className="ml-auto h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests again**

Run: `pnpm vitest run src/components/tray/__tests__/ProfilePill.test.tsx --reporter verbose`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/tray/ProfilePill.tsx src/components/tray/ProfilePickerPopover.tsx src/components/tray/__tests__/ProfilePill.test.tsx
git -c attributions.disabled=true commit -m "feat: add tray profile pill and popover"
```

---

### Task 3: Add i18n keys and CSS classes

**Files:**

- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/vi.json`
- Modify: `src/i18n/locales/de.json`, `src/i18n/locales/es.json`, `src/i18n/locales/fr.json`, `src/i18n/locales/hi.json`, `src/i18n/locales/id.json`, `src/i18n/locales/it.json`, `src/i18n/locales/ja.json`, `src/i18n/locales/ko.json`, `src/i18n/locales/pt-BR.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/tr.json`, `src/i18n/locales/zh.json`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: none
- Produces: CSS classes `tray-profile-*`, i18n keys used by `ProfilePill` and `ProfilePickerPopover`

- [ ] **Step 1: Add i18n keys to English**

```json
// src/i18n/locales/en.json inside "tray": { ... }
{
  "tray": {
    "profile_label": "Profile",
    "profile_default": "Default (global)",
    "profile_disable": "Disable for this app",
    "profile_disabled": "Disabled",
    "profile_manage": "Manage profiles…"
  }
}
```

- [ ] **Step 2: Add i18n keys to Vietnamese**

```json
// src/i18n/locales/vi.json inside "tray": { ... }
{
  "tray": {
    "profile_label": "Hồ sơ",
    "profile_default": "Mặc định (global)",
    "profile_disable": "Tắt cho ứng dụng này",
    "profile_disabled": "Đã tắt",
    "profile_manage": "Quản lý hồ sơ…"
  }
}
```

- [ ] **Step 3: Mirror keys to remaining 12 locale files (same English text as fallback)**

For each remaining `src/i18n/locales/<lang>.json`, add the same five keys under `"tray"` to avoid missing-key warnings. Translators can refine later.

- [ ] **Step 4: Add minimal CSS classes**

```css
/* src/index.css — append in tray section */
.tray-profile-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  margin: 4px 0;
  background: var(--tray-muted, rgba(255,255,255,0.03));
  border: 1px solid var(--tray-border, rgba(255,255,255,0.06));
  border-radius: 8px;
  font-size: 12px;
  color: var(--tray-text-secondary, rgba(255,255,255,0.7));
}

.tray-profile-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  width: 100%;
  z-index: 50;
  background: var(--tray-surface, rgba(30,30,35,0.98));
  border: 1px solid var(--tray-border, rgba(255,255,255,0.08));
  border-radius: 10px;
  padding: 4px 0;
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 28px rgba(0,0,0,0.3);
}

.tray-profile-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--tray-text, rgba(255,255,255,0.9));
  background: transparent;
  border: none;
}

.tray-profile-option[aria-selected="true"] {
  background: rgba(108,92,231,0.12);
}

.tray-profile-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--tray-border, rgba(255,255,255,0.06));
}
```

- [ ] **Step 5: Run type checks**

Run: `pnpm tsc --noEmit --pretty false`

Expected: Clean exit, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales src/index.css
git -c attributions.disabled=true commit -m "feat: add tray profile picker i18n and styles"
```

---

### Task 4: Wire ProfilePill into TrayPanel and build

**Files:**

- Modify: `src/components/TrayPanel.tsx`

**Interfaces:**

- Consumes: `ProfilePill` component
- Produces: visible tray UI for the smoke tests in the spec

- [ ] **Step 1: Add ProfilePill import and render it in tray-content**

```tsx
// src/components/TrayPanel.tsx (partial)
import { ProfilePill } from './tray/ProfilePill';

// inside tray-content, directly under the CurrentAppCard tray-section:
{!IS_LINUX && (
  <div className="tray-section">
    <CurrentAppCard />
    <ProfilePill />
  </div>
)}
```

- [ ] **Step 2: Run app build and quick smoke**

Run: `pnpm tsc --noEmit --pretty false`

Expected: TypeScript clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrayPanel.tsx
git -c attributions.disabled=true commit -m "feat: integrate profile picker into tray panel"
```

---

## Verification (matches spec)

- [ ] With 0 profiles: pill absent
- [ ] With ≥1 profile + foreground assigned: pill shows profile name; popover tick matches
- [ ] With ≥1 profile + unassigned: pill shows “Default (global)”; Default selected
- [ ] With ≥1 profile + disabled toggle: pill shows “Disabled”
- [ ] Click pill → popover opens; click outside/Esc → closes
- [ ] Click profile → applies immediately, popover closes
- [ ] New profile created in Settings → tray shows it without restart
- [ ] Delete all profiles → pill disappears
- [ ] `pnpm tsc --noEmit` passes; `pnpm tauri build` works
