# Interactive Tray Panel on Landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `<img>` tray screenshot on the landing page with a pixel-faithful, interactive React `TrayPreview` component that mirrors the real `src/components/TrayPanel.tsx`.

**Architecture:** Single React client component in `landing/components/TrayPreview.tsx` with 3-state machine (`running` / `quitting` / `closed`). Reuses `Switch` from `landing/components/ui/switch.tsx` and `tray-*` CSS classes copied from `src/index.css` into a new `landing/styles/tray.css`. i18n labels come from a new `landing/lib/i18n/tray-labels.ts` mini dictionary. Preview-only — no persistence, no backend.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Radix Switch (`@radix-ui/react-switch`), lucide-react, TypeScript, Vitest + Testing Library, Playwright (visual regression).

---

## File Structure

**New files (5):**
- `landing/styles/tray.css` — copied + adapted `tray-*` rules from `src/index.css:300-740`
- `landing/lib/i18n/tray-labels.ts` — mini dictionary (en/vi/zh)
- `landing/components/TrayPreview.tsx` — main component (~150 LOC)
- `landing/components/TrayPreview.test.tsx` — 7 unit tests
- `landing/tests/e2e/tray-preview.spec.ts` — Playwright visual regression

**Modified files (1):**
- `landing/components/sections/TrayPreviewSection.tsx` — swap `<Image>` → `<TrayPreview>`
- `landing/app/layout.tsx` — import `./styles/tray.css`

**Deleted files (1):**
- `landing/public/assets/screenshot-tray.png` — no longer used

---

## Task 1: Copy tray-* CSS rules into landing/styles/tray.css

**Files:**
- Create: `landing/styles/tray.css`
- Modify: `landing/app/layout.tsx`

- [ ] **Step 1: Create the new CSS file**

Create `landing/styles/tray.css` with this exact content (copy of the `tray-*` rules from `src/index.css:300-740`, with `body[data-platform]` selectors kept inert):

```css
/* -----------------------------------------------------------------------
 * Tray panel — preview-only styles for landing/components/TrayPreview.tsx
 *
 * Source: src/index.css:300-740 (mirrored to keep landing bundle
 * independent of Tauri-specific app styles). Selectors scoped to
 * `body[data-platform]` are inert on landing (no data-platform attr set)
 * but kept for parity.
 * --------------------------------------------------------------------- */

:root {
  --panel-radius: 10px;
  --panel-shadow:
    0 0 0 1px hsl(0 0% 0% / 0.04),
    0 10px 30px -8px hsl(0 0% 0% / 0.18);
}

.tray-panel-root {
  border-radius: var(--panel-radius);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  box-shadow:
    inset 0 0 0 1px hsl(var(--border)),
    var(--panel-shadow);
  font-family: var(--font-sans);
}

body[data-platform="mac"] .tray-panel-root {
  background: hsl(0 0% 100% / 0.72);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  border-bottom-left-radius: var(--panel-radius);
  border-bottom-right-radius: var(--panel-radius);
  box-shadow:
    inset 0 0 0 1px hsl(0 0% 0% / 0.12),
    var(--panel-shadow);
}

body[data-platform="mac"].dark .tray-panel-root {
  background: hsl(240 5% 14% / 0.62);
  box-shadow:
    inset 0 0 0 1px hsl(0 0% 100% / 0.08),
    var(--panel-shadow);
}

body[data-platform="linux"] .tray-panel-root {
  background: hsl(var(--popover));
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 1px hsl(var(--border)),
    0 0 0 1px hsl(0 0% 0% / 0.04),
    0 8px 24px -4px hsl(0 0% 0% / 0.18);
}

.tray-panel-flex {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.tray-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.tray-header-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.tray-header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.tray-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  transition: background-color 200ms ease-out;
}

.tray-status-dot-on {
  background-color: hsl(142 71% 45%);
  box-shadow: 0 0 0 2px hsl(142 71% 45% / 0.18);
}

.tray-status-dot-off {
  background-color: hsl(0 0% 60%);
}

.tray-status-text {
  font-weight: 500;
}

.tray-status-text-on {
  color: hsl(142 71% 30%);
}

.tray-status-text-off {
  color: hsl(0 0% 50%);
}

.dark .tray-status-text-on {
  color: hsl(142 71% 65%);
}

.dark .tray-status-text-off {
  color: hsl(0 0% 65%);
}

.tray-section {
  padding: 4px 0;
}

.tray-section-last {
  padding-bottom: 6px;
}

.tray-section:has(+ .tray-divider) {
  padding-bottom: 4px;
}

.tray-divider {
  height: 1px;
  margin: 2px 8px;
  background-color: hsl(var(--border));
  opacity: 0.6;
}

.tray-content {
  padding: 4px 0;
}

.tray-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  font-size: 13px;
  user-select: none;
}

.tray-row:hover {
  background-color: hsl(var(--accent) / 0.06);
}

.tray-row-icon {
  display: inline-flex;
  align-items: center;
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

.tray-row-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tray-row-app-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

.tray-row-action {
  cursor: pointer;
}

.tray-row-destructive {
  color: hsl(0 75% 50%);
}

.tray-row-destructive .tray-row-icon {
  color: hsl(0 75% 50%);
}

.tray-row-destructive:hover {
  background-color: hsl(0 75% 50% / 0.06);
}

@media (prefers-reduced-motion: reduce) {
  .tray-status-dot {
    transition-duration: 0ms;
  }
}
```

