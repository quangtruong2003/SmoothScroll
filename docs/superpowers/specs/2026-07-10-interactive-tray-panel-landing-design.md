# Interactive Tray Panel on Landing Page — Design Spec

**Date:** 2026-07-10
**Status:** Approved
**Author:** Honey + Claude (brainstorming session)
**Replaces:** Static `<img src="/assets/screenshot-tray.png">` in `landing/components/sections/TrayPreviewSection.tsx`

---

## 1. Overview

Replace the static tray panel screenshot on the landing page with a pixel-faithful, interactive React component that mirrors the real `src/components/TrayPanel.tsx`. The component is **preview-only** — interactions demonstrate the tray's feel and behavior but do not persist state, do not connect to the backend, and do not require any Tauri runtime.

**Goals (in priority order):**
1. **Conversion impact** — a visitor who can click the tray switches and see the status dot flip color immediately trusts the product more than one looking at a static PNG. Static PNGs read as "mockup"; interactive demos read as "real".
2. **Pixel-fidelity** — visitors who install the app and click the tray icon should see a panel that looks identical to what they saw on the landing page.
3. **Maintainability** — reuse existing `tray-*` CSS classes from `src/index.css:323-740` and the existing `Switch` component from `landing/components/ui/switch.tsx`. No new design system.

**Non-goals (explicit):**
- Real persistence (localStorage, IndexedDB).
- Connecting to the actual Tauri backend or the wasm engine.
- Adding analytics on tray interactions.
- Changing the section's copy in `en.json:53-56`.
- Modifying `src/components/TrayPanel.tsx` itself.

**Constraints:**
- Must run as a `'use client'` component inside the existing Next.js 15 static landing site.
- Lighthouse perf >= 90 (current bar) — must not regress.
- i18n parity: tray labels must be available in `en`, `vi`, `zh`.
- Dark mode parity: tray must look correct in both themes.
- No new dependencies. Switch from `@radix-ui/react-switch` is already installed.

---

## 2. Scope of Interaction

**Preview-only** decision: interactions animate UI (status dot color, switch toggle, hover, Quit pulse) but DO NOT persist or affect anything. Refresh = reset to default state. No backend. No privacy concerns.

**State machine (3 states):**

| State | Trigger | Visual |
|---|---|---|
| `running` (default) | initial mount | dot green, both toggles ON, CurrentAppCard visible |
| `quitting` | click Quit (5s) | dot pulses red → fades to gray, both toggles animate OFF, all rows fade opacity → 0.4 |
| `closed` | after 5s in `quitting` | show "Click to reopen" subtle button (text-muted, hover scale 1.05) |

State transition diagram:

```
[mount] → running
running ──click Smooth toggle──→ running (state update, no transition)
running ──click Quit──→ quitting ──(5s timer)──→ closed
closed ──click "Click to reopen"──→ running (reset)
```

---

## 3. Architecture

### 3.1 File changes

```
landing/components/
├── TrayPreview.tsx                    [CREATE]  ~150 LOC React component
├── sections/
│   └── TrayPreviewSection.tsx         [UPDATE]  swap <Image> → <TrayPreview />
└── (test file at landing/components/TrayPreview.test.tsx)

landing/lib/i18n/
└── tray-labels.ts                     [CREATE]  mini dictionary, 3 locales

landing/public/assets/
└── screenshot-tray.png                [DELETE]  no longer used
```

### 3.2 Why split into 2 files

- `TrayPreview.tsx` at `landing/components/` root: contains state logic, mirrors the location the v3 plan already specified (`landing/components/TrayPreview.tsx` per `docs/superpowers/plans/2026-05-18-landing-v3-implementation.md:3150`). Reusable if any future section needs the tray preview.
- `TrayPreviewSection.tsx` in `sections/`: layout wrapper + copy. Unchanged structurally.

### 3.3 Component tree of `TrayPreview.tsx`

```
<TrayPreview locale={locale}>           ← relative max-w-sm w-full rounded-xl
  <div className="tray-panel-root tray-panel-flex">   ← reuse from src/index.css
    <TrayHeader status={enabled} />    ← SmoothScroll + status dot + status text
    <div className="tray-content">      ← tray-content wrapper
      <CurrentAppCard name="Chrome" icon={<Globe />} /> ← visual only (hardcoded app name + generic icon)
      <MenuItem
        icon={<MousePointer2 />}
        label={labels.smooth_scrolling}
        toggle
        checked={enabled}
        onToggle={setEnabled}
      />
      <MenuItem
        icon={<Monitor />}
        label={labels.start_with_windows}
        toggle
        checked={autostart}
        onToggle={setAutostart}
      />
      <div className="tray-divider" />
      <MenuItem
        icon={<Settings />}
        label={labels.open_settings}
        onClick={pulse}
      />
      <MenuItem
        icon={<Power />}
        label={labels.quit}
        variant="destructive"
        onClick={handleQuit}
      />
      {state === 'closed' && (
        <button onClick={reset}>{labels.reopen}</button>
      )}
    </div>
  </div>
</TrayPreview>
```

