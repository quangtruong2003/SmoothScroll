# SmoothScroll Landing - Audit-Driven Redesign & Hardening

**Date:** 2026-07-08
**Scope:** `landing/` folder only (Next.js App Router + Tailwind + shadcn/ui primitives)
**Out of scope:** `src/`, `src-tauri/`, `crates/`, root `package.json`, `Cargo.toml`
**Mode:** REDESIGN - OVERHAUL (visual overhaul, preserve content & IA)
**Approach:** C - Full rebrand + audit-driven fixes across 4 sprints
**Effort estimate:** ~5.5 dev days + 1 day verification ≈ 1 working week

---

## 0. Design Read (design-taste-frontend skill)

> Reading this as: **indie-developer landing for technical Windows power-users, with a minimalist Linear-style language, leaning toward shadcn/ui primitives + system font stack + restrained motion.**

**Dials:**
- `DESIGN_VARIANCE: 5` - symmetric grid baseline, selective asymmetric accents on hero
- `MOTION_INTENSITY: 3` - minimal motion (canvas dot grid + marquee), strict reduced-motion
- `VISUAL_DENSITY: 3` - generous whitespace, `py-20` to `py-24`, `max-w-7xl` content

**Why these dials:** SmoothScroll is a single-purpose utility. Target users scroll thousands of lines per day. They reward clarity, not delight. Visual restraint is itself a trust signal for this audience. The brand wall (16 apps) is the only density spike; everywhere else stays airy.

---

## 1. Audit Inputs & Dedup

Two audit sources were provided:

| Source | Format | Method | Score | Bugs |
|---|---|---|---|---|
| `docs/smoothscroll_audit.md` (hand-written) | Markdown | Code review | UX 82 / UI 85 / A11y 75 / Perf 82 | 7 |
| `docs/smoothscroll_audit.html` | HTML report | Runtime Performance API | UX 78 / UI 82 / A11y 65 / Perf 70 | 12 |

### 1.1 Dedup Result (union, then corrected)

After merging and validating against actual source code in `landing/`, **17 bugs are real**, **4 are false positives** in the HTML audit:

| Audit HTML claim | Reality | Status |
|---|---|---|
| Bug #1 - "32/36 icon thiếu alt" | `BrandMarquee.tsx` uses `<li aria-label={brand.name}>` wrapping decorative `<img alt="">` - **correct WCAG pattern** for decorative icons inside a labelled group | FALSE POSITIVE |
| Bug #3 - "H1 96px cứng" | `Hero.tsx` uses `text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl` - **already responsive scale** | FALSE POSITIVE |
| Bug #5 - "html bg = white khi dark mode" | FOUC inline script DOES set `d.style.background` on `<html>` for dark - measurement artifact, not runtime bug | FALSE POSITIVE |
| "Body muted 3.8:1 fail AA" | Calculated contrast is ~6.2:1 (muted-foreground `240 5% 39.2%` on white), per WCAG formula. Pass AA. | FALSE POSITIVE |

### 1.2 Real Bug List (17 bugs, prioritized)

Severity scale: 🔴 High, 🟡 Medium, 🟢 Low. Quadrant: QW Quick Win, BB Big Bet, FI Fill-in.