- [ ] **Step 2: Import tray.css in landing/app/layout.tsx**

Read `landing/app/layout.tsx` first. Find the line that imports the global CSS (likely `import './globals.css'` or similar). Add a new line right after it:

```tsx
import './globals.css'
import '@/styles/tray.css'  // ← ADD THIS LINE
```

- [ ] **Step 3: Verify build still passes**

Run: `cd D:/SmoothScroll/landing && pnpm build 2>&1 | tail -30`
Expected: build succeeds with no errors. (New CSS file is imported but unused — no errors.)

- [ ] **Step 4: Commit**

```bash
git add landing/styles/tray.css landing/app/layout.tsx
git commit -m "feat(landing): add tray.css preview styles"
```

---

## Task 2: Add tray-labels mini dictionary

**Files:**
- Create: `landing/lib/i18n/tray-labels.ts`

- [ ] **Step 1: Write the failing test**

Create `landing/lib/i18n/tray-labels.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getTrayLabels } from './tray-labels'

describe('tray-labels', () => {
  it('returns English labels when locale="en"', () => {
    const labels = getTrayLabels('en')
    expect(labels.smooth_scrolling).toBe('Smooth Scrolling')
    expect(labels.status_on).toBe('On')
    expect(labels.status_off).toBe('Off')
  })

  it('returns Vietnamese labels when locale="vi"', () => {
    const labels = getTrayLabels('vi')
    expect(labels.smooth_scrolling).toBe('Cuộn mượt')
    expect(labels.status_on).toBe('Bật')
  })

  it('returns Chinese labels when locale="zh"', () => {
    const labels = getTrayLabels('zh')
    expect(labels.smooth_scrolling).toBe('平滑滚动')
    expect(labels.status_on).toBe('已启用')
  })

  it('all locales share the same keys', () => {
    const en = Object.keys(getTrayLabels('en')).sort()
    const vi = Object.keys(getTrayLabels('vi')).sort()
    const zh = Object.keys(getTrayLabels('zh')).sort()
    expect(vi).toEqual(en)
    expect(zh).toEqual(en)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test tray-labels.test.ts 2>&1 | tail -20`
Expected: FAIL — `tray-labels.ts` not found.

- [ ] **Step 3: Create the implementation**

Create `landing/lib/i18n/tray-labels.ts`:

```ts
export type TrayLocale = 'en' | 'vi' | 'zh'

export interface TrayLabels {
  header: string
  status_on: string
  status_off: string
  smooth_scrolling: string
  start_with_windows: string
  open_settings: string
  quit: string
  current_app: string
  reopen: string
}

const labels: Record<TrayLocale, TrayLabels> = {
  en: {
    header: 'SmoothScroll',
    status_on: 'On',
    status_off: 'Off',
    smooth_scrolling: 'Smooth Scrolling',
    start_with_windows: 'Start with Windows',
    open_settings: 'Open Settings',
    quit: 'Quit',
    current_app: 'Chrome',
    reopen: 'Click to reopen',
  },
  vi: {
    header: 'SmoothScroll',
    status_on: 'Bật',
    status_off: 'Tắt',
    smooth_scrolling: 'Cuộn mượt',
    start_with_windows: 'Khởi động cùng Windows',
    open_settings: 'Mở cài đặt',
    quit: 'Thoát',
    current_app: 'Chrome',
    reopen: 'Nhấn để mở lại',
  },
  zh: {
    header: 'SmoothScroll',
    status_on: '已启用',
    status_off: '已停用',
    smooth_scrolling: '平滑滚动',
    start_with_windows: '随 Windows 启动',
    open_settings: '打开设置',
    quit: '退出',
    current_app: 'Chrome',
    reopen: '点击重新打开',
  },
}

export function getTrayLabels(locale: TrayLocale): TrayLabels {
  return labels[locale]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test tray-labels.test.ts 2>&1 | tail -15`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add landing/lib/i18n/tray-labels.ts landing/lib/i18n/tray-labels.test.ts