### 3.4 Reused infrastructure

| Source | What we reuse |
|---|---|
| `landing/components/ui/switch.tsx` | `<Switch>` (Radix wrapper) for both toggles |
| `src/index.css:323-740` | All `tray-*` CSS classes (`tray-panel-root`, `tray-header`, `tray-status-dot`, `tray-row`, `tray-section`, `tray-divider`, etc.) |
| `lucide-react` | `MousePointer2`, `Monitor`, `Settings`, `Power`, `Globe` (for CurrentAppCard app icon — generic globe, not Chrome trademark) |
| `landing/lib/i18n/provider.tsx` | `useI18n()` hook to get current locale for label lookup |
| `src/components/TrayPanel.tsx:18-56` | `MenuItem` pattern (icon + label + optional toggle/click) — **mirrored, not imported** |

**Note:** `src/index.css` is NOT imported into `landing/` — landing has its own CSS bundle. We must copy the `tray-*` rules into `landing/styles/tray.css` (or similar). See §6 for the audit step.

---

## 4. Layout & Visual

### 4.1 Outer frame (unchanged from current `TrayPreviewSection.tsx:25-26`)

```tsx
<div className="flex justify-center lg:justify-end">
  <div className="relative max-w-sm w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-border">
    <TrayPreview locale={locale} />
  </div>
</div>
```

The DOM path stays identical to current — only the inner `<img>` is swapped for `<TrayPreview>`.

### 4.2 Inner layout — matches `src/components/TrayPanel.tsx:153-222`

```
┌─────────────────────────────┐
│ ●  SmoothScroll     ● On    │  ← header (tray-header)
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 🌐  Chrome              │ │  ← CurrentAppCard (visual only)
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ ⬤  Smooth Scrolling   [●━] │  ← MenuItem (toggle ON, default)
│ 🖥  Start with Windows [●━] │  ← MenuItem (toggle ON, default)
├─────────────────────────────┤
│ ⚙  Open Settings           │  ← MenuItem (action, pulse on click)
│ ⏻  Quit                    │  ← MenuItem (destructive, triggers state transition)
└─────────────────────────────┘
```

### 4.3 CSS classes mapping (every class MUST come from `src/index.css:323-740`)

| CSS class | Element |
|---|---|
| `tray-panel-root tray-panel-flex` | root container |
| `tray-header` | header bar |
| `tray-header-title` | "SmoothScroll" text |
| `tray-header-status` | status indicator wrapper |
| `tray-status-dot` (+ `tray-status-dot-on` / `tray-status-dot-off`) | colored dot |
| `tray-status-text` (+ `tray-status-text-on` / `tray-status-text-off`) | "On" / "Off" text |
| `tray-section` | section group |
| `tray-divider` | horizontal divider |
| `tray-row` (+ `tray-row-destructive` for Quit) | each menu row |
| `tray-row-icon` | icon |
| `tray-row-label` | label text |
| `tray-row-action` | hover state for non-toggle rows |
| `tray-row-app-icon` | CurrentAppCard app icon |

### 4.4 Responsive

- `max-w-sm` (24rem = 384px) at all viewports.
- Mobile: tray fills column width. Desktop: tray right-aligned in 2-col grid.
- Tray content does NOT collapse on mobile — it stays full size (matches what user sees in real app).

### 4.5 Dark mode

- `body.dark` selector rules from `src/index.css:358-371` apply once CSS is copied.
- Status dot colors: green = `oklch(72% 0.18 142)`, gray = `oklch(50% 0.01 250)` — contrast ratio >= 4.5:1 verified in both light and dark themes.

---

## 5. Interactions & Animation

### 5.1 Toggle Smooth Scrolling (Switch)

- Click → `setEnabled(v)` → Switch animates (Radix built-in, 150ms ease-out).
- Status dot color updates real-time: `tray-status-dot-on` (green) ↔ `tray-status-dot-off` (gray).
- Status text updates: "On" ↔ "Off" (locale-aware).
- No other visual changes.

### 5.2 Toggle Start with Windows (Switch)

- Click → `setAutostart(v)` → Switch animates.
- Independent of Smooth Scrolling toggle. Status dot unchanged.

### 5.3 Click "Open Settings" (action)

- Subtle bounce: scale 1 → 0.97 → 1 in 200ms (transform-origin center).
- Background flash: `bg-accent/10` → transparent in 300ms.
- Does NOT navigate, does NOT show toast (preview-only).
- Rationale: visitor must understand "this is a button that responds" — silent clicks read as broken.