| # | Bug | Source | Severity | Sprint |
|---|-----|--------|----------|--------|
| 1 | Dark mode hero text invisible briefly on first toggle (CSS transition race) | Markdown | 🔴 High | S1 |
| 2 | `<html lang>` not set → WCAG 3.1.1 fail + SEO miss | HTML | 🔴 High | S1 |
| 3 | Copy button lacks `aria-live` region → screen reader silent on "Copied" | HTML | 🔴 High | S1 |
| 4 | Language switcher uses `group-hover` CSS only → touch devices cannot open | Markdown | 🟡 Med | S1 |
| 5 | Marquee + canvas have no `prefers-reduced-motion` fallback → WCAG 2.3.3 fail | Markdown | 🟡 Med | S1+S2 |
| 6 | Disabled tab text contrast too low (`#A1A1AA` = 2.6:1, fail AA) | HTML | 🟡 Med | S1 |
| 7 | `TabsTrigger` disabled uses `title=` attribute (not accessible) → no screen-reader hint | HTML | 🟡 Med | S1 |
| 8 | Focus outline thin / low contrast (fails WCAG 2.4.7 3:1) | HTML | 🟡 Med | S1 |
| 9 | Marquee app icons hard to read (mask fade + low opacity) | Markdown | 🟡 Med | S4 (replace with grid) |
| 10 | BackgroundDotGrid reads `prefers-reduced-motion` but **does not use the result** → canvas keeps animating | Code review | 🟡 Med | S2 |
| 11 | Brand marquee has no pause-on-hover → perpetual motion | HTML | 🟡 Med | S2 |
| 12 | 16 icon SVGs fetched individually from `api.iconify.design` CDN → 16 requests + CDN dependency | HTML | 🟡 Med | S2 |
| 13 | `before.gif` / `after.gif` large binary assets → bundle weight | HTML | 🟡 Med | S2 |
| 14 | FAQ accordion `type="single"` → cannot compare answers | HTML | 🟢 Low | S3 |
| 15 | No scroll-to-top button on long page (~6700px) | HTML | 🟢 Low | S3 |
| 16 | Dot pattern background cannot be disabled → accessibility for visually-sensitive users | Markdown | 🟢 Low | S3 |
| 17 | GitHub button hidden on mobile (`sm:hidden`) → loses trust signal | Markdown | 🟢 Low | S3 |

---

## 2. Architecture & Module Map

Strict boundary: all changes inside `landing/`. No edits to `src-tauri/`, `crates/`, root `package.json`, root `Cargo.toml`.

| Layer | Files touched | Sprint |
|---|---|---|
| **L0 - HTML / theme bootstrap** | `landing/app/layout.tsx`, `landing/app/[lang]/layout.tsx`, `landing/app/globals.css` | S1 |
| **L1 - Header / nav primitives** | `landing/components/Navigation.tsx`, `landing/components/LangSwitcher.tsx`, `landing/components/ThemeToggle.tsx`, `landing/lib/useTheme.ts` | S1 |
| **L2 - Section components** | `landing/components/sections/Hero.tsx`, `landing/components/sections/Install.tsx`, `landing/components/sections/FAQ.tsx`, `landing/components/sections/FinalCTA.tsx` | S1+S3+S4 |
| **L3 - Motion / canvas** | `landing/components/BrandMarquee.tsx`, `landing/components/BackgroundDotGrid.tsx`, `landing/lib/ambientEffects.ts`, `landing/lib/dotGrid.ts` | S2+S4 |
| **L4 - Section content (contrast pass)** | `landing/components/sections/Features.tsx`, `landing/components/sections/Stats.tsx`, `landing/components/ui/button.tsx`, `landing/components/ui/badge.tsx` | S1 |
| **L5 - Assets & perf** | `landing/lib/brands.ts`, `landing/components/BrandMarquee.tsx`, `landing/components/sections/ScrollDemo.tsx`, `landing/public/assets/*` | S2 |
| **L6 - Polish UX** | `landing/components/Navigation.tsx` (scroll-to-top), `landing/components/BackgroundDotGrid.tsx` (toggle) | S3 |
| **L7 - Visual redesign** | `landing/components/BrandMarquee.tsx` → `landing/components/LogoWall.tsx` (rename), hero type scale, button contrast audit | S4 |

**Dependency boundary:** Em không thêm npm dependency mới ngoài `@axe-core/playwright` (chỉ devDep, optional). Iconify migration sẽ dùng script `scripts/fetch-brand-icons.mjs` thay vì package mới.

---

## 3. Sprint Plan (4 sprints, sequential)

### Sprint 1 - A11y Foundations (1.5 days) - Quick Wins batch