git commit -m "feat(landing): add tray-labels mini dictionary (en/vi/zh)"
```

---

## Task 3: Build static TrayPreview shell with header + CurrentAppCard

**Files:**
- Create: `landing/components/TrayPreview.tsx`
- Create: `landing/components/TrayPreview.test.tsx`

- [ ] **Step 1: Write the failing test for header**

Create `landing/components/TrayPreview.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrayPreview } from './TrayPreview'

describe('TrayPreview', () => {
  it('renders the SmoothScroll header in default ON state', () => {
    render(<TrayPreview locale="en" />)
    expect(screen.getByText('SmoothScroll')).toBeInTheDocument()
    expect(screen.getByText('On')).toBeInTheDocument()
  })

  it('renders CurrentAppCard with hardcoded Chrome name', () => {
    render(<TrayPreview locale="en" />)
    expect(screen.getByText('Chrome')).toBeInTheDocument()
  })

  it('uses Vietnamese labels when locale="vi"', () => {
    render(<TrayPreview locale="vi" />)
    expect(screen.getByText('Cuộn mượt')).toBeInTheDocument()
    expect(screen.getByText('Bật')).toBeInTheDocument()
  })

  it('uses Chinese labels when locale="zh"', () => {
    render(<TrayPreview locale="zh" />)
    expect(screen.getByText('平滑滚动')).toBeInTheDocument()
    expect(screen.getByText('已启用')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -15`
Expected: FAIL — `TrayPreview.tsx` not found.

- [ ] **Step 3: Create the static shell**

Create `landing/components/TrayPreview.tsx`:

```tsx
'use client'

import { Globe, MousePointer2, Monitor, Settings, Power } from 'lucide-react'
import { getTrayLabels, type TrayLocale } from '@/lib/i18n/tray-labels'

interface TrayPreviewProps {
  locale: TrayLocale
}

export function TrayPreview({ locale }: TrayPreviewProps) {
  const labels = getTrayLabels(locale)

  return (
    <div className="tray-panel-root tray-panel-flex" data-testid="tray-preview">
      <div className="tray-header">
        <span className="tray-header-title">{labels.header}</span>
        <div className="tray-header-status">
          <span
            className="tray-status-dot tray-status-dot-on"
            aria-hidden
          />
          <span className="tray-status-text tray-status-text-on">
            {labels.status_on}
          </span>
        </div>
      </div>

      <div className="tray-content">
        <div className="tray-section">
          <div className="tray-row">
            <span className="tray-row-app-icon">
              <Globe className="h-3 w-3" />
            </span>
            <span className="tray-row-label">{labels.current_app}</span>
          </div>
        </div>

        <div className="tray-divider" />

        <div className="tray-section">
          <div className="tray-row">
            <span className="tray-row-icon">
              <MousePointer2 className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.smooth_scrolling}</span>
          </div>
          <div className="tray-row">
            <span className="tray-row-icon">
              <Monitor className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.start_with_windows}</span>
          </div>
        </div>

        <div className="tray-divider" />

        <div className="tray-section tray-section-last">
          <div className="tray-row tray-row-action">
            <span className="tray-row-icon">
              <Settings className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.open_settings}</span>
          </div>
          <div className="tray-row tray-row-action tray-row-destructive">
            <span className="tray-row-icon">
              <Power className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.quit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -15`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add landing/components/TrayPreview.tsx landing/components/TrayPreview.test.tsx
git commit -m "feat(landing): add TrayPreview static shell (no interactivity yet)"
```

---

## Task 4: Wire Smooth Scrolling toggle (Switch + status dot)

**Files:**
- Modify: `landing/components/TrayPreview.tsx`
- Modify: `landing/components/TrayPreview.test.tsx`

- [ ] **Step 1: Append the new failing test**

Append to `landing/components/TrayPreview.test.tsx`:

```tsx
describe('TrayPreview - Smooth Scrolling toggle', () => {
  it('flips status dot OFF when Smooth Scrolling toggled off', () => {
    render(<TrayPreview locale="en" />)
    const switchEl = screen.getByLabelText('Smooth Scrolling')
    fireEvent.click(switchEl)
    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('flips status dot back ON when toggled on again', () => {
    render(<TrayPreview locale="en" />)
    const switchEl = screen.getByLabelText('Smooth Scrolling')
    fireEvent.click(switchEl)
    fireEvent.click(switchEl)
    expect(screen.getByText('On')).toBeInTheDocument()
  })
})
```

Also add to the imports at the top of the test file:

```tsx
import { fireEvent } from '@testing-library/react'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -20`
Expected: FAIL — `getByLabelText('Smooth Scrolling')` throws because no Switch exists yet.

- [ ] **Step 3: Add state + Switch to TrayPreview**

Replace the entire content of `landing/components/TrayPreview.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { Globe, MousePointer2, Monitor, Settings, Power } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { getTrayLabels, type TrayLocale } from '@/lib/i18n/tray-labels'

interface TrayPreviewProps {
  locale: TrayLocale
}

export function TrayPreview({ locale }: TrayPreviewProps) {
  const labels = getTrayLabels(locale)
  const [enabled, setEnabled] = useState(true)
  const [autostart, setAutostart] = useState(true)

  const statusOn = enabled
  const dotClass = statusOn ? 'tray-status-dot-on' : 'tray-status-dot-off'
  const textClass = statusOn ? 'tray-status-text-on' : 'tray-status-text-off'
  const statusText = statusOn ? labels.status_on : labels.status_off

  return (
    <div className="tray-panel-root tray-panel-flex" data-testid="tray-preview">
      <div className="tray-header">
        <span className="tray-header-title">{labels.header}</span>
        <div className="tray-header-status">
          <span className={`tray-status-dot ${dotClass}`} aria-hidden />
          <span className={`tray-status-text ${textClass}`}>{statusText}</span>
        </div>
      </div>

      <div className="tray-content">
        <div className="tray-section">
          <div className="tray-row">
            <span className="tray-row-app-icon">
              <Globe className="h-3 w-3" />
            </span>
            <span className="tray-row-label">{labels.current_app}</span>
          </div>
        </div>

        <div className="tray-divider" />

        <div className="tray-section">
          <div className="tray-row">
            <span className="tray-row-icon">
              <MousePointer2 className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.smooth_scrolling}</span>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={labels.smooth_scrolling}
            />
          </div>
          <div className="tray-row">
            <span className="tray-row-icon">
              <Monitor className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.start_with_windows}</span>
            <Switch
              checked={autostart}
              onCheckedChange={setAutostart}
              aria-label={labels.start_with_windows}
            />
          </div>
        </div>

        <div className="tray-divider" />

        <div className="tray-section tray-section-last">
          <div className="tray-row tray-row-action">
            <span className="tray-row-icon">
              <Settings className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.open_settings}</span>
          </div>
          <div className="tray-row tray-row-action tray-row-destructive">
            <span className="tray-row-icon">
              <Power className="h-4 w-4" />
            </span>
            <span className="tray-row-label">{labels.quit}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -15`
Expected: PASS — 6 tests pass (4 static + 2 toggle).

- [ ] **Step 5: Commit**

```bash
git add landing/components/TrayPreview.tsx landing/components/TrayPreview.test.tsx
git commit -m "feat(landing): wire Smooth Scrolling toggle + status dot"
```

---

## Task 5: Add Start with Windows toggle independence test

**Files:**
- Modify: `landing/components/TrayPreview.test.tsx`

- [ ] **Step 1: Append the failing test**

Append to `landing/components/TrayPreview.test.tsx`:

```tsx
describe('TrayPreview - Start with Windows independence', () => {
  it('toggling Start with Windows does NOT affect status dot', () => {
    render(<TrayPreview locale="en" />)
    const switchEl = screen.getByLabelText('Start with Windows')
    fireEvent.click(switchEl)
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(switchEl).not.toBeChecked()
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -10`
Expected: PASS — implementation already supports independent state.

- [ ] **Step 3: Commit**

```bash
git add landing/components/TrayPreview.test.tsx
git commit -m "test(landing): assert Start with Windows is independent of status dot"
```

---

## Task 6: Wire Open Settings bounce animation

**Files:**
- Modify: `landing/components/TrayPreview.tsx`
- Modify: `landing/styles/tray.css`

- [ ] **Step 1: Append the failing test**

Append to `landing/components/TrayPreview.test.tsx`:

```tsx
describe('TrayPreview - Open Settings bounce', () => {
  it('clicking Open Settings adds a transient pulse class', () => {
    render(<TrayPreview locale="en" />)
    const settingsRow = screen.getByText('Open Settings').closest('.tray-row')!
    fireEvent.click(settingsRow)
    expect(settingsRow.className).toMatch(/tray-row-pulse/)
  })

  it('pulse class clears after 300ms', () => {
    vi.useFakeTimers()
    render(<TrayPreview locale="en" />)
    const settingsRow = screen.getByText('Open Settings').closest('.tray-row')!
    fireEvent.click(settingsRow)
    expect(settingsRow.className).toMatch(/tray-row-pulse/)
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(settingsRow.className).not.toMatch(/tray-row-pulse/)
    vi.useRealTimers()
  })
})
```

Also add to imports:

```tsx
import { vi } from 'vitest'
import { act } from '@testing-library/react'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -20`
Expected: FAIL — `tray-row-pulse` class doesn't exist yet.

- [ ] **Step 3: Add `tray-row-pulse` CSS**

Append to `landing/styles/tray.css`:

```css
@keyframes tray-row-flash {
  0% {
    background-color: hsl(var(--accent) / 0);
  }
  50% {
    background-color: hsl(var(--accent) / 0.12);
  }
  100% {
    background-color: hsl(var(--accent) / 0);
  }
}

.tray-row-pulse {
  animation: tray-row-flash 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .tray-row-pulse {
    animation: none;
  }
}
```

- [ ] **Step 4: Add pulse state + handler in TrayPreview**

In `landing/components/TrayPreview.tsx`:

1. Add to imports:
```tsx
import { useEffect } from 'react'
```

2. Add state right after `useState` lines:
```tsx
const [pulseSettings, setPulseSettings] = useState(false)

useEffect(() => {
  if (!pulseSettings) return
  const t = setTimeout(() => setPulseSettings(false), 300)
  return () => clearTimeout(t)
}, [pulseSettings])

const handleOpenSettings = () => setPulseSettings(true)
```

3. Replace the "Open Settings" row's `className`:

Find:
```tsx
<div className="tray-row tray-row-action">
  <span className="tray-row-icon">
    <Settings className="h-4 w-4" />
  </span>
  <span className="tray-row-label">{labels.open_settings}</span>
</div>
```

Replace with:
```tsx
<div
  className={`tray-row tray-row-action${pulseSettings ? ' tray-row-pulse' : ''}`}
  onClick={handleOpenSettings}
  role="button"
  tabIndex={0}
>
  <span className="tray-row-icon">
    <Settings className="h-4 w-4" />
  </span>
  <span className="tray-row-label">{labels.open_settings}</span>
</div>
```

- [ ] **Step 5: Run all tests**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -15`
Expected: PASS — all 9 tests pass.

- [ ] **Step 6: Commit**

```bash
git add landing/components/TrayPreview.tsx landing/styles/tray.css landing/components/TrayPreview.test.tsx
git commit -m "feat(landing): add Open Settings bounce feedback"
```

---

## Task 7: Wire Quit state machine (running → quitting → closed → running)

**Files:**
- Modify: `landing/components/TrayPreview.tsx`
- Modify: `landing/components/TrayPreview.test.tsx`

- [ ] **Step 1: Append failing tests for Quit state machine**

Append to `landing/components/TrayPreview.test.tsx`:

```tsx
describe('TrayPreview - Quit state machine', () => {
  it('clicking Quit transitions to quitting state', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    expect(screen.getByTestId('tray-preview').className).toMatch(/tray-quitting/)
  })

  it('both Switches animate OFF in quitting state', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    expect(screen.getByLabelText('Smooth Scrolling')).not.toBeChecked()
    expect(screen.getByLabelText('Start with Windows')).not.toBeChecked()
  })

  it('after 5s, transitions to closed state and shows reopen button', () => {
    vi.useFakeTimers()
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Click to reopen')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('clicking reopen resets state to running with both toggles ON', () => {
    vi.useFakeTimers()
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    fireEvent.click(screen.getByText('Click to reopen'))
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByLabelText('Smooth Scrolling')).toBeChecked()
    expect(screen.getByLabelText('Start with Windows')).toBeChecked()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -20`
Expected: FAIL — `tray-quitting` class not applied, no reopen button.

- [ ] **Step 3: Add Quit state machine + pulse animation CSS**

Append to `landing/styles/tray.css`:

```css
@keyframes tray-dot-quit-pulse {
  0%, 100% {
    background-color: hsl(0 75% 50%);
    box-shadow: 0 0 0 2px hsl(0 75% 50% / 0);
  }
  50% {
    background-color: hsl(0 75% 55%);
    box-shadow: 0 0 0 6px hsl(0 75% 50% / 0.22);
  }
}

.tray-status-dot-quitting {
  animation: tray-dot-quit-pulse 400ms ease-out 1;
}

.tray-quitting .tray-content {
  transition: opacity 300ms ease-out 100ms;
  opacity: 0.4;
}

.tray-quitting .tray-row {
  pointer-events: none;
}

.tray-reopen-button {
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 200ms ease-out, transform 200ms ease-out;
}

.tray-reopen-button:hover {
  color: hsl(var(--foreground));
  transform: scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .tray-status-dot-quitting {
    animation: none;
  }
  .tray-quitting .tray-content {
    transition: none;
  }
}
```

- [ ] **Step 4: Implement Quit state machine in TrayPreview**

Replace the entire content of `landing/components/TrayPreview.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, MousePointer2, Monitor, Settings, Power } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { getTrayLabels, type TrayLocale } from '@/lib/i18n/tray-labels'

type TrayState = 'running' | 'quitting' | 'closed'

interface TrayPreviewProps {
  locale: TrayLocale
}

export function TrayPreview({ locale }: TrayPreviewProps) {
  const labels = getTrayLabels(locale)
  const [enabled, setEnabled] = useState(true)
  const [autostart, setAutostart] = useState(true)
  const [pulseSettings, setPulseSettings] = useState(false)
  const [state, setState] = useState<TrayState>('running')
  const quitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pulseSettings) return
    const t = setTimeout(() => setPulseSettings(false), 300)
    return () => clearTimeout(t)
  }, [pulseSettings])

  useEffect(() => {
    return () => {
      if (quitTimerRef.current) clearTimeout(quitTimerRef.current)
    }
  }, [])

  const handleQuit = () => {
    if (state !== 'running') return
    setEnabled(false)
    setAutostart(false)
    setState('quitting')
    if (quitTimerRef.current) clearTimeout(quitTimerRef.current)
    quitTimerRef.current = setTimeout(() => {
      setState('closed')
      quitTimerRef.current = null
    }, 5000)
  }

  const handleReopen = () => {
    setState('running')
    setEnabled(true)
    setAutostart(true)
  }

  const statusOn = enabled && state !== 'closed'
  const dotClass = state === 'quitting'
    ? 'tray-status-dot-quitting'
    : statusOn
      ? 'tray-status-dot-on'
      : 'tray-status-dot-off'
  const textClass = statusOn ? 'tray-status-text-on' : 'tray-status-text-off'
  const statusText = statusOn ? labels.status_on : labels.status_off

  const isQuitting = state === 'quitting'
  const isClosed = state === 'closed'

  return (
    <div
      className={`tray-panel-root tray-panel-flex${isQuitting ? ' tray-quitting' : ''}`}
      data-testid="tray-preview"
    >
      <div className="tray-header">
        <span className="tray-header-title">{labels.header}</span>
        <div className="tray-header-status">
          <span className={`tray-status-dot ${dotClass}`} aria-hidden />
          <span className={`tray-status-text ${textClass}`}>{statusText}</span>
        </div>
      </div>

      {isClosed ? (
        <button
          type="button"
          onClick={handleReopen}
          className="tray-reopen-button"
        >
          {labels.reopen}
        </button>
      ) : (
        <div className="tray-content">
          <div className="tray-section">
            <div className="tray-row">
              <span className="tray-row-app-icon">
                <Globe className="h-3 w-3" />
              </span>
              <span className="tray-row-label">{labels.current_app}</span>
            </div>
          </div>

          <div className="tray-divider" />

          <div className="tray-section">
            <div className="tray-row">
              <span className="tray-row-icon">
                <MousePointer2 className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.smooth_scrolling}</span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label={labels.smooth_scrolling}
                disabled={isQuitting}
              />
            </div>
            <div className="tray-row">
              <span className="tray-row-icon">
                <Monitor className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.start_with_windows}</span>
              <Switch
                checked={autostart}
                onCheckedChange={setAutostart}
                aria-label={labels.start_with_windows}
                disabled={isQuitting}
              />
            </div>
          </div>

          <div className="tray-divider" />

          <div className="tray-section tray-section-last">
            <div
              className={`tray-row tray-row-action${pulseSettings ? ' tray-row-pulse' : ''}`}
              onClick={() => setPulseSettings(true)}
              role="button"
              tabIndex={0}
            >
              <span className="tray-row-icon">
                <Settings className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.open_settings}</span>
            </div>
            <div
              className="tray-row tray-row-action tray-row-destructive"
              onClick={handleQuit}
              role="button"
              tabIndex={0}
            >
              <span className="tray-row-icon">
                <Power className="h-4 w-4" />
              </span>
              <span className="tray-row-label">{labels.quit}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run all tests**

Run: `cd D:/SmoothScroll/landing && pnpm test TrayPreview.test.tsx 2>&1 | tail -15`
Expected: PASS — all 13 tests pass.

- [ ] **Step 6: Commit**

```bash
git add landing/components/TrayPreview.tsx landing/styles/tray.css landing/components/TrayPreview.test.tsx
git commit -m "feat(landing): add Quit state machine (running→quitting→closed→running)"
```

---

## Task 8: Swap `<Image>` → `<TrayPreview>` in TrayPreviewSection

**Files:**
- Modify: `landing/components/sections/TrayPreviewSection.tsx`
- Delete: `landing/public/assets/screenshot-tray.png`

- [ ] **Step 1: Read useI18n hook to confirm locale API**

Read `landing/lib/i18n/provider.tsx` and confirm the hook returns `{ locale: 'en' | 'vi' | 'zh', ... }`. (If the API is different, adjust Step 3 accordingly.)

- [ ] **Step 2: Replace TrayPreviewSection content**

Replace the entire content of `landing/components/sections/TrayPreviewSection.tsx` with:

```tsx
'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { TrayPreview } from '@/components/TrayPreview'
import { useI18n } from '@/lib/i18n/provider'
import type { Dictionary } from '@/lib/i18n/dict'

interface TrayPreviewSectionProps {
  dict: { trayPreview?: Dictionary['trayPreview'] }
}

export function TrayPreviewSection({ dict }: TrayPreviewSectionProps) {
  const t = dict?.trayPreview ?? { title: '', subtitle: '' }
  const { locale } = useI18n()

  return (
    <section className="py-20 px-4 bg-muted/30 dark:bg-white/[0.04]">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <FadeUp className="min-w-0">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t.title}</h2>
            <p className="text-lg text-muted-foreground break-words">{t.subtitle}</p>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="flex justify-center lg:justify-end">
              <div className="relative max-w-sm w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-border">
                <TrayPreview locale={locale} />
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd D:/SmoothScroll/landing && pnpm build 2>&1 | tail -20`
Expected: build succeeds. DOM path of the section unchanged.

- [ ] **Step 4: Run all landing tests**

Run: `cd D:/SmoothScroll/landing && pnpm test 2>&1 | tail -15`
Expected: all 13+4 tests pass.

- [ ] **Step 5: Delete the now-unused screenshot**

Run: `cd D:/SmoothScroll && git rm landing/public/assets/screenshot-tray.png`
Expected: `rm 'landing/public/assets/screenshot-tray.png'`

- [ ] **Step 6: Commit**

```bash
git add landing/components/sections/TrayPreviewSection.tsx
git commit -m "feat(landing): swap static tray screenshot for interactive TrayPreview"
```

(If `git rm` was used in step 5, the deletion is staged automatically.)

- [ ] **Step 7: Verify production build**

Run: `cd D:/SmoothScroll/landing && pnpm build 2>&1 | tail -30`
Expected: build succeeds, no warnings about unused imports, no reference to screenshot-tray.png.

---

## Task 9: Manual QA + Lighthouse verification

**Files:**
- None (validation only)

- [ ] **Step 1: Start landing dev server**

Run: `cd D:/SmoothScroll/landing && pnpm dev 2>&1 | tail -10`
Expected: `Local: http://localhost:3000` (or similar). DO NOT kill — leave running for QA.

- [ ] **Step 2: Manual QA pass**

Open http://localhost:3000 in browser. Walk through the 8-item checklist:

1. Click Smooth Scrolling → dot flips color immediately, status text "On" → "Off"
2. Click Start with Windows → only Switch flips, dot unchanged
3. Click Quit → dot pulses red once, both toggles animate OFF, after 5s "Click to reopen" appears
4. Click "Click to reopen" → state resets to ON
5. Toggle LangSwitcher (EN → VI → ZH) → tray labels update in real-time
6. Toggle dark mode → tray still readable, status dot green visible
7. Tab to first Switch → Enter → toggle; Tab to Quit → Enter → state transitions
8. Set OS reduced-motion → Quit pulse skipped, transitions instant

Document any failures inline.

- [ ] **Step 3: Stop dev server**

If running in foreground: Ctrl+C. If backgrounded: locate the terminal and stop.

- [ ] **Step 4: Run Lighthouse**

Run in a separate session:
```bash
cd D:/SmoothScroll/landing && pnpm build && pnpm start
```
Then open Chrome DevTools → Lighthouse → Performance → Analyze.

Expected: Performance ≥ 90.

- [ ] **Step 5: Run pnpm tsc --noEmit and lint**

Run:
```bash
cd D:/SmoothScroll/landing && pnpm tsc --noEmit 2>&1 | tail -10
cd D:/SmoothScroll/landing && pnpm lint 2>&1 | tail -10
```
Expected: both clean.

- [ ] **Step 6: Acceptance criteria check**

Walk through spec §11 Acceptance Criteria:
- [ ] TrayPreview.tsx renders identically to current screenshot at first paint
- [ ] All 8 manual QA items pass
- [ ] All 13+4 tests pass
- [ ] Lighthouse perf ≥ 90
- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm lint` clean
- [ ] `screenshot-tray.png` deleted
- [ ] i18n labels switch across en/vi/zh
- [ ] No new dependencies in package.json
- [ ] DOM path unchanged

If any fail, open follow-up tasks before committing the QA sign-off.

- [ ] **Step 7: Final commit (if any QA-driven fixes were needed)**

```bash
git add -A
git commit -m "chore(landing): QA fixes for interactive TrayPreview"
```

---

## Task 10: Optional Playwright visual regression

**Files:**
- Create: `landing/tests/e2e/tray-preview.spec.ts`

Skip this task if Playwright is not yet configured for landing. Otherwise:

- [ ] **Step 1: Confirm Playwright is set up for landing**

Run: `cd D:/SmoothScroll/landing && ls playwright.config.ts 2>/dev/null && echo "configured" || echo "NOT CONFIGURED — skip this task"`
If "NOT CONFIGURED", stop here — visual regression is a future task.

- [ ] **Step 2: Write the spec**

Create `landing/tests/e2e/tray-preview.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('TrayPreview visual regression', () => {
  test('running state matches snapshot', async ({ page }) => {
    await page.goto('/')
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toHaveScreenshot('tray-running.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('quitting state matches snapshot', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Quit').click()
    await page.waitForTimeout(200)
    const tray = page.getByTestId('tray-preview')
    await expect(tray).toHaveScreenshot('tray-quitting.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
```

- [ ] **Step 3: Generate baselines**

Run: `cd D:/SmoothScroll/landing && pnpm playwright test tray-preview.spec.ts --update-snapshots`
Expected: 2 baselines written to `landing/tests/e2e/tray-preview.spec.ts-snapshots/`.

- [ ] **Step 4: Verify subsequent runs pass**

Run: `cd D:/SmoothScroll/landing && pnpm playwright test tray-preview.spec.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add landing/tests/e2e/tray-preview.spec.ts landing/tests/e2e/tray-preview.spec.ts-snapshots
git commit -m "test(landing): add Playwright visual regression for TrayPreview"
```

---

## Self-Review (against spec)

**1. Spec coverage:** Walked through all 12 spec sections. Each maps to a task:
- §2 state machine → Task 7 ✓
- §3 architecture (3 files, 1 modify) → Tasks 1, 2, 3, 8 ✓
- §4 layout (DOM path unchanged) → Task 8 ✓
- §5 interactions (4 rules) → Tasks 4, 6, 7 ✓
- §6 i18n (3 locale dictionary) → Task 2 ✓
- §7 CSS migration → Task 1 ✓
- §8 testing (7+ tests, 8 QA items) → Tasks 3-7 + Task 9 ✓
- §11 acceptance criteria → Task 9 step 6 ✓

**2. Placeholder scan:** No "TBD", "TODO", "implement later". All code blocks complete.

**3. Type consistency:** `TrayLocale` defined in Task 2 as `'en' | 'vi' | 'zh'`, used in Tasks 3, 4, 7, 8 — consistent. `TrayLabels` interface used in dictionary export — consistent. `data-testid="tray-preview"` referenced in Task 7 + Task 10 — consistent.

**No gaps found.**

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-10-interactive-tray-panel-landing.md`.

10 tasks total. Estimated time: 2-3 hours (mostly test writing + visual QA).

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach, honey?