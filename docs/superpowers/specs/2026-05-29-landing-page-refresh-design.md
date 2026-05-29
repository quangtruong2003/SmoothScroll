# Landing Page Refresh — Design Spec

**Date:** 2026-05-29
**Status:** Draft
**Author:** Claude

---

## 1. Overview

Refresh the SmoothScroll landing page (`landing/`) to align with the shipped app's actual features and improve UX/UI quality. The page is a standalone Next.js 15 static site deployed to GitHub Pages. It is NOT embedded in the Tauri app.

**Constraints:**
- Keep the existing visual identity (brand gradient, color system, typography)
- Keep the existing component structure and i18n system
- Fix content errors, fill gaps, improve UX
- Add screenshot mockups for how-it-works page (user will provide later)
- Build locally before any release-triggering push

---

## 2. Content Corrections

### 2.1 Fix Incorrect Values

| Location | Currently says | Should say |
|---|---|---|
| `howItWorks.tabs.sections[].settings[].range` — Step size | "24–300 px" | "10–500 px" |
| `howItWorks.tabs.sections[].settings[].range` — Animation time | "50–500 ms" | "50–1500 ms" |
| `howItWorks.tabs.sections[].settings[].range` — Max acceleration | "1–20×" | correct |
| `howItWorks.tabs.sections[].settings[].range` — Acceleration window | "0–500 ms" | "0–300 ms" |
| `howItWorks.tabs.sections[].settings[].range` — Tail to head ratio | "1–10" | "1–20" |
| Default easing curve | "Exponential Out" | "Quintic Out" |
| Default step size | "144 px" | correct |
| Default animation time | "220 ms" | correct |
| `install.tabs.windows.steps` — step 2 | "no admin required" | confirm against NSIS installer behavior |
| Download filename | "SmoothScrollSetup.exe" | confirm from `tauri.conf.json` (installer config) |

### 2.2 Remove Non-Existent Features from Landing

These features appear in the landing page's how-it-works section but do NOT exist in the shipped app — remove them:

1. **"Enable keyboard smoothing"** setting (no keyboard smoothing in shipped app)
2. **"PageUp / PageDown step"** setting (does not exist)
3. **"Arrow step"** setting (does not exist)
4. **"Show tray icon state"** UI control (exists in settings schema but no exposed toggle)

### 2.3 Add Missing Content from App

The shipped app has features/settings that the landing page does not mention. Add them:

**Features section (main page):**
- Add feature: **"Presets"** — 6 one-click presets (Slow / Default / Fast / Snappy / Mac-like / Linear) alongside or replacing "Zero configuration"
- Add feature: **"Easing curve preview"** — visual graph in the app
- Add feature: **"Touchpad smoothing"** — separate smoothing for precision touchpads with pixel multiplier and acceleration factor
- Add feature: **"Direction controls"** — reverse direction, horizontal invert, zoom invert
- Add feature: **"Onboarding wizard"** — 3-step wizard with live WASM preview

**How-it-works page — Tab structure change:**
The shipped app has **7 tabs**, but the landing uses a different tab structure. Align the tab IDs and add missing settings:

Current landing tab structure → Shipped app tab structure:

| Landing (current) | App (actual) | Action |
|---|---|---|
| Scroll (8 settings) | Scroll (split: Enable, Presets, DirectionSection, AppearanceSection) | Add Presets, Direction controls, Easing curve |
| Devices (6 settings) | Devices (TouchpadSection only, 3 settings) | Remove keyboard smoothing; add touchpad controls |
| Advanced (7 settings) | Advanced (5 settings + TouchpadSection) | Remove keyboard PageUp/Arrow step; fix ranges |
| Apps (3 settings) | Apps (ProfilesSection + ExcludedAppsSection) | Expand — add ProfileEditor, auto-suggestions |
| Game mode (2 settings) | Game Mode (2 settings + known games list) | Expand — mention known games list |
| Behavior (6 settings) | Behavior (5 settings) | Remove `showTrayIconState`; add Reduce Motion |
| About (5 settings) | About (BackupSection + AboutSection) | Add Backup & Restore |

**Direction tab content (new — add to Scroll section):**
- Reverse wheel direction: On/Off, default Off
- Horizontal smoothness: On/Off, default On
- Horizontal invert: On/Off, default On
- Smooth zoom: On/Off
- Zoom invert: On/Off

**Apps tab — add ProfileEditor details:**
- ProfileEditor dialog: name, step size, animation time, accel window, accel max, tail ratio, easing toggle, easing curve, reverse direction, horizontal smoothness
- Auto-suggestion: app category classification (Browser, IDE, Office, PDF, Terminal, Chat, Media, Game) + one-click preset recommendation

**Behavior tab — add Reduce Motion:**
- Three modes: Auto (follow OS), Always instant, Always smooth
- OS Reduce Motion status indicator

**Stats section:**
- GitHub stars: fetch live
- Downloads: fetch live (from GitHub release assets + fake offset)
- Version: from `NEXT_PUBLIC_APP_VERSION` env var

---

## 3. UX Improvements

### 3.1 Responsive Fixes

The landing page uses `container`, `sm:`, `lg:` breakpoints. Audit all sections:

- **Hero**: Ensure CTA buttons stack properly on mobile (<640px)
- **Features**: Change from `sm:grid-cols-2 lg:grid-cols-3` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **UseCases**: Ensure tab content is readable on mobile
- **Stats**: Ensure numbers don't overflow on small screens
- **StickyDownloadBar**: Ensure it doesn't overlap content on mobile
- **FAQ**: Ensure accordion items are readable on narrow viewports

### 3.2 Navigation Improvements

- Add a **sticky top navigation bar** with logo, nav links (Features, How it Works, FAQ), and download CTA — currently there is no top nav
- Add **smooth scroll** to anchor links
- Ensure **back to top** button appears after scrolling past hero

### 3.3 Dark Mode

The page already has dark mode support (`.dark` class in CSS variables). Audit all sections for dark mode consistency:

- All sections must use `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground` CSS variables
- Ensure the brand gradient (brand-from/brand-to) works on dark backgrounds
- Test dark mode on all section components: Hero, PainPoints, Features, UseCases, TrayPreviewSection, Stats, Indie, Install, FAQ, FinalCTA, and how-it-works sections

### 3.4 Performance / SEO

- Ensure all images have proper `alt` attributes
- Add `loading="lazy"` to below-fold images
- Verify JSON-LD structured data is valid
- Check that canonical URLs are correct for each language
- Ensure meta descriptions exist for all 3 languages

### 3.5 Accessibility

- All interactive elements must be keyboard-navigable
- Add `aria-label` to icon-only buttons
- Ensure color contrast meets WCAG AA standards for both light and dark modes
- Ensure focus states are visible

### 3.6 Install Section Improvements

- Show the actual installer filename dynamically from `NEXT_PUBLIC_APP_VERSION`
- Add a note about the MSI installer as an alternative
- Ensure the Windows/macOS tab switching is accessible
- Add "Already have it?" link for existing users

### 3.7 How-It-Works Page Improvements

- **Add screenshot placeholder**: The `DemoFrame` component shows an animated GIF. Replace with actual app screenshot (user will provide). Design a placeholder frame that shows where the screenshot goes.
- **Add easing curve visualization**: Show a small SVG graph of the easing curve (ExponentialOut, CubicOut, QuinticOut, Linear) in the Animation tab section — this is a key differentiator
- **Add preset showcase**: Show the 6 presets with their values in the Scroll section
- **Add app category icons**: Show Browser, IDE, PDF, etc. icons in the Apps section
- **Improve shortcuts table**: Make it responsive (scrollable on mobile)
- **Improve tray actions visual**: Consider a small illustration/mockup of the tray panel

---

## 4. i18n Gap Analysis

The landing page supports 3 languages (en, vi, zh). The shipped app supports 14 languages.

**Translation gaps in landing:**

| Key area | en | vi | zh | Action |
|---|---|---|---|---|
| New Direction section | needs content | translate | translate | Add to all 3 lang files |
| New Presets feature | needs content | translate | translate | Add to all 3 lang files |
| New Onboarding section | needs content | translate | translate | Add to all 3 lang files |
| Reduce Motion setting | needs content | translate | translate | Add to all 3 lang files |
| Auto-suggestions in Apps | needs content | translate | translate | Add to all 3 lang files |
| Tail-to-head ratio | "tail to head ratio" | "tỷ lệ đuôi-đầu" | "头尾比" | Fix in translations |
| Zoom controls | partial | partial | partial | Expand in all 3 lang files |

---

## 5. New Components to Create

### 5.1 `TopNav` (new component)
- Sticky navigation bar at top
- Logo + wordmark on left
- Links: Features, How it Works, FAQ on right
- CTA button: Download
- Collapses to hamburger menu on mobile
- Blur backdrop effect, subtle border bottom

### 5.2 `EasingCurveViz` (new component)
- SVG visualization of 4 easing curves
- Interactive: click to highlight each curve
- Shows in Animation tab section of how-it-works page
- Uses brand colors

### 5.3 `PresetShowcase` (new component)
- Shows the 6 presets with their key values
- Interactive: hover/click to see full values
- Shows in Scroll section of how-it-works page

### 5.4 `ScreenshotFrame` (update `DemoFrame`)
- Wraps user-provided screenshot in a browser-chrome frame
- Loading skeleton while image loads
- Fallback gradient if no image provided
- Caption below with translation

### 5.5 `AppCategoryBadges` (new component)
- Shows app category icons (Browser, IDE, PDF, etc.)
- Used in Apps tab section of how-it-works page

---

## 6. Files to Modify

### Translation files (all 3 languages)
- `landing/lib/i18n/en.json` — source of truth
- `landing/lib/i18n/vi.json`
- `landing/lib/i18n/zh.json`
- `landing/lib/i18n/dict.ts` — add new type definitions

### Components to modify
- `landing/app/[lang]/page.tsx` — add TopNav
- `landing/app/layout.tsx` — add TopNav
- `landing/components/sections/Features.tsx` — update feature list
- `landing/components/sections/howItWorks/TabSections.tsx` — update tab structure
- `landing/components/sections/howItWorks/DemoFrame.tsx` — add screenshot frame
- `landing/components/sections/Install.tsx` — dynamic filename, MSI note

### Components to create
- `landing/components/TopNav.tsx`
- `landing/components/EasingCurveViz.tsx`
- `landing/components/PresetShowcase.tsx`
- `landing/components/AppCategoryBadges.tsx`

### How-it-works sections to update
- `landing/components/sections/howItWorks/BigPicture.tsx` — confirm accuracy
- `landing/components/sections/howItWorks/ShortcutsTable.tsx` — responsive scroll
- `landing/components/sections/howItWorks/TrayActions.tsx` — add illustration
- `landing/components/sections/howItWorks/Recipes.tsx` — verify recipes match app presets

---

## 7. Build & Deployment

1. `cd landing && pnpm build` — builds to `landing.next/`
2. `pnpm run build:wasm` in root (if WASM engine is referenced)
3. Copy `landing.next/` content to deployment target
4. For Tauri release: copy built assets into `src-tauri/` bundle

---

## 8. Out of Scope

- Any changes to the Tauri app (`src/`, `src-tauri/`)
- Redesigning the visual identity (brand colors, typography, layout structure)
- Adding new pages beyond the existing home and how-it-works
- Deploying to a new platform
- A/B testing or analytics
- Adding a blog or changelog page