| Task | Files | Verification |
|---|---|---|
| T1.1 Set `<html lang={locale}>` on `[lang]/layout.tsx`; verify FOUC script does not overwrite | `landing/app/[lang]/layout.tsx`, `landing/app/layout.tsx` | Inspect DOM in DevTools on `/en/` → `lang="en"`, `/vi/` → `lang="vi"` |
| T1.2 Hero dark mode transition race - add `transition-colors duration-150` to h1 + subtitle + trust line; ensure theme toggle flips text class synchronously | `landing/components/sections/Hero.tsx` | Manual: toggle dark → text legible immediately, no flash |
| T1.3 Global reduced-motion CSS guard | `landing/app/globals.css` | `@media (prefers-reduced-motion: reduce)` block appended |
| T1.4 Skip-to-content link as first focusable in `<body>` | `landing/components/Navigation.tsx` or `landing/app/layout.tsx` | Tab on load → skip link appears |
| T1.5 LangSwitcher touch support - replace `group-hover` with `useState open` toggle; keep `hover` for desktop via `@media (hover: hover)`; add `aria-expanded`, `role="menu"`, `role="menuitem"` | `landing/components/LangSwitcher.tsx` | Manual: tap on mobile emulator / DevTools touch → dropdown opens; Tab → menu navigable |
| T1.6 CopyButton aria-live - wrap copy state in `<span role="status" aria-live="polite" className="sr-only">` | `landing/components/sections/Install.tsx` | VoiceOver / NVDA: announces "Copied" |
| T1.7 Disabled tab accessibility - replace `title=` with `aria-describedby` pointing to a visually-hidden span "Coming soon" | `landing/components/sections/Install.tsx`, `landing/components/ui/tabs.tsx` | Screen reader: announces "Linux, tab, dimmed, Coming soon" |
| T1.8 Focus outline - global `:focus-visible` rule with `outline: 2px solid hsl(var(--ring)); outline-offset: 2px`; ensure ring contrast ≥3:1 vs both themes | `landing/app/globals.css` | Tab through page → all interactive elements visible |
| T1.9 Disabled text contrast - bump `--muted-foreground` (dark mode) from `240 5% 64.9%` to `240 4% 70%` (~4.7:1); verify on `<TabsTrigger disabled>` | `landing/app/globals.css` | WebAIM contrast checker ≥4.5:1 |
| T1.10 GitHub button label - add `aria-label="SmoothScroll on GitHub (opens new tab)"` to header anchor; distinct label for footer anchor | `landing/components/Navigation.tsx`, `landing/components/Footer.tsx` | Screen reader: distinguishes two GitHub links |

**Sprint 1 exit criteria:** `pnpm build` green, existing tests pass, manual a11y checklist (Section 5) passes.

### Sprint 2 - Performance & Motion (2 days) - Big Bets

| Task | Files | Verification |
|---|---|---|
| T2.1 BackgroundDotGrid - actually use the `reduced` variable to skip RAF loop when reduced-motion is on; gate animation kick behind `if (!reduced)` | `landing/components/BackgroundDotGrid.tsx` | OS reduced-motion toggle on → canvas frozen, no `requestAnimationFrame` calls |
| T2.2 BrandMarquee reduced-motion + pause-on-hover | `landing/components/BrandMarquee.tsx`, `landing/app/globals.css` | Hover → marquee pauses; OS reduced-motion → static |
| T2.3 Local icon bundle - add `scripts/fetch-brand-icons.mjs` that fetches 16 SVGs from Iconify once into `public/assets/brand-icons/`. Update `brands.ts` to reference local paths. Run script in `prebuild` | `landing/lib/brands.ts`, `landing/scripts/fetch-brand-icons.mjs`, `landing/public/assets/brand-icons/` (new), `landing/package.json` | Network tab → 0 external icon requests |
| T2.4 GIF optimization - convert `before.gif` / `after.gif` to WebM (use `ffmpeg` locally). Keep GIF fallback via `<picture>` element | `landing/public/assets/before-after/*` (new), `landing/components/sections/ScrollDemo.tsx` | Lighthouse transfer size for hero region drops ≥50% |
| T2.5 Image preloading hint - only preload `og-image.png` and the hero visual (NOT every GIF) | `landing/app/[lang]/layout.tsx` | Lighthouse "Preload key images" passes |
| T2.6 Lazy-load brand icons - confirm `loading="lazy"` on `<img>` (already present in BrandMarquee, verify) | `landing/components/BrandMarquee.tsx` | Verify attribute present |

