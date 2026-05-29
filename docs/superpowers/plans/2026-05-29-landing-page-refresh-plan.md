# Landing Page Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the SmoothScroll landing page to fix all content errors, fill missing features, improve UX/responsive, and align with the shipped app's actual capabilities.

**Architecture:** Next.js 15 static site with i18n (en/vi/zh), Tailwind CSS, Motion animations. Content lives in JSON translation files. Components are in `landing/components/sections/`. No backend changes needed.

**Tech Stack:** Next.js 15, Tailwind CSS, Motion/react, Radix UI, Lucide icons, TypeScript.

---

## File Map

```
landing/
├── lib/i18n/
│   ├── en.json          ← primary source of truth
│   ├── vi.json          ← translate from en
│   ├── zh.json          ← translate from en
│   └── dict.ts          ← TypeScript type definitions
├── components/
│   ├── TopNav.tsx       ← NEW
│   ├── EasingCurveViz.tsx  ← NEW
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Install.tsx
│   │   └── howItWorks/
│   │       ├── TabSections.tsx
│   │       ├── DemoFrame.tsx
│   │       └── Recipes.tsx
│   └── ui/
│       └── button.ts
└── app/
    └── [lang]/
        ├── page.tsx
        └── how-it-works/page.tsx
```

---

## Task 1: Fix Translation Content Errors in `en.json`

**Files:**
- Modify: `landing/lib/i18n/en.json`
- Modify: `landing/lib/i18n/dict.ts`

This is the source-of-truth file. All other language files derive from it.

- [ ] **Step 1: Open `landing/lib/i18n/en.json` and locate the `howItWorks.tabs.sections` array**

Find every setting entry with an incorrect `range` or `defaultValue` field and fix:

```
Scroll tab → "Step size" → range: "24–300 px"  → "10–500 px"
Scroll tab → "Animation time" → range: "50–500 ms" → "50–1500 ms"
Scroll tab → "Easing curve" → defaultValue: "Exponential Out" → "Quintic Out"
Advanced tab → "Acceleration window" → range: "0–500 ms" → "0–300 ms"
Advanced tab → "Tail to head ratio" → range: "1–10" → "1–20"
```

- [ ] **Step 2: Remove non-existent settings from Devices tab section**

In `howItWorks.tabs.sections`, find the `devices` section and remove these settings entirely (they do not exist in the shipped app):

```
Remove: "Enable keyboard smoothing (Windows only)" — does not exist
Remove: "PageUp / PageDown step" — does not exist
Remove: "Arrow step" — does not exist
```

- [ ] **Step 3: Remove `showTrayIconState` setting from Behavior tab**

Find the behavior section and remove the setting named "Show tray icon state" (it exists in the settings schema but has no UI control in the shipped app).

- [ ] **Step 4: Fix default values that are wrong**

In the Scroll tab section, update these default values:

```
"Step size" defaultValue: "144 px"  → keep as is (correct)
"Animation time" defaultValue: "220 ms" → keep as is (correct)
```

- [ ] **Step 5: Update `dict.ts` type definitions if needed**

The `dict.ts` types use optional fields (`range?: string`, `defaultValue?: string`, etc.) so no type changes are needed. Verify the `settings` array in `howItWorks.tabs.sections` remains `{ name, what, why?, range?, defaultValue?, tip? }[]`.

- [ ] **Step 6: Add new translation keys for Direction tab and Presets**

Add a new section to `howItWorks.tabs.sections` array called `direction` (id: "direction"). It goes AFTER the Scroll section. The section describes the Direction controls found in the shipped app's Scroll tab:

