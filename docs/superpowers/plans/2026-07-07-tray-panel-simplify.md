# Tray Panel Simplify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify Windows tray panel by removing unnecessary items, section labels, and footer while keeping high UX/UI quality

**Architecture:** Modify React components (TrayPanel.tsx, CurrentAppCard.tsx) to remove unwanted UI elements. No new IPC commands needed - reuse existing settings store for per-app toggle.

**Tech Stack:** React, TypeScript, Tauri IPC, Zustand, Lucide icons, Radix UI Switch

## Global Constraints

- Visual style: Keep current Windows semi-transparent background, blur, rounded corners
- No new dependencies
- Maintain existing functionality for kept items
- Cross-platform: Changes apply to Windows; macOS/Linux may need separate handling

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/components/TrayPanel.tsx` | Modify | Remove SectionLabel, unused MenuItems, footer |
| `src/components/tray/CurrentAppCard.tsx` | Modify | Simplify to single-row with toggle |
| `src/index.css` | Modify | Remove unused section label styles (if applicable) |

---

### Task 1: Simplify TrayPanel.tsx - Remove Section Labels

**Files:**
- Modify: `src/components/TrayPanel.tsx:80-86` (SectionLabel component)
- Modify: `src/components/TrayPanel.tsx:228,260` (SectionLabel usage)

**Interfaces:**
- Consumes: None
- Produces: SectionLabel component removed, JSX simplified

- [ ] **Step 1: Remove SectionLabel component definition**

Delete lines 80-86 in `src/components/TrayPanel.tsx`:

```tsx
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="tray-section-label">
      <span>{children}</span>
    </div>
  );
}
```

- [ ] **Step 2: Remove SectionLabel usage from JSX**

In `src/components/TrayPanel.tsx`, delete these lines (around 228 and 260):

```tsx
<SectionLabel>{t('tray.quick_access')}</SectionLabel>
```

```tsx
<SectionLabel>{t('tray.actions')}</SectionLabel>
```

- [ ] **Step 3: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/TrayPanel.tsx
git commit -m "refactor(tray): remove section labels for cleaner layout"
```

---

### Task 2: Simplify TrayPanel.tsx - Remove Unwanted MenuItems

**Files:**
- Modify: `src/components/TrayPanel.tsx:237-256` (Start minimized MenuItem)
- Modify: `src/components/TrayPanel.tsx:267-274` (Excluded Apps MenuItem)
- Modify: `src/components/TrayPanel.tsx:275-279` (Open Log MenuItem)

**Interfaces:**
- Consumes: None
- Produces: 3 MenuItem components removed

- [ ] **Step 1: Remove Start minimized toggle**

In `src/components/TrayPanel.tsx`, delete the Start minimized MenuItem (around lines 250-256):

```tsx
<MenuItem
  label={t('tray.start_minimized')}
  toggle
  checked={startMinimized}
  onToggle={handleSetStartMinimized}
  icon={<Minimize2 className="h-4 w-4" />}
/>
```

- [ ] **Step 2: Remove Excluded Apps action**

In `src/components/TrayPanel.tsx`, delete the Excluded Apps MenuItem (around lines 268-274):

```tsx
{/* Excluded Apps — hidden on Linux (no per-app profiles) */}
{!IS_LINUX && (
<MenuItem
  label={t('tray.excluded_apps')}
  onClick={handleOpenExcludedApps}
  icon={<LayoutGrid className="h-4 w-4" />}
/>
)}
```

- [ ] **Step 3: Remove Open Log action**

In `src/components/TrayPanel.tsx`, delete the Open Log MenuItem (around lines 275-279):

```tsx
<MenuItem
  label={t('tray.open_log')}
  onClick={handleOpenLog}
  icon={<FileText className="h-4 w-4" />}
/>
```

- [ ] **Step 4: Remove unused imports**

In `src/components/TrayPanel.tsx`, remove unused icon imports:

```tsx
// Remove these imports
import {
  MousePointer2,
  Monitor,
  Minimize2,  // Remove
  Settings,
  LayoutGrid,  // Remove
  FileText,    // Remove
  Power,
} from 'lucide-react';
```

- [ ] **Step 5: Remove unused state and handlers**

In `src/components/TrayPanel.tsx`, remove:

```tsx
// Remove state (around line 99)
const startMinimized = settings?.start_minimized ?? false;

// Remove handler (around lines 178-180)
const handleSetStartMinimized = useCallback((v: boolean) => {
  patch({ start_minimized: v });
}, [patch]);

// Remove handler (around lines 187-191)
const handleOpenExcludedApps = useCallback(async () => {
  await invoke('close_tray_panel');
  await invoke('show_main_window');
  await invoke('navigate_to', { section: 'excluded-apps' });
}, []);

// Remove handler (around lines 193-196)
const handleOpenLog = useCallback(async () => {
  await invoke('close_tray_panel');
  await invoke('open_log_dir');
}, []);
```