**Sprint 2 exit criteria:** Lighthouse local perf ≥85, 0 external icon requests in Network tab, prefers-reduced-motion respected for both canvas + marquee.

### Sprint 3 - UX Polish (0.5 day) - Fill-ins

| Task | Files | Verification |
|---|---|---|
| T3.1 FAQ multi-expand - `type="single"` → `type="multiple"`; add "Expand all / Collapse all" toggle | `landing/components/sections/FAQ.tsx` | Click "Expand all" → all items open |
| T3.2 Scroll-to-top button - sticky `fixed bottom-6 right-6`; uses `useMotionValue` for scroll progress (or Motion `useScroll`); appears after 500px scroll; `aria-label="Scroll to top"` | `landing/components/Navigation.tsx` (or new `ScrollToTop.tsx`) | Scroll down → button fades in; click → smooth scroll to top |
| T3.3 Dot pattern toggle - small button next to ThemeToggle; sets `data-no-dot-grid` on `<html>`; CSS hides canvas when set | `landing/components/BackgroundDotGrid.tsx`, `landing/components/Navigation.tsx` | Toggle off → canvas hidden |
| T3.4 GitHub button mobile visibility - `hidden sm:flex` → `flex`; hide label via `hidden sm:inline` so icon shows | `landing/components/Navigation.tsx` | Mobile viewport → icon visible |

**Sprint 3 exit criteria:** All 4 fill-ins functional; manual QA on desktop + mobile.

### Sprint 4 - Visual Redesign (1.5 days) - design-taste-frontend application

| Task | Files | Verification |
|---|---|---|
| T4.1 Replace BrandMarquee with static LogoWall - 4-col × 4-row grid on desktop, 2-col on mobile. Each cell: icon + name. Opacity 0.6 → 1.0 on hover. Rename `BrandMarquee.tsx` → `LogoWall.tsx` | `landing/components/LogoWall.tsx` (new), `landing/components/sections/Hero.tsx`, deletion of `BrandMarquee.tsx` | No perpetual motion on landing; all 16 logos visible in one viewport on desktop |
| T4.2 Hero type scale recalibration - `xl:text-8xl` → `xl:text-7xl`; tighten `tracking-tight`; `leading-[1.05]` unchanged | `landing/components/sections/Hero.tsx` | Visual check: H1 fits 14ch max-width without awkward wrap |
| T4.3 Button contrast audit - every primary/secondary CTA verified ≥4.5:1 in both themes; `--primary` foreground vs `--primary` bg verified; button hover state checked | `landing/components/ui/button.tsx`, `landing/app/globals.css` | axe-core 0 violations on buttons |
| T4.4 Empty/loading states - verify ScrollDemo has fallback before mount (no JS) and after-effect | `landing/components/sections/ScrollDemo.tsx`, `landing/components/DemoScroll.tsx` | Throttle JS in DevTools → graceful fallback |
| T4.5 Mobile collapse recheck - explicit `w-full px-4` on every multi-col layout (Hero already correct, verify Features / Stats / TrayPreview) | all section files | Viewport 390px → 0 horizontal scroll, all grids 1-col |
| T4.6 Apply design-taste pre-flight checklist (Section 7 of this spec) | n/a (verification only) | All boxes ticked |

**Sprint 4 exit criteria:** Lighthouse a11y ≥95, perf ≥85, best-practices ≥95; visual check confirms design-taste pre-flight clean.

---

## 4. Testing Strategy (3 layers)

### L1 - Unit tests (`landing/**/*.test.ts` and `*.test.tsx`)

| Sprint | New tests |
|---|---|
| S1 | `LangSwitcher.test.tsx` - touch toggle opens menu; aria-expanded toggles |
| S1 | `Hero.test.tsx` - h1 has `transition-colors` class |
| S2 | `dotGrid.test.ts` - `reduced` flag skips RAF when motion disabled |
| S2 | `brands.test.ts` - every brand has local `src` after migration |
| S3 | `FAQ.test.tsx` - multi-expand allows concurrent open |
| S4 | `LogoWall.test.tsx` - renders 16 cells; no animation classes |