```json
{
  "id": "direction",
  "label": "Direction",
  "intro": "Fine-tune scroll direction and horizontal/zoom behavior.",
  "settings": [
    {
      "name": "Reverse wheel direction",
      "what": "Inverts wheel scroll direction (natural-style, like macOS).",
      "why": "Match a Mac you also use, or just personal preference.",
      "range": "On / Off",
      "defaultValue": "Off"
    },
    {
      "name": "Horizontal smoothness",
      "what": "Apply easing to tilt-wheel and Shift+wheel horizontal scrolls.",
      "why": "Wide spreadsheets, timelines, image strips all benefit.",
      "range": "On / Off",
      "defaultValue": "On"
    },
    {
      "name": "Horizontal invert",
      "what": "Inverts the horizontal scroll direction.",
      "range": "On / Off",
      "defaultValue": "On"
    },
    {
      "name": "Smooth zoom (Ctrl+Wheel)",
      "what": "Apply easing to Ctrl+Wheel zoom events.",
      "why": "Makes zoom feel consistent with the rest of your scroll.",
      "range": "On / Off",
      "defaultValue": "On"
    },
    {
      "name": "Zoom invert",
      "what": "Inverts zoom direction (scroll up = zoom out).",
      "range": "On / Off",
      "defaultValue": "Off"
    }
  ]
}
```

- [ ] **Step 7: Update Recipes section with correct preset values**

In `howItWorks.recipes.items`, update the `settings` array values to match the shipped app's actual preset values from `src/components/settings/ScrollPresets.tsx`:

| Recipe name | Correct settings |
|---|---|
| "Long-form reading" → "Glide preset" | `step: 80 px, anim: 600 ms, accel delta: 100 ms, accel max: 4×` |
| "Coding in VS Code / JetBrains" → "Balanced preset + modifier passthrough" | `step: 144 px, anim: 280 ms, accel delta: 70 ms, accel max: 10×, + Ctrl/Alt pass-through` |
| "Laptop on battery" → "Snappy preset" | `step: 200 px, anim: 200 ms, accel delta: 30 ms, accel max: 14×` |

Update the `suggestion` strings to match these corrected values.

- [ ] **Step 8: Verify Scroll tab section has presets mentioned**

In the Scroll tab `intro` text, add a note about the 6 one-click presets. Update the intro to:

```
"The main feel controls. Six one-click presets cover 90% of use cases — or dive into the sliders for fine-tuning."
```

- [ ] **Step 9: Verify the `about` section mentions Backup & Restore**

Ensure the About tab section in the landing page mentions `export settings as JSON` and `import settings from JSON`. If missing, add a setting entry:

```json
{
  "name": "Backup & restore",
  "what": "Export full settings as JSON, import on another machine.",
  "why": "Move presets between PCs without redoing every slider.",
  "range": "JSON file",
  "defaultValue": "—"
}
```

---

## Task 2: Update Features Section on Main Page

**Files:**
- Modify: `landing/lib/i18n/en.json` (features section)
- Modify: `landing/lib/i18n/vi.json`
- Modify: `landing/lib/i18n/zh.json`
- Modify: `landing/components/sections/Features.tsx`

- [ ] **Step 1: Update the `features.items` array in `en.json`**

Replace the 6 feature items with updated content that reflects the actual app:

```json
"features": {
  "title": "Everything you need, nothing you don't",
  "items": [
    {
      "title": "Six one-click presets",
      "description": "Slow, Default, Fast, Snappy, Mac-like, Linear — pick the feel that matches your hand in one click."
    },
    {
      "title": "Fine-grained control",
      "description": "Step size, animation time, easing curve, acceleration — every slider tuned for real use cases."
    },
    {
      "title": "Per-app profiles",
      "description": "Different smoothing for Chrome vs VS Code vs Adobe apps. The app auto-suggests the right preset."
    },
    {
      "title": "Touchpad + mouse smoothing",
      "description": "Separate pixel multiplier and acceleration for precision touchpads. Mouse wheel is independent."
    },
    {
      "title": "Game mode auto-disable",
      "description": "SmoothScroll pauses automatically when a known game goes fullscreen. Raw input is preserved."
    },
    {
      "title": "Privacy-first",
      "description": "No telemetry, no network calls, no data collection. Settings and logs stay on your device."
    },
    {
      "title": "Battery friendly",
      "description": "Runs at near-zero CPU when idle. Your battery won't notice it."
    },
    {
      "title": "Instant on/off",
      "description": "Toggle from the system tray or with Ctrl+Alt+S. No restart required."
    }
  ]
}
```