- [ ] **Step 6: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/TrayPanel.tsx
git commit -m "refactor(tray): remove start-minimized, excluded-apps, and open-log actions"
```

---

### Task 3: Simplify TrayPanel.tsx - Remove Footer

**Files:**
- Modify: `src/components/TrayPanel.tsx:290-294` (Footer section)
- Modify: `src/components/TrayPanel.tsx:97` (appVersion state)

**Interfaces:**
- Consumes: None
- Produces: Footer component removed, appVersion state removed

- [ ] **Step 1: Remove appVersion state**

In `src/components/TrayPanel.tsx`, delete:

```tsx
const [appVersion, setAppVersion] = useState('0.1.0');
```

- [ ] **Step 2: Remove appVersion fetch**

In `src/components/TrayPanel.tsx`, delete:

```tsx
invoke<string>('app_version').then(setAppVersion, () => {
  // ignore
});
```

- [ ] **Step 3: Remove Footer JSX**

In `src/components/TrayPanel.tsx`, delete:

```tsx
{/* Footer */}
<div className="tray-footer">
  <span>SmoothScroll</span>
  <span>{appVersion}</span>
</div>
```

- [ ] **Step 4: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/TrayPanel.tsx
git commit -m "refactor(tray): remove footer section"
```

---

### Task 4: Simplify CurrentAppCard.tsx - Replace Dropdown with Toggle

**Files:**
- Modify: `src/components/tray/CurrentAppCard.tsx:1-163` (entire component)

**Interfaces:**
- Consumes: `ForegroundAppContext` from `@/lib/tauri`
- Produces: Single-row component with app icon, name, and toggle

- [ ] **Step 1: Rewrite CurrentAppCard component**

Replace entire content of `src/components/tray/CurrentAppCard.tsx`:

```tsx
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AppWindow,
  Globe,
  Code2,
  FileText,
  Terminal,
  MessageCircle,
  Image as ImageIcon,
  Gamepad2,
  Briefcase,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { tauri, type ForegroundAppContext, type AppCategory } from "@/lib/tauri";

const CATEGORY_ICON: Record<AppCategory, LucideIcon> = {
  Browser: Globe,
  Ide: Code2,
  Office: Briefcase,
  Pdf: FileText,
  Terminal: Terminal,
  Chat: MessageCircle,
  Media: ImageIcon,
  Game: Gamepad2,
  Unknown: AppWindow,
};

/** Turn `smoothscroll-app.exe` into `SmoothScroll App`. */
function prettifyProcessName(raw: string): string {
  const stem = raw.replace(/\.exe$/i, "");
  return stem
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z]/.test(part) && /[a-z]/.test(part)) return part;
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function CurrentAppCard() {
  const { t } = useTranslation();
  const [ctx, setCtx] = useState<ForegroundAppContext | null>(null);

  const refresh = useCallback(async () => {
    try {
      const c = await tauri.getForegroundAppContext();
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
      un.then((u) => u()).catch(() => {
        // ignore
      });
      window.clearInterval(interval);
    };
  }, [refresh]);

  if (!ctx?.process_name) return null;

  const isDisabled = ctx.is_excluded;
  const category = ctx.suggested_category ?? "Unknown";
  const Icon = CATEGORY_ICON[category];
  const displayName = prettifyProcessName(ctx.process_name);

  const handleToggle = async (enabled: boolean) => {
    const name = ctx.process_name;
    if (!name) return;
    if (enabled) {
      await invoke("remove_excluded_app", { name }).catch(() => {
        // ignore
      });
    } else {
      await invoke("assign_app_profile", {
        processName: name,
        profileId: "__disabled__",
      });
    }
    await refresh();
  };

  return (
    <div className="mx-2 my-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isDisabled
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary"
          }`}
        >
          {isDisabled ? <Ban className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">
            {displayName}
          </div>
        </div>
        <Switch
          checked={!isDisabled}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tray/CurrentAppCard.tsx
git commit -m "refactor(tray): simplify CurrentAppCard to single-row with toggle"
```

---

### Task 5: Clean Up Unused CSS (If Applicable)

**Files:**
- Modify: `src/index.css` (check for unused styles)

**Interfaces:**
- Consumes: None
- Produces: Unused CSS removed (if any)

- [ ] **Step 1: Check for unused section label styles**

In `src/index.css`, search for `.tray-section-label` styles. If found and no longer used, remove them.

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "chore(tray): remove unused section label styles"
```

---

### Task 6: Final Verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working tray panel

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Manual testing checklist**

Test on Windows:
- [ ] Panel renders with correct items (header, CurrentAppCard, 2 toggles, 2 actions)
- [ ] CurrentAppCard shows foreground app name with toggle
- [ ] Per-app toggle enables/disables scroll for that app
- [ ] Global Smooth Scrolling toggle works
- [ ] Start with Windows toggle works
- [ ] Open Settings opens main window and closes tray
- [ ] Quit shows confirmation and exits app
- [ ] Panel auto-resizes correctly
- [ ] No section labels visible
- [ ] No footer visible

- [ ] **Step 3: Commit final changes (if any)**

```bash
git add -A
git commit -m "chore(tray): final verification and cleanup"
```

---

## Success Criteria

- [ ] Tray panel shows only: header, CurrentAppCard (with toggle), 2 global toggles, 2 actions
- [ ] No section labels ("QUICK ACCESS", "ACTIONS")
- [ ] No footer with version
- [ ] CurrentAppCard has single-row layout with toggle instead of dropdown
- [ ] All toggles and actions function correctly
- [ ] Visual style unchanged (semi-transparent, blur, rounded corners)
- [ ] Build passes with no errors