Run: `pnpm test` (vitest). Existing tests must remain green.

### L2 - E2E tests (`landing/e2e/*.spec.ts`)

| Sprint | New specs |
|---|---|
| S1 | `a11y-audit.spec.ts` - runs `@axe-core/playwright` on `/en/`, `/vi/`, `/zh/`, `/en/how-it-works/` → expect 0 violations of severity ≥serious |
| S1 | `mobile-no-overflow.spec.ts` - viewport 390×844, assert `document.documentElement.scrollWidth === document.documentElement.clientWidth` |
| S2 | `reduced-motion.spec.ts` - emulate `prefers-reduced-motion: reduce`, reload, assert no `requestAnimationFrame` calls on canvas; assert `getComputedStyle(brand-marquee-track).animationName === 'none'` |
| S2 | `no-external-icons.spec.ts` - intercept network, count requests to `api.iconify.design` → expect 0 |
| S3 | `scroll-to-top.spec.ts` - scroll down 800px, button visible, click → scrollY = 0 |
| S4 | `visual-regression.spec.ts` (optional) - Playwright `toHaveScreenshot` for hero region at 1440px and 390px |

Run: `pnpm test:e2e` (Playwright). Existing specs must remain green.

### L3 - Manual verification (pre-flight checklist)

This is the design-taste-frontend Section 14 checklist, applied per sprint:

- [ ] Zero em-dashes (`-`) or en-dashes (`-`) anywhere visible. Use hyphen (`-`).
- [ ] Hero text element count ≤ 4 (Badge, H1, P, CTA cluster); trust line + marquee count as separate non-text. (Note: hero currently has 6 - flagged as acceptable for conversion but document.)
- [ ] No scroll cues, no version footers, no "Quietly in use at" copy.
- [ ] Page theme lock: light + dark parity, no mid-page theme inversion.
- [ ] Color consistency lock: single accent (current brand-from `220 90% 65%`), no rogue accent colors.
- [ ] Shape consistency lock: all CTAs `rounded-md`, all cards `rounded-lg` (verify in audit).
- [ ] Button contrast ≥4.5:1 in both themes (Sprint 4 final pass).
- [ ] Eyebrow count ≤ ceil(sectionCount / 3) - currently 1 (Badge in hero) - capped.
- [ ] Marquee count: 0 after Sprint 4 (LogoWall replaces it). Marquee max-one-per-page rule satisfied.
- [ ] Motion claimed = motion shown. Since dial is 3, only ambient micro-motion present. Verify reduced-motion collapses all.
- [ ] Reduced-motion wraps all motion > dial 3.
- [ ] Dark mode tested in both modes before sign-off.
- [ ] Mobile collapse explicit for every multi-col layout.
- [ ] Viewport stability: `min-h-[100dvh]` on hero (verify Hero uses it).

---

## 5. Out of Scope (explicit)

Per CLAUDE.md "surgical changes" rule, em sẽ KHÔNG đụng vào:

- `src-tauri/` (Rust + Tauri shell)
- `src/` (Solid renderer + tray UI)
- `crates/` (Rust crates)
- Root `package.json`, root `Cargo.toml`
- Build workflows in `.github/workflows/`
- Documentation outside this spec (except commit message)

Nếu phát hiện bug nào ở những file đó trong quá trình làm, em sẽ **flag** chứ không sửa - tránh scope creep.

---

## 6. Build & Deploy Verification (per build-locally-before-push.mdc)

Sau khi code xong, em phải verify trước khi push:

1. `cd D:/SmoothScroll && pnpm install` → no errors
2. `cd landing && pnpm build` → Next.js static export succeeds
3. `cd landing && pnpm test` → all unit tests green
4. `cd landing && pnpm test:e2e` (if installed) → all e2e green
5. `pnpm tsc --noEmit` (or `pnpm build` does this) → no TS errors
6. Manual visual check on built site via `pnpm start` or preview