**Note:** The Features component renders icons in a fixed order (6 icons for 8 items — the 6th item reuses the last icon). If 8 items are too many for the 3-column grid, use 6 items and include the most important features. Choose: presets, per-app profiles, fine-grained control, touchpad, game mode, privacy.

- [ ] **Step 2: Update `vi.json` and `zh.json` with translated feature items**

Translate the new feature titles and descriptions into Vietnamese and Chinese.

- [ ] **Step 3: Update `Features.tsx` to handle dynamic item count**

The component currently maps icons by index (`ICONS[idx % ICONS.length]`). If keeping 8 items, ensure there are 8 icons, or use 6 items. The grid already supports dynamic item counts via `f.items ?? []`.

---

## Task 3: Add Responsive Fixes

**Files:**
- Modify: `landing/components/sections/Features.tsx`
- Modify: `landing/components/sections/Hero.tsx`
- Modify: `landing/components/sections/Stats.tsx`
- Modify: `landing/components/sections/UseCases.tsx`
- Modify: `landing/components/StickyDownloadBar.tsx`
- Modify: `landing/components/sections/FAQ.tsx`

- [ ] **Step 1: Fix Features grid responsiveness**

Current: `grid sm:grid-cols-2 lg:grid-cols-3`. This already handles mobile (1 column by default). Check if gap and padding are adequate on mobile. Ensure `py-20 px-4` doesn't cause horizontal overflow on very small screens.

- [ ] **Step 2: Check Hero CTA buttons on mobile**

Read `landing/components/sections/Hero.tsx`. Ensure CTA buttons don't overflow on screens < 375px. If they do, stack them vertically or reduce font size on xs screens.

- [ ] **Step 3: Fix Stats section number overflow**

Read `landing/components/sections/Stats.tsx`. Ensure the star count, download count, and version number don't overflow their containers on small screens. Use `text-ellipsis` or `break-all` if needed.

- [ ] **Step 4: Fix UseCases tabs on mobile**

Read `landing/components/sections/UseCases.tsx`. Ensure tab content is readable with proper text wrapping. Ensure the tab labels don't overflow.

- [ ] **Step 5: Audit all sections for dark mode consistency**