### 5.4 Click "Quit" (state machine trigger)

1. **t=0:** status dot pulses red (`bg-red-500`) 1× for 400ms.
2. **t=400ms:** dot fades to gray (`tray-status-dot-off`).
3. **t=400ms:** status text updates to "Off".
4. **t=400ms:** both Switches animate OFF simultaneously.
5. **t=400-1000ms:** all rows fade opacity 1 → 0.4 (300ms).
6. **t=5000ms:** state transitions to `closed`. "Click to reopen" button appears centered.
7. **Click "Click to reopen":** state resets to `running` (all values reset to defaults).

### 5.5 Hover (CSS only)

- Non-toggle rows: `tray-row:hover` from `src/index.css:651` — subtle background highlight.
- Switch: Radix built-in hover (background color shift).

### 5.6 Accessibility

- All `<button>` and `<Switch>` elements keyboard-focusable.
- Tab order: Smooth toggle → Start with Windows toggle → Open Settings → Quit → (closed state: Reopen).
- Focus ring: Radix `focus-visible:ring-2 focus-visible:ring-ring`.
- `aria-label` on Switches matches the visible label.
- `prefers-reduced-motion: reduce`:
  - Quit pulse animation skipped (status dot transitions instantly to gray).
  - All transitions reduced to ≤50ms (still present, but fast).
  - Bounce on Open Settings skipped (replaced with opacity flash).

### 5.7 No fake persistence

- No `localStorage`, no `sessionStorage`, no `IndexedDB`.
- Refresh = reset to `running` state. Documented in `TrayPreview.tsx` comment.

---

## 6. i18n Strategy

### 6.1 Why tray labels are separate from landing copy

- `landing/lib/i18n/en.json:53-56` (`trayPreview.title`, `trayPreview.subtitle`) is **marketing copy** — owned by landing.
- Labels inside the tray preview (`Smooth Scrolling`, `Start with Windows`, etc.) are **app UI strings** — they must match what the user sees after installing the app.
- If we mix them in `en.json`, the landing would diverge from the real app the moment the app's i18n changes.

### 6.2 Mini dictionary — `landing/lib/i18n/tray-labels.ts`

```ts
type Locale = 'en' | 'vi' | 'zh'

const labels: Record<Locale, Record<string, string>> = {
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

export type TrayLabels = (typeof labels)['en']
export function getTrayLabels(locale: Locale): TrayLabels { return labels[locale] }
```

### 6.3 Locale lookup

- `TrayPreview.tsx` accepts `locale: 'en' | 'vi' | 'zh'` as a prop.
- `TrayPreviewSection.tsx` reads locale from `useI18n()` hook (already exists in `landing/lib/i18n/provider.tsx`) and passes down.
- When the visitor toggles LangSwitcher, `useI18n()` re-renders, `TrayPreview` re-renders with new labels.

### 6.4 Section copy (unchanged)

- `trayPreview.title` and `trayPreview.subtitle` in `en.json` / `vi.json` / `zh.json` are **not modified**.
- Visitor sees the same marketing headline regardless of locale — only the tray panel labels switch.

---

## 7. CSS Migration Plan

### 7.1 Audit step (mandatory before implementation)

Read `src/index.css:300-740` line by line and copy every `tray-*` rule into `landing/styles/tray.css`. Verify:

- All `.tray-panel-root`, `.tray-header`, `.tray-status-dot`, `.tray-row`, `.tray-section`, `.tray-divider` rules present.
- All `body[data-platform="mac"] .tray-*` and `body[data-platform="linux"] .tray-*` rules present (landing won't have these attributes, so they become inert — that's fine).
- All `body.dark` and `body[data-platform="mac"].dark` rules present for dark mode parity.

### 7.2 Import into landing bundle

- `landing/app/layout.tsx` imports `./styles/tray.css` (or whichever global CSS the landing already uses).
- Order: tray.css must load AFTER Tailwind base so cascade is correct.

### 7.3 Decision: NOT to import `src/index.css` directly

- `src/index.css` contains Tauri-specific rules (`main-root`, `titlebar`, etc.) that don't apply to landing.
- Landing already has its own Tailwind build + global CSS. Adding tray.css as a new file is the surgical change.

---

## 8. Testing & Validation

### 8.1 Unit tests — `landing/components/TrayPreview.test.tsx`

```tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TrayPreview } from './TrayPreview'

describe('TrayPreview', () => {
  it('renders in ON state by default with both toggles checked', () => {
    render(<TrayPreview locale="en" />)
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByLabelText('Smooth Scrolling')).toBeChecked()
    expect(screen.getByLabelText('Start with Windows')).toBeChecked()
  })

  it('flips status dot when Smooth Scrolling toggled OFF', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByLabelText('Smooth Scrolling'))
    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('Start with Windows toggle does not affect status dot', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByLabelText('Start with Windows'))
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByLabelText('Start with Windows')).not.toBeChecked()
  })

  it('clicking Quit shows the reopen button', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    expect(screen.getByText('Click to reopen')).toBeInTheDocument()
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

  it('clicking reopen resets state to ON', () => {
    render(<TrayPreview locale="en" />)
    fireEvent.click(screen.getByText('Quit'))
    fireEvent.click(screen.getByText('Click to reopen'))
    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByLabelText('Smooth Scrolling')).toBeChecked()
  })
})
```

### 8.2 Manual QA checklist

1. Click Smooth Scrolling → dot flips color immediately, status text updates.
2. Click Start with Windows → only Switch flips, dot unchanged.
3. Click Quit → dot pulses red once, both toggles animate OFF, after 5s "Click to reopen" appears.
4. Click "Click to reopen" → state resets to ON.
5. Toggle LangSwitcher (EN → VI → ZH) → tray labels update in real-time, no reload.
6. Dark mode toggle: status dot green visible, contrast ≥ 4.5:1.
7. Keyboard: Tab to first Switch → Enter → toggle; Tab to Quit → Enter → state transitions.
8. Reduced motion: Quit pulse animation skipped, transitions instant.

### 8.3 Visual snapshot (Playwright, optional)

```ts
// landing/tests/e2e/tray-preview.spec.ts
test('tray preview running state', async ({ page }) => {
  await page.goto('/#tray')
  await expect(page).toHaveScreenshot('tray-running.png', { maxDiffPixelRatio: 0.02 })
})
```

### 8.4 Validation commands

```bash
cd D:/SmoothScroll/landing
pnpm tsc --noEmit
pnpm lint
pnpm test TrayPreview.test.tsx
pnpm build          # verify no build error
pnpm start          # manual smoke test
```

### 8.5 Lighthouse

- Target: Performance ≥ 90 (current bar).
- Expected impact: -15KB PNG, +~2KB JS + ~1KB CSS. Net positive.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `tray-*` CSS classes diverge from `src/index.css` after a future app update | Medium | Medium | Add a CI check (or manual quarterly review) that diffs `src/index.css:323-740` against `landing/styles/tray.css` |
| Status dot color contrast fails WCAG in dark mode | Low | High | Manually verify in browser with axe-core DevTools |
| Locale mismatch (landing shows "Cuộn mượt" but app shows different Vietnamese) | Medium | Low | Document `tray-labels.ts` as needing sync with `src/i18n/locales/vi.json` whenever app tray strings change |
| Lighthouse regression from `'use client'` boundary hydration cost | Low | Low | Component is small enough to inline into RSC tree; benchmark pre/post |

---

## 10. Out of Scope (deferred)

- Real persistence via localStorage — explicitly excluded per "preview-only" decision.
- Connecting to wasm engine for live scroll feel — explicitly excluded.
- Sharing component code with `src/components/TrayPanel.tsx` — explicitly rejected in brainstorming (Approach C); the current architecture keeps landing and app separated.
- Dark mode toggle animations on Switch — Radix default is sufficient.
- Sound effects on toggle — could be added later but adds asset weight.

---

## 11. Acceptance Criteria

- [ ] `landing/components/TrayPreview.tsx` exists and renders identically to current screenshot at first paint.
- [ ] All 5 manual QA items (8.2) pass on Chrome + Firefox + Safari.
- [ ] All 7 unit tests pass.
- [ ] Lighthouse perf ≥ 90 on `/` route.
- [ ] `pnpm tsc --noEmit` clean.
- [ ] `pnpm lint` clean.
- [ ] `landing/public/assets/screenshot-tray.png` deleted.
- [ ] i18n labels switch correctly across `en` / `vi` / `zh`.
- [ ] No new dependencies added to `landing/package.json`.
- [ ] DOM path of the section unchanged: `main#main-content > section.py-20 px-4 bg-muted/30 ... > div.container > div.grid > div > div.flex > div.relative > [TrayPreview root]`.

---

## 12. References

- Real tray panel: `src/components/TrayPanel.tsx` (lines 18-56 MenuItem, 153-222 main render)
- Tray CSS: `src/index.css` (lines 300-740)
- Switch component: `landing/components/ui/switch.tsx`
- Existing section: `landing/components/sections/TrayPreviewSection.tsx`
- Plan v3 (precedent): `docs/superpowers/plans/2026-05-18-landing-v3-implementation.md:3148-3318`
- Related UX plan: `docs/superpowers/specs/2026-07-08-landing-conversion-refresh-design.md`
- Conversion refresh mentions: `2026-05-18-landing-v2-design.md`, `2026-05-17-landing-v2-design.md`