Nếu pass hết → em báo path output + handoff cho anh test trước khi push master. **Không push thẳng lên master** (theo rule `build-locally-before-push.mdc`).

---

## 7. Design-Taste Pre-Flight (mechanical, must tick before sign-off)

- [ ] **Brief inference declared** - Section 0 of this spec
- [ ] **Dial values explicit** - 5 / 3 / 3 (Section 0)
- [ ] **Design system chosen** - shadcn/ui primitives + system font stack (Section 0)
- [ ] **Redesign mode detected** - Overhaul, audit performed (Section 1)
- [ ] **Zero em-dashes anywhere in spec** - re-checked, none present
- [ ] **Page theme lock** - light + dark parity planned
- [ ] **Color consistency lock** - single brand-from accent
- [ ] **Shape consistency lock** - `rounded-md` (CTAs), `rounded-lg` (cards)
- [ ] **Button contrast check** - Sprint 4 final pass
- [ ] **CTA button wrap check** - Hero "Download for Windows" + "See how it works" - verified wrap-free at 1280px+
- [ ] **Form contrast check** - N/A (no forms on landing)
- [ ] **Serif discipline** - system sans-serif throughout, no serif added
- [ ] **Italic descender clearance** - Hero uses italic in title accent (`finally done right`); verify `leading-[1.1]+` for descenders (`y` in "finally")
- [ ] **Hero fits viewport** - H1 2-line max, subtext ≤20 words, CTAs visible without scroll
- [ ] **Hero top padding** - currently `pt-24` (acceptable per skill)
- [ ] **Hero stack discipline** - 6 elements (acceptable trade-off, documented)
- [ ] **Eyebrow count** - 1 (Badge hero), capped ✓
- [ ] **Split-header ban** - no left-big + right-small header pattern
- [ ] **Zigzag cap** - no 3+ consecutive image+text splits (verify in current site)
- [ ] **No duplicate CTA intent** - "Download" and "See how it works" are distinct intents (download vs. learn)
- [ ] **Logo wall = logo only** - Sprint 4 LogoWall must not add category labels
- [ ] **Bento background diversity** - N/A (no bento)
- [ ] **Copy self-audit** - all visible strings re-read
- [ ] **Motion motivated** - Sprint 4 removes marquee, dial 3 = minimal motion, all motivated
- [ ] **Marquee max-one-per-page** - 0 after Sprint 4
- [ ] **Navigation on one line desktop** - verify at 1024px+
- [ ] **Section layout repetition** - Features (grid) ≠ Hero (center) ≠ Install (tabs) ≠ FAQ (accordion) - diverse ✓
- [ ] **Long lists UI** - FAQ uses accordion (correct), brand logos → grid (Sprint 4)
- [ ] **Real images used** - generated screenshots for ScrollDemo, real OG image
- [ ] **No pills/labels on images** - verify
- [ ] **No photo-credit captions as decoration** - verify
- [ ] **No version footers** - verify
- [ ] **No micro-meta under eyebrows** - verify
- [ ] **No decoration text strip at hero bottom** - verify
- [ ] **No floating top-right sub-text** - verify
- [ ] **No scoring/progress bars with bg tracks** - verify
- [ ] **No locale/time/weather strips** - verify
- [ ] **No scroll cues** - verify
- [ ] **No version labels in hero** - Badge text is "WINDOWS · OPEN SOURCE" style, not version labels
- [ ] **No section-numbering eyebrows** - verify
- [ ] **No decorative dots** - verify
- [ ] **No `border-t` + `border-b` on every row** - verify spec lists
- [ ] **Content density** - Hero ≤25-word subtext, FAQ Q&A concise
- [ ] **Quotes ≤3 lines** - N/A (no testimonials on landing)
- [ ] **Motion claimed = motion shown** - dial 3, all motion justified
- [ ] **GSAP / scroll hijack** - N/A (no GSAP, no scroll-hijack)
- [ ] **No `window.addEventListener('scroll')`** - Sprint 3 scroll-to-top uses Motion's `useScroll` or `useMotionValue`
- [ ] **Reduced-motion** - Sprint 1 global CSS + Sprint 2 canvas + Sprint 2 marquee all covered
- [ ] **Dark mode** - both modes verified
- [ ] **Mobile collapse** - Sprint 4 explicit recheck
- [ ] **Viewport stability** - `min-h-[100dvh]` on hero (verify in code)
- [ ] **`useEffect` cleanups** - Sprint 2 canvas already has cleanup, verify
- [ ] **Empty/loading states** - Sprint 4 verify
- [ ] **Cards omitted where possible** - Features section uses cards (acceptable, hierarchy needs it)
- [ ] **Icons** - `lucide-react` (existing, keep - design-taste discourages but project consistency)
- [ ] **Motion isolated** - `'use client'` already on motion components
- [ ] **No AI tells from Section 9** - no Inter as default (using system stack), no AI-purple gradients (brand-from is `220 90% 65%` blue, ok), no 3-equal cards in hero
- [ ] **Core Web Vitals** - Lighthouse target LCP <2.5s, INP <200ms, CLS <0.1
- [ ] **One design system** - shadcn/ui primitives + Tailwind only, no mixing

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Local icon bundle bloats bundle size | Low | Low | Use script (one-time fetch), 16 SVG ≈ 30-50 KB total gzipped |
| FOUC theme regression | Low | Medium | Keep current FOUC inline script, only add `lang` to it |
| New a11y regression per sprint | Medium | Medium | axe-core check end of each sprint, not just S4 |
| LogoWall redesign changes user perception | Low | Low | This is a redesign-overhaul (user-approved Approach C), so expected |
| `ffmpeg` not available for GIF → WebM | Medium | Low | Fallback: keep GIF but `loading="lazy"` + `<picture>` with smaller WebM if available, GIF otherwise |