Check every section component uses CSS variable classes (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`) so dark mode renders correctly. Flag any hardcoded `bg-white` or `text-gray-` classes.

- [ ] **Step 6: Fix FAQ accordion on narrow viewports**

Read `landing/components/sections/FAQ.tsx`. Ensure accordion trigger text wraps properly on narrow screens and doesn't overflow horizontally.

---

## Task 4: Create TopNav Component

**Files:**
- Create: `landing/components/TopNav.tsx`
- Modify: `landing/app/layout.tsx`

- [ ] **Step 1: Create `TopNav.tsx`**

Create a sticky navigation bar that appears on scroll (or always visible at top). The nav should include:

- Left: SmoothScroll logo/wordmark
- Center/Right: Features, How it Works, FAQ anchor links
- Right: Download CTA button
- Mobile: Collapse to hamburger menu with a slide-down menu

Use `position: sticky top-0 z-50 backdrop-blur border-b` for the container. Match existing brand colors (`--brand-from`, `--brand-to` gradient for logo accent).

```tsx
// Pseudocode structure:
<nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur">
  <div className="container flex items-center justify-between h-14">
    <Logo />
    <div className="hidden md:flex items-center gap-6">
      <a href="#features">Features</a>
      <a href="/en/how-it-works">How it Works</a>
      <a href="#faq">FAQ</a>
      <DownloadButton />
    </div>
    <MobileMenuButton className="md:hidden" />
  </div>
  {/* Mobile menu */}
</nav>
```

- [ ] **Step 2: Add TopNav to root layout**

In `landing/app/layout.tsx`, add `<TopNav />` after the `<body>` opening tag and before the `{children}`. Ensure the nav appears on all pages.

---

## Task 5: Create EasingCurveViz Component

**Files:**
- Create: `landing/components/EasingCurveViz.tsx`
- Modify: `landing/lib/i18n/en.json` (add translation keys)

- [ ] **Step 1: Create the SVG easing curve visualization**

Create an interactive SVG component that shows 4 easing curves:

```
ExponentialOut: y = 1 - e^(-6x)
CubicOut: y = 1 - (1-x)³
QuinticOut: y = 1 - (1-x)^5
Linear: y = x
```

The SVG should be ~300px wide, ~150px tall, with the axes drawn. Each curve is a colored path with the brand gradient colors. Clicking a legend item highlights that curve and dims the others.

Use an `<svg viewBox="0 0 300 150">` with:
- X axis from (20, 130) to (280, 130)
- Y axis from (20, 130) to (20, 20)
- 4 curve paths, each in a different color

- [ ] **Step 2: Add translation keys for the curve labels**

In `en.json`, add:

```json
"easingViz": {
  "title": "Easing curves",
  "subtitle": "Click a curve to highlight it.",
  "curves": {
    "exponentialOut": "Exponential Out",
    "cubicOut": "Cubic Out",
    "quinticOut": "Quintic Out",
    "linear": "Linear"
  }
}
```

- [ ] **Step 3: Add EasingCurveViz to TabSections in how-it-works page**

In `landing/components/sections/howItWorks/TabSections.tsx`, find the Animation/Appearance section. Add `<EasingCurveViz />` at the top of that section's content, before the setting cards.

---

## Task 6: Update DemoFrame for Screenshot

**Files:**
- Modify: `landing/components/sections/howItWorks/DemoFrame.tsx`
- Modify: `landing/lib/i18n/en.json`

- [ ] **Step 1: Update `DemoFrame.tsx` to handle missing screenshot gracefully**

The component currently references `/assets/screen.gif`. Modify it to:
1. If the image exists, show it wrapped in a browser-chrome frame
2. If the image doesn't exist, show a placeholder with a gradient background and a note: "Screenshot coming soon"
3. Allow user to replace the image by dropping a file in `public/assets/screen.gif`

```tsx
// Add a loading state check:
const [imgError, setImgError] = useState(false)

// Wrap image in browser chrome:
// <div className="rounded-t-lg bg-muted border-b flex gap-1.5 p-2">
//   <div className="w-3 h-3 rounded-full bg-red-400" />
//   <div className="w-3 h-3 rounded-full bg-yellow-400" />
//   <div className="w-3 h-3 rounded-full bg-green-400" />
//   <div className="flex-1 rounded bg-muted-foreground/20" />
// </div>

// If imgError or no src:
// <div className="flex items-center justify-center h-64 bg-gradient-to-br from-brand-from/20 to-brand-to/20 border border-dashed border-border rounded-lg">
//   <p className="text-muted-foreground text-sm">{t('demo.placeholder')}</p>
// </div>
```

- [ ] **Step 2: Add placeholder translation key**

In `en.json`, add to `howItWorks.demo`:

```json
"placeholder": "Screenshot coming soon — place your app screenshot at public/assets/screen.gif"
```

---

## Task 7: Update How-It-Works Tab Sections

**Files:**
- Modify: `landing/lib/i18n/en.json`
- Modify: `landing/components/sections/howItWorks/TabSections.tsx`
- Modify: `landing/components/sections/howItWorks/ShortcutsTable.tsx`

- [ ] **Step 1: Verify tab IDs match the shipped app**

The 7 tabs in the landing page are: `scroll`, `devices`, `advanced`, `apps`, `gamemode`, `behavior`, `about`. These map to the shipped app's sidebar tabs. The new `direction` tab should be inserted within the Scroll tab's settings list, not as a separate tab (the Direction controls are inline in the Scroll tab in the app).

- [ ] **Step 2: Update Devices tab settings in translations**

The Devices tab in the shipped app only has 3 settings:
1. Touchpad smoothing (On/Off, default: On)
2. Touchpad pixel multiplier (0.5–3.0×, default: 1.0×)
3. Touchpad acceleration factor (0–3, default: 1.0)

Update the Devices section in `en.json` accordingly. Remove all keyboard smoothing references.

- [ ] **Step 3: Add "Reduce Motion" to Behavior tab**

In the Behavior tab section, add a new setting:

```json
{
  "name": "Respect system Reduce Motion",
  "what": "Three modes — Auto (follow OS), Always instant, Always smooth.",
  "why": "Honor accessibility preferences automatically.",
  "range": "Auto / Always instant / Always smooth",
  "defaultValue": "Auto"
}
```

- [ ] **Step 4: Make ShortcutsTable responsive**

Read `landing/components/sections/howItWorks/ShortcutsTable.tsx`. Wrap the table in `overflow-x-auto` so it scrolls horizontally on small screens instead of causing horizontal overflow.

- [ ] **Step 5: Verify BigPicture section accuracy**

Read `landing/components/sections/howItWorks/BigPicture.tsx`. Confirm that:
- Step 1 (Intercept): mentions WH_MOUSE_LL (Windows) and CGEventTap (macOS)
- Step 2 (Smooth): mentions easing curves and acceleration
- Step 3 (Emit): mentions 120 Hz synthetic events and excluded apps pass-through

If any details are wrong, fix them.

---

## Task 8: Sync Translations (vi.json, zh.json)

**Files:**
- Modify: `landing/lib/i18n/vi.json`
- Modify: `landing/lib/i18n/zh.json`

- [ ] **Step 1: Translate all new/changed keys into Vietnamese**

Translate these newly added or modified sections into Vietnamese:
- New Direction section (5 settings)
- New Reduce Motion setting in Behavior tab
- New "Six one-click presets" and "Fine-grained control" features
- Updated Recipe settings values
- New easingViz translation keys
- Updated `howItWorks.demo.placeholder`

- [ ] **Step 2: Translate all new/changed keys into Chinese (Simplified)**

Translate the same sections into Simplified Chinese.

---

## Task 9: Final Audit and Build

**Files:**
- Modify: `landing/next.config.mjs` (verify if needed)
- (No file changes — this is a verification task)

- [ ] **Step 1: Run linting**

```bash
cd landing && pnpm lint
```

Expected: No errors. Fix any TypeScript or ESLint errors.

- [ ] **Step 2: Build the site**

```bash
cd landing && pnpm build
```

Expected: Next.js build succeeds with static export. Verify the output in `landing.next/` or configured output directory.

- [ ] **Step 3: Manual visual check**

Open the built site (or run `pnpm dev`) and verify:
- TopNav appears on all pages
- Hero section renders correctly
- Features section shows 6 items in 3-column grid
- How-it-works page shows all 7 tabs with correct content
- Direction tab settings appear in Scroll section
- EasingCurveViz renders on the Animation tab
- DemoFrame shows placeholder or screenshot gracefully
- Dark mode toggle works on all sections
- Mobile layout doesn't overflow horizontally

- [ ] **Step 4: Verify all 3 languages**

Check that `en/`, `vi/`, `zh/` routes all build correctly and show translated content.

---

## Spec Coverage Check

| Spec requirement | Task(s) |
|---|---|
| Fix incorrect ranges (step size, anim time, accel window, tail ratio) | Task 1 |
| Remove non-existent keyboard smoothing / PageUp / Arrow settings | Task 1 |
| Remove showTrayIconState control | Task 1 |
| Add Direction controls (reverse, horizontal, zoom) | Task 1 |
| Add Reduce Motion to Behavior tab | Task 7 |
| Add Presets feature to main page | Task 2 |
| Add Touchpad smoothing feature to main page | Task 2 |
| Add Fine-grained control feature | Task 2 |
| Add Game mode feature | Task 2 |
| Fix recipe preset values | Task 1 |
| Add easing curve visualization | Task 5 |
| Screenshot frame for how-it-works | Task 6 |
| Responsive fixes (Features, Hero, Stats, UseCases, FAQ) | Task 3 |
| Add TopNav | Task 4 |
| Sync Vietnamese translations | Task 8 |
| Sync Chinese translations | Task 8 |
| Dark mode audit | Task 3 |
| Final build & verify | Task 9 |

---

## Placeholder Scan

- All translation values will be filled in during implementation (Tasks 1, 2, 7, 8)
- The screenshot placeholder text guides the user to place their file in `public/assets/screen.gif`
- No TBD/TODO markers remain after Tasks 1-8 are complete

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-29-landing-page-refresh-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
