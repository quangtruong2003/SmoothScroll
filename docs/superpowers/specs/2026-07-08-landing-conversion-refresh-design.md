# Landing Page Conversion Refresh — Design Spec

**Date:** 2026-07-08
**Status:** Approved
**Author:** Honey + Claude (brainstorming session)
**Replaces:** Implicit v3 — this is a focused copy + section-order refresh, not a redesign.

---

## 1. Overview

Refresh `landing/` (Next.js 15 static site on GitHub Pages) so the marketing message reflects what's actually in the shipped app after v1.13–v1.14 features landed. The previous copy still pitches 2024-era features (presets, touchpad sliders) and buries the new wins (120 Hz velocity engine, per-monitor profiles, UWP force-enable, anti-cheat bypass).

**Goals (in priority order):**
1. **Conversion** — every section leads a power user to the single "Download for Windows" CTA. Success = more clicks on that CTA per unique visitor.
2. **Clear messaging** — a visitor lands, understands the product in 5 seconds, and reaches for the download button.
3. **Power-user audience** — copy uses language devs/designers/mouse enthusiasts already speak, not general-consumer fluff.

**Non-goals (explicit):**
- Visual redesign of the design system (Tailwind tokens, Radix primitives, motion lib all stay).
- Adding analytics / tracking.
- New pages beyond the home page (the how-it-works page is a sibling, out of scope here unless trivial).
- App code (`src/`, `src-tauri/`, `crates/`).

**Constraints:**
- Windows is the only supported download path. Linux and macOS are shown but disabled as "Coming Soon".
- i18n must stay in sync across `en.json`, `vi.json`, `zh.json`.
- Lighthouse perf ≥ 90 (same bar as today).

---

## 2. Audience & Message Pillars

**Audience:** Windows power users — developers, designers, mouse enthusiasts, people who've already tried Logi Options+ / WizMouse / KatMouse and bounced. They know what "raw wheel input" means, they know what EAC/BattlEye is, they notice when scroll feels different across monitors.

**Primary message pillar:** "One engine. Every window. You pick the curve."

**Supporting pillars (must surface at least 4 in copy):**
- **120 Hz velocity-based engine** — the engine ticks at the monitor's refresh rate; motion is computed from velocity, not step counts (v1.14.0).
- **Per-monitor profiles** — different curves per physical display (v1.14.0).
- **Per-app profiles** — different curves per foreground process, with auto-suggestion on first run.
- **UWP force-enable** — WinUI apps ignore synthetic wheel events by default; SmoothScroll forces them on (v1.14.0).
- **Game mode auto-bypass** — raw input restored when a known game goes fullscreen, no list to maintain.
- **Anti-cheat / admin bypass** — auto-detects elevated targets (UAC, EAC, BattlEye) and passes through (v1.13.0).
- **Zero telemetry** — no network, settings in `%APPDATA%\SmoothScroll\settings.json`.

---

## 3. Information Architecture

### Section order (home page)

1. **Hero** — title, subtitle, single Windows CTA, secondary "See how it works", brand marquee, trust line.
2. **PainPoints** — 3 items in power-user voice.
3. **SolutionBridge** — single line transition.
4. **Features** — 6 items, ordered by recency/impact (see §5.3).
5. **TrayPreview** — short copy, keep the existing tray screenshot.
6. **Stats** — GitHub stars + version (unchanged).
7. **Indie** — credibility block (unchanged).
8. **FAQ** — existing 9 items + 4 new items for power users.
9. **FinalCTA** — big Windows download CTA.

### Sections removed

- **UseCases** (`landing/components/sections/UseCases.tsx`) — Reading / Coding / Designing tabs. The Features section now does this job more concretely.
- **Linux / macOS download buttons** — replaced with disabled "Coming Soon" chip.

### Sections unchanged structurally

- Stats, Indie, TrayPreview — keep layout, only copy changes for TrayPreview.

---

## 4. Copy Direction per Section

### 4.1 Hero

- **Eyebrow badge:** `Windows 10 / 11 · v1.14.1`
- **Title:** `Mouse wheel scrolling, **finally done right**.`
- **Subtitle:** `A 120 Hz easing engine for every wheel tick, in every app. Built for people who notice the difference between a smooth scroll and a stuttering one.`
- **Primary CTA:** `Download for Windows` — links directly to the latest GitHub release `.exe` (no OS detection switch in the button itself).
- **Secondary CTA:** `See how it works` — links to `/{lang}/how-it-works`.
- **Trust line:** `Free. No telemetry. Open-source (FSL-1.1 → Apache 2.0).`
- **Brand marquee:** kept below the trust line, unchanged.

### 4.2 PainPoints (3 items, power-user voice)

1. **Every app rolls its own** — Chrome does it, Edge does it, Explorer doesn't. You're stuck with whatever each dev shipped.
2. **Premium scroll costs premium** — Logi Options+ is fine until you switch mice. WizMouse hasn't been updated since 2014.
3. **Anti-cheat hates your tools** — Most input utilities get flagged. SmoothScroll auto-bypasses admin apps so you don't have to.

### 4.3 SolutionBridge

`One engine. Every window. You pick the curve.`

### 4.4 Features (6 items — ordered by impact)

| # | Title | Description | Icon |
|---|---|---|---|
| 1 | **Velocity-based 120 Hz engine** | Each wheel tick is eased into a smooth pulse, fired at your monitor's refresh rate. Step-based was 2016. | `Zap` |
| 2 | **Per-monitor profiles** | Your 4K at home and your 1080p at the office scroll differently. Match the curve to the screen. | `Monitor` |
| 3 | **Per-app profiles** | Chrome gets snappy, VS Code gets silky, Photoshop gets raw. Auto-suggested on first launch. | `AppWindow` |
| 4 | **UWP force-enable** | WinUI apps ignore synthetic wheel events by default. We force-enable so they actually scroll. | `Layers` |
| 5 | **Game mode auto-bypass** | Foreground flips to a known game → raw input restored. No config, no lists to maintain. | `Gamepad2` |
| 6 | **Zero telemetry** | No network calls. No analytics. Settings live in `%APPDATA%\SmoothScroll\settings.json`. | `Shield` |

### 4.5 TrayPreview

- **Title:** `It lives in your system tray.`
- **Subtitle:** `A tray panel that does the obvious things — toggle on, toggle off, open settings, switch off for the current app. That's it.`
- **Image:** keep `public/assets/screenshot-tray.png` unchanged.

### 4.6 Stats

- Unchanged. Still shows live GitHub stars and the latest release tag.

### 4.7 Indie

- Unchanged.

### 4.8 FAQ (existing 9 + 4 new)

**Existing items kept:**
- Works with all apps
- Battery impact
- What does it install / safety
- vs Windows built-in smooth scrolling
- Gaming mice / high-DPI
- Per-app exclusion
- Windows versions
- Linux
- Uninstall

**New items added:**

1. **Does this work with UWP / WinUI apps?** — Yes. WinUI apps ignore synthetic wheel events by default; SmoothScroll uses a force-enable hook so scrolling actually reaches them. Toggle is in Settings → Scroll.
2. **Will anti-cheat flag this?** — SmoothScroll auto-detects elevated targets (admin / UAC prompts) and passes raw input through, so anti-cheat sees standard wheel ticks. No exclusions to configure.
3. **How is this different from Logi Options+ or Razer Synapse?** — SmoothScroll works with any mouse the OS recognises, not a vendor's hardware. It runs at the OS level, not the device-driver level, so it survives you switching peripherals.
4. **Can I sync scroll direction with my Mac?** — Yes. The "Reverse direction" toggle is per-profile, so you can match the feel of a Mac you also use without affecting your Windows-native apps.

### 4.9 FinalCTA

- **Title:** `Stop fighting your scroll wheel.`
- **Subtitle:** `One download. One toggle. You'll feel it in the first five seconds.`
- **CTA:** `Download for Windows`
- **Background:** darker surface (`bg-foreground text-background`) so the CTA pops.

---

## 5. Component Changes

### 5.1 `Hero.tsx`

- Replace the multi-OS `DownloadCTA` with a single Windows download button (see §5.2).
- Eyebrow badge content: `Windows 10 / 11 · v1.14.1`.
- Remove `BetaNotice` from the hero (no longer relevant for the Windows-only pitch).
- Keep `BrandMarquee` and the secondary "See how it works" link.

### 5.2 `DownloadCTA.tsx`

- **Add a sibling component `landing/components/DownloadButtonWin.tsx`** (do NOT modify `DownloadCTA.tsx` itself — it is referenced by `ExitIntentModal` and others, and out-of-scope risk is high).
- `DownloadButtonWin`:
  - Always renders the Windows `.exe` download.
  - Ignores OS detection.
  - Uses the same button sizes / variants as `DownloadCTA` for visual parity.
- The hero and `FinalCTA` use the new `DownloadButtonWin`.
- Linux / macOS CTA buttons are removed; in their place a small `<Badge>` reading `Coming Soon` is rendered (disabled state) wherever a non-Windows CTA used to live (hero, FinalCTA, ExitIntent).

### 5.3 `PainPoints.tsx`

- Replace `Settings2, Layers, Cpu` icons with `Mouse, Gamepad2, Shield`.
- Update copy per §4.2.

### 5.4 `SolutionBridge.tsx`

- Update copy to `One engine. Every window. You pick the curve.`
- Slightly larger font (`text-2xl md:text-3xl`) so it reads as a section pivot, not a footnote.

### 5.5 `Features.tsx`

- Replace `Settings2, Layers, Cpu, Battery, ShieldCheck, ToggleLeft` icons with `Zap, Monitor, AppWindow, Layers, Gamepad2, Shield` in that order.
- Replace the 6 items with the table in §4.4.
- Hover effect: subtle `translate-y-1` on hover + accent border.

### 5.6 `TrayPreviewSection.tsx`

- Shorter subtitle per §4.5.

### 5.7 `FAQ.tsx`

- Append the 4 new items per §4.8.
- Update the existing "Per-app exclusion" wording to reflect the new auto-suggestion flow.

### 5.8 `FinalCTA.tsx`

- Switch to inverted surface (`bg-foreground text-background`).
- Update title/subtitle/CTA per §4.9.
- Use the new `DownloadButtonWin` component.

### 5.9 `[lang]/page.tsx`

- Remove the `<UseCases />` import and render.
- Remove dict destructure for `useCases`.

### 5.10 Components to delete

- `landing/components/sections/UseCases.tsx`

### 5.11 Components kept as-is

- `BetaNotice.tsx` — still wired up, just no longer called from Hero. ExitIntentModal or future use may import it.
- `ExitIntentModal.tsx`, `LangSwitcher.tsx`, `Navigation.tsx`, `ThemeToggle.tsx`, `BackgroundDotGrid.tsx`, `FlagIcon.tsx` — all unchanged.

---

## 6. i18n

### Files modified

- `landing/lib/i18n/en.json` — source of truth.
- `landing/lib/i18n/vi.json` — Vietnamese translation.
- `landing/lib/i18n/zh.json` — Simplified Chinese translation.
- `landing/lib/i18n/dict.ts` — update type signatures if any new keys land (none expected; we reuse existing slots).

### Keys removed

- `useCases` block (entire object) — no longer rendered.

### Keys updated

- `hero.title`, `hero.titleAccent`, `hero.subtitle`, `hero.cta`, `hero.trustLine`, `hero.eyebrow` (and platform variants stay as fallbacks even though unused in copy).
- `painPoints.title`, `painPoints.points[]`.
- `solutionBridge.line`.
- `features.title`, `features.items[]`.
- `trayPreview.title`, `trayPreview.subtitle`.
- `faq.questions[]` — append 4 items, keep existing 9.
- `finalCta.title`, `finalCta.subtitle`, `finalCta.cta`.

### Translation sync rules

- `en.json` is updated first and is authoritative.
- `vi.json` and `zh.json` are updated in the same commit; if a translation is uncertain, fall back to English in the dict, then fix in a follow-up.

---

## 7. Files to Modify

| Path | Change |
|---|---|
| `landing/components/sections/Hero.tsx` | Copy + Windows-only CTA |
| `landing/components/sections/PainPoints.tsx` | Copy + icon swap |
| `landing/components/sections/SolutionBridge.tsx` | Copy + type bump |
| `landing/components/sections/Features.tsx` | Copy + icon swap + reorder |
| `landing/components/sections/TrayPreviewSection.tsx` | Copy |
| `landing/components/sections/FAQ.tsx` | Append 4 items |
| `landing/components/sections/FinalCTA.tsx` | Copy + inverted surface + Windows CTA |
| `landing/components/DownloadButtonWin.tsx` | **New component** — Windows-only download button (sibling of `DownloadCTA`) |
| `landing/app/[lang]/page.tsx` | Remove `UseCases` import + render |
| `landing/lib/i18n/en.json` | Source-of-truth copy update |
| `landing/lib/i18n/vi.json` | Vietnamese copy update |
| `landing/lib/i18n/zh.json` | Chinese copy update |

## 8. Files to Delete

| Path | Reason |
|---|---|
| `landing/components/sections/UseCases.tsx` | Section removed per §3 |

## 9. Build, Verify, Ship

1. `cd landing && pnpm build` — must complete with zero TypeScript errors.
2. `pnpm exec next start` (or `pnpm dev`) — manual visual sweep:
   - Hero renders single Windows CTA, no Linux/macOS buttons.
   - PainPoints shows 3 new items with new icons.
   - Features list shows 6 new items in new order.
   - FAQ accordion expands all 13 items.
   - FinalCTA inverts correctly in both light and dark.
3. Lighthouse audit on the built output — confirm perf ≥ 90.
4. Mobile responsive spot-check at 375px and 768px.
5. Build verification of the parent app is NOT in scope (landing-only update). However, if `package.json` is touched, run the parent `pnpm run build` to confirm nothing else broke.

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| i18n drift between en/vi/zh | Update all three in the same commit; fall back to English in dict for unknown translations and fix in follow-up. |
| FAQ section grows too tall (13 items) | If the section feels bloated after build, drop the 2 lowest-impact existing items (e.g. "Battery impact", "Uninstall") in a follow-up. |
| `DownloadCTA` refactor breaks `ExitIntentModal` | Avoided — `DownloadCTA` is untouched; `DownloadButtonWin` is a new sibling file. |
| Lighthouse regression from new icons | `lucide-react` icons are tree-shaken; no measurable bloat. Verify in step 3. |
| Linux/macOS users confused by "Coming Soon" | Disabled state with a tooltip-like title attribute makes it clear; FAQ + Hero copy acknowledge the gap. |

## 11. Out of Scope

- Changes to the Tauri app (`src/`, `src-tauri/`, `crates/`, `macos/`).
- Adding analytics, A/B testing, or any telemetry.
- Visual redesign of the design system (color tokens, typography, motion library stay).
- New pages beyond home and how-it-works.
- Translation of new copy into languages beyond en / vi / zh.
- Updating the how-it-works page beyond incidental fixes required by the home copy changes.

## 12. Success Criteria (post-launch)

- **Primary:** increase in `download_click` events (GitHub release redirect) per 1k unique visitors vs the previous baseline.
- **Secondary:**
  - Bounce rate on the home page decreases (more visitors scroll past the hero).
  - Time-to-first-CTA decreases (visitors reach the download button faster).
  - No Lighthouse perf regression below 90.
  - No new TypeScript or lint errors.