---

## 9. Open Decisions Resolved

- **lucide-react vs Phosphor/Tabler:** KEEP `lucide-react` (project consistency; design-taste discourages but doesn't ban if existing)
- **Brand wall vs marquee:** LOGO WALL (4×4 grid) - per design-taste Section 9.F marquee max-one rule, and per accessibility perpetual motion concerns
- **Add new design system:** NO - keep shadcn/ui primitives + Tailwind, surgical changes only
- **Add tests for axe-core:** YES, devDep only, Sprint 1 e2e

---

## 10. References

- `landing/app/layout.tsx` - root layout, FOUC script
- `landing/app/[lang]/layout.tsx` - per-locale layout
- `landing/app/globals.css` - theme tokens, base styles
- `landing/components/Navigation.tsx` - header
- `landing/components/LangSwitcher.tsx` - language dropdown
- `landing/components/ThemeToggle.tsx` - theme toggle
- `landing/components/BrandMarquee.tsx` - brand marquee (to be replaced)
- `landing/components/BackgroundDotGrid.tsx` - canvas ambient effect
- `landing/components/sections/Hero.tsx` - hero section
- `landing/components/sections/Install.tsx` - install tabs
- `landing/components/sections/FAQ.tsx` - FAQ accordion
- `landing/lib/brands.ts` - brand list + Iconify URLs
- `landing/lib/useTheme.ts` - theme hook
- `landing/lib/dotGrid.ts` - canvas grid math
- `landing/lib/ambientEffects.ts` - canvas ambient effects
- `landing/components/ui/tabs.tsx`, `accordion.tsx`, `button.tsx`, `badge.tsx` - shadcn primitives

---

## 11. Done Definition

A sprint is "done" when:

1. All tasks in sprint have merged code in working tree
2. `pnpm test` green
3. `pnpm build` green
4. Manual pre-flight checklist for that sprint passes
5. No new lint warnings introduced
6. Spec section for that sprint reviewed and ticked

The whole project is "done" when:

1. All 4 sprints completed
2. Full Section 7 pre-flight checklist ticked
3. Lighthouse (mobile, simulated slow 4G) ≥90 a11y / ≥85 perf / ≥95 SEO / ≥95 best-practices
4. Manual QA on 4 viewports (320, 390, 768, 1440) passes
5. Handoff note for `build-locally-before-push.mdc` rule: path to built artifacts ready for user testing