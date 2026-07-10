# SmoothScroll Landing Page v2 — Design Spec

**Status:** Draft for review
**Date:** 2026-05-17
**Goal:** Every visitor wants to download immediately.

---

## 1. Context

Current landing at `https://smoothscroll.top/` is a single-file MVP shipped during the SEO launch (Phase 3 of `2026-05-17-seo-launch.md`). It serves SEO needs (JSON-LD, sitemap, basic structure) but is conversion-thin: a generic feature list with no demonstration, no urgency, no install path beyond a GitHub Releases link.

This v2 redesigns the landing for a single goal: **a first-time visitor on Windows/Mac downloads SmoothScroll within 30 seconds.**

## 2. Target user

Office worker / power user on Windows 10, Windows 11, or macOS 12+. Not a developer. Examples:
- Designer who switched from Mac to Windows and finds scrolling jarring
- Office worker who upgraded to a new mouse and wants smoother feel
- Student who saw the app on Reddit and is curious

Implications:
- Plain-English copy. No "WH_MOUSE_LL", no "trait abstractions", no "120 Hz easing" front-and-center.
- Install must feel one-click. Trust signals everywhere (free, no signup, no ads, MIT, no telemetry).
- Show-don't-tell — visual demonstration of the product, not jargon.

## 3. Goals & non-goals

### Goals
- **Conversion:** ≥30% of unique visitors click the primary download CTA
- **Speed:** LCP < 2s on 4G mobile, total page weight < 500KB
- **i18n:** Native landing in English, Vietnamese, Simplified Chinese with auto-detect
- **SEO:** Lighthouse SEO 100, all 3 languages indexed, hreflang siblings
- **Accessibility:** WCAG 2.2 AA contrast, keyboard nav, reduced-motion support
- **No regression:** Keep JSON-LD (SoftwareApplication + FAQPage) and the GSC verification file

### Non-goals (out of scope for v2)
- User accounts, signup, email capture
- Pricing or purchase flow
- Blog or changelog (link to GitHub Releases)
- Live chat / comments / reviews
- Multi-page architecture
- A/B testing infrastructure
- Analytics beyond GitHub Pages access logs

## 4. Architecture

### File layout (gh-pages branch)

```
/                                    # orphan branch, public
├── index.html                       # JS-based language redirector
├── en/index.html                    # canonical English
├── vi/index.html                    # Vietnamese
├── zh/index.html                    # Simplified Chinese
├── styles.css                       # shared styles, all languages
├── scripts/
│   ├── download.js                  # OS detect + GitHub API fetch
│   └── ui.js                        # FAQ accordion, install tabs, scroll spy
├── assets/
│   ├── icon-128.png
│   ├── og-image.png                 # 1200×630 social card (NEW)
│   ├── screenshot-settings.webp     # main settings UI
│   ├── screenshot-tray.webp         # tray menu open
│   ├── screenshot-exclusion.webp    # per-app exclusion list
│   └── screenshot-theme.webp        # theme switcher
├── sitemap.xml                      # 3 URLs with hreflang
├── robots.txt
├── .nojekyll
└── googleb5a10d9504de3274.html      # KEEP — GSC verification (do not delete)
```

### Language strategy

**3 separate HTML files instead of 1 file + JS swap:**
- Google indexes each `<html lang>` independently → distinct ranking per market
- `hreflang` cross-links tell Google these are siblings, not duplicates
- Each file ships only its language → smaller initial payload per request
- No JS dependency for SEO crawlers

**Auto-detect on root `/index.html`:**
```js
const lang = navigator.language.toLowerCase();
const stored = localStorage.getItem('ssc-lang');
const target =
  stored ||
  (lang.startsWith('vi') ? 'vi' :
   lang.startsWith('zh') ? 'zh' :
   'en');
location.replace(`/SmoothScroll/${target}/`);
```

**Manual override:** dropdown in header → write `localStorage['ssc-lang']` → reload.

**SEO hreflang block** in each language `<head>`:
```html
<link rel="alternate" hreflang="en" href="https://smoothscroll.top/en/">
<link rel="alternate" hreflang="vi" href="https://smoothscroll.top/vi/">
<link rel="alternate" hreflang="zh-Hans" href="https://smoothscroll.top/zh/">
<link rel="alternate" hreflang="x-default" href="https://smoothscroll.top/en/">
```

### Tech stack

- **Vanilla HTML / CSS / JS.** No build step, no framework, no bundler.
- **CSS custom properties** for theming + dark mode via `prefers-color-scheme`
- **No tracking, no analytics scripts.** GitHub Pages access logs sufficient.
- **No external CDN dependencies.** All assets self-hosted.
- **System fonts only.** No web font loading delay.

## 5. Section-by-section design

### 5.1 Header (sticky)

- Sticky on scroll, `backdrop-filter: blur(12px)`, semi-transparent background
- Padding shrinks 16px → 10px after 100px scroll
- Anchor links: `#features` `#install` `#faq` smooth-scroll
- Lang dropdown: writes localStorage + redirects to language path
- GitHub star button: real GitHub button via `<iframe>` (live star count)

### 5.2 Hero

```
┌──────────────────────────────────────────────────────────────────┐
│              Scroll like you've always wanted.                   │
│                                                                  │
│        Buttery-smooth mouse-wheel scrolling for                  │
│        Windows and Mac. Free. No setup. Just install.            │
│                                                                  │
│             [  ⬇  Download for Windows  ]                        │
│             v0.1.13  ·  free  ·  4.2 MB  ·  no signup            │
│             Other downloads ↓                                    │
│                                                                  │
│        ╭────────────────────────────────────────────╮            │
│        │  Settings panel screenshot (back layer)    │            │
│        │   ┌──────────────────┐                     │            │
│        │   │ Tray menu peek   │  (front layer)      │            │
│        │   └──────────────────┘                     │            │
│        ╰────────────────────────────────────────────╯            │
└──────────────────────────────────────────────────────────────────┘
```

- **H1:** `Scroll like you've always wanted.` Subtle gradient text. `clamp(2.5rem, 5vw, 4.5rem)`.
- **Subhead:** `Buttery-smooth mouse-wheel scrolling for Windows and Mac. Free. No setup. Just install.`
- **CTA:** dynamic per OS detection (§ 6).
- **Micro trust line:** `v{VERSION}  ·  free  ·  {SIZE}  ·  no signup` — `{VERSION}` and `{SIZE}` fetched live from GitHub Releases API.
- **Other downloads ↓:** click expand inline, no navigation.

**Visual composite:** single `<div>` with `position: relative` + 2 `<img>` children using `position: absolute` for tray peek. Both with explicit `width/height` (no CLS).

**Video swap-in path:** when demo `.mp4` available, swap back-layer `<img>` for `<video autoplay muted loop playsinline>` — same dimensions/border-radius, no other changes.

### 5.3 Before/After ("See the difference")

```
┌── BEFORE ──────────────┐    ┌── AFTER ───────────────┐
│   ▌ choppy             │    │   ░ buttery            │
│   ▌ jumps              │    │   ░ smooth             │
│   ▌ stops abruptly     │    │   ░ glides             │
│  [step-jump animation] │    │  [eased CSS animation] │
└────────────────────────┘    └────────────────────────┘
       Your scroll wheel, finally smooth.
```

Pure CSS animation — both columns show identical text content scrolling. "Before" uses `animation-timing-function: steps(8, end)` to simulate jumpy ticks. "After" uses `cubic-bezier(0.16, 1, 0.3, 1)`. Same duration, same distance.

Triggered on scroll-into-view via `IntersectionObserver`. Respects `prefers-reduced-motion` — falls back to static labels.

### 5.4 Features (2×3 grid)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ ✦ Works      │  │ ⚡ Lightning  │  │ 🎯 Per-app   │
│   everywhere │  │    fast      │  │    control   │
│              │  │              │  │              │
│ Browsers,    │  │ 120 Hz       │  │ Disable for  │
│ Word, Excel, │  │ pulses, no   │  │ games or     │
│ Photoshop —  │  │ input lag.   │  │ apps you     │
│ any app.     │  │ 4 MB binary. │  │ don't want.  │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 🔒 Private &  │  │ 🆓 Free      │  │ ⌨ Hotkey    │
│   open source│  │    forever   │  │    toggle    │
│              │  │              │  │              │
│ No telemetry │  │ MIT-licensed.│  │ Ctrl+Alt+S   │
│ no ads,      │  │ No tier, no  │  │ to toggle    │
│ no signup.   │  │ ads, no nag. │  │ on/off.      │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Card style:** soft surface, `border-radius: 16px`, `border: 1px solid border-color`, hover lifts (`translateY(-2px)`, `box-shadow` deepens).

**Copy is benefit-led, not feature-led.** "Works everywhere" not "WH_MOUSE_LL".

### 5.5 Screenshots showcase (bento layout)

```
┌────────────────────────────┐  ┌─────────────────────────┐
│  [ Settings UI — 2c×2r ]   │  │  [ Theme switcher ]     │
│                            │  ├─────────────────────────┤
│                            │  │  [ Per-app exclusion ]  │
└────────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌──────────────────────────────┐
│  [ Tray menu open ]     │  │   [ Easing curve picker ]    │
└─────────────────────────┘  └──────────────────────────────┘
```

CSS Grid bento, 4 columns desktop, stacks single column on mobile.

**Click-to-zoom:** vanilla `<dialog>` lightbox. Esc/backdrop-click closes. No external library.

### 5.6 How it works (3 steps)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│      1       │    │      2       │    │      3       │
│  Download    │    │   Install    │    │    Done.     │
│  4 MB, free  │    │  Per-user,   │    │  Scroll any  │
│  no signup   │    │  no admin,   │    │  app, any-   │
│              │    │  no reboot   │    │  where.      │
└──────────────┘    └──────────────┘    └──────────────┘
         [ ⬇ Download for Windows ]  ← repeated CTA
```

Office workers fear "is this hard to install?". Showing 3 steps with reassuring micro-copy ("no admin, no reboot") removes that fear.

Large `1`, `2`, `3` numbers (display font, ~6rem, accent gradient).

### 5.7 Install (tabbed)

```
╭─[ Windows ]──────╮  ╭─ macOS ─╮

  1. Download SmoothScroll-0.1.13_x64-setup.exe
     [ ⬇ Download (.exe, 4.2 MB) ]
  2. Double-click to install. No admin needed.
  3. SmoothScroll launches automatically. Tray icon (◐) near clock.

  Right-click tray for settings, or Ctrl+Alt+S to toggle smoothing.
```

Tabs auto-selected by `navigator.userAgent`. URL param `?platform=win` for deep-linking.

`<pre>` code blocks with `border: 1px dashed border-color` and "copy" button (clipboard API).

### 5.8 FAQ (accordion)

8 questions from current README, accordion form using native `<details>`/`<summary>` (no JS, accessible by default).

Questions (verbatim):
1. How do I enable smooth scrolling on Windows 11?
2. How do I get Mac-style inertia scrolling on Windows?
3. Is SmoothScroll free?
4. Does SmoothScroll work with gaming mice (Logitech, Razer, MX Master)?
5. How is SmoothScroll different from WizMouse, Logitech SetPoint, or built-in OS smooth scrolling?
6. Is it safe? What about anti-cheat / EAC / BattlEye?
7. Where are settings and logs stored?
8. Does SmoothScroll work on Linux?

JSON-LD `FAQPage` matches all 8 visible questions and their answers. (Current v1 has 4; expand to 8.)

### 5.9 Footer

```
◐ SmoothScroll              GitHub  License  Releases  Issues
Made with ♥ by quangtruong2003          © 2026 · MIT licensed
```

Plain links, no widgets.

### 5.10 Floating download bar

```
                                                       ⬆ to top
┌──────────────────────────────────────────────────────────────┐
│  ◐ SmoothScroll v0.1.13         [ ⬇ Download for Windows ]  │
└──────────────────────────────────────────────────────────────┘
```

Invisible above hero, fades in (`opacity 0→1`, `translateY(20px)→0`) when user scrolls past hero. Stays at viewport bottom. Same OS-detected CTA. Hidden on portrait < 600px (saves vertical space).

## 6. Download UX (detailed)

### 6.1 OS detection

```js
function detectOS() {
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'win';
  return 'other';
}
```

### 6.2 Live release fetch

On page load: one `fetch` to `https://api.github.com/repos/quangtruong2003/SmoothScroll/releases/latest` (no auth, public, 60/hr/IP).

Parse `assets[]`:
- Windows NSIS: filename ends `_x64-setup.exe`
- Windows MSI: filename ends `.msi`
- macOS Apple Silicon DMG: filename ends `_aarch64.dmg`
- macOS Intel DMG (if present): filename ends `_x64.dmg`

Capture `browser_download_url` (direct, not Releases page) and `size` in bytes.

### 6.3 CTA wiring

Primary CTA `href` is the direct asset URL for detected OS. Click → browser downloads immediately.

**Fallback if API fails:** hardcoded fallback URLs at edit time, version label hardcoded. Page never breaks.

### 6.4 "Other downloads" expansion

Inline expand below micro-trust line. All 4 assets with direct URLs and sizes.

## 7. Visual style

### Color tokens (light)

```
--bg          #ffffff
--surface     #fafafa
--fg          #0a0a0a
--muted       #5b6273
--border      #e6e8ee
--accent      #6366f1   (indigo 500)
--accent-2    #8b5cf6   (violet 500)
--accent-fg   #ffffff
--gradient    linear-gradient(135deg, #6366f1, #8b5cf6)
```

### Color tokens (dark, `prefers-color-scheme: dark`)

```
--bg          #0a0b10
--surface     #14151c
--fg          #f5f6fa
--muted       #9aa0b3
--border      #232531
--accent      #818cf8   (indigo 400, brighter for contrast)
--accent-2    #a78bfa
--accent-fg   #0a0b10
--gradient    linear-gradient(135deg, #818cf8, #a78bfa)
```

### Typography

- **System stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`
- **Display weight:** 700 with `letter-spacing: -0.02em` for H1/H2
- **Body:** 400, 1.6 line-height
- **H1:** `clamp(2.5rem, 1rem + 5vw, 4.5rem)`
- **H2:** `clamp(1.875rem, 1rem + 2vw, 2.5rem)`
- **Body:** 1rem (16px), max-width 65ch
- **Micro:** 0.875rem for trust lines

### Spacing & shape

- 8pt scale: 4, 8, 16, 24, 32, 48, 64, 96, 128 px
- Border radius: 8px / 12px / 16px / 999px
- Shadows: card hover, hero composite, floating bar — see implementation plan

### Animation

- **Compositor-friendly only:** `transform`, `opacity`, `filter`. Never `width`, `height`, `top`, `left`.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)`, 200-400ms
- **Reduced motion:** all non-essential animations disabled via `@media (prefers-reduced-motion: reduce)`

## 8. Performance budget

| Asset | Budget | Strategy |
|---|---|---|
| HTML | < 30 KB | Inlined critical CSS, no framework |
| CSS | < 15 KB | Single file, minified |
| JS | < 8 KB | OS detect + GitHub API + UI only |
| Hero composite (2 imgs WebP) | < 200 KB | explicit dims |
| Bento screenshots (4 imgs WebP) | < 250 KB | lazy loaded below fold |
| **Total** | **< 500 KB** | |

| Metric | Target |
|---|---|
| LCP | < 2.0s on 4G |
| INP | < 200ms |
| CLS | < 0.05 |
| Lighthouse Performance | ≥ 95 |
| Lighthouse SEO | 100 |
| Lighthouse Accessibility | ≥ 95 |

## 9. SEO & structured data

### Per-language `<head>`

```html
<title>SmoothScroll — Smooth Mouse Wheel Scrolling for Windows and macOS</title>
<meta name="description" content="...">
<meta name="keywords" content="...">
<link rel="canonical" href="https://smoothscroll.top/en/">
<link rel="alternate" hreflang="en" href=".../en/">
<link rel="alternate" hreflang="vi" href=".../vi/">
<link rel="alternate" hreflang="zh-Hans" href=".../zh/">
<link rel="alternate" hreflang="x-default" href=".../en/">
```

### JSON-LD per page

1. `SoftwareApplication` (same shape as v1; `softwareVersion` updated per release; canonical URL adjusted per language)
2. `FAQPage` with all 8 questions

### Sitemap update

3 language URLs with `<xhtml:link rel="alternate" hreflang>` cross-references. Old single-URL sitemap replaced.

## 10. Accessibility

- WCAG 2.2 AA contrast both light and dark modes
- Keyboard-navigable (anchors + tabs + accordion via native `<details>`)
- Visible `:focus-visible` rings on all interactive elements
- Skip link to `#main` at top
- `aria-label` on icon-only buttons
- All images have `alt` text describing content + intent
- `prefers-reduced-motion: reduce` disables non-essential motion

## 11. Browser support

- Chrome / Edge / Firefox / Safari latest 2 versions
- iOS Safari + Android Chrome
- Graceful degradation: page readable + downloadable with JS off (CTA falls back to GitHub Releases page)

## 12. Open questions / risks

- **GitHub API rate limit:** 60/hr/IP unauthenticated. Acceptable degradation — landing still works on fallback.
- **Vietnamese / Chinese copy quality:** initial translations need owner review (especially Vietnamese) before publish.
- **macOS DMG version asymmetry:** Apple Silicon always ships, Intel sometimes. "Other downloads" reveals only existing assets.
- **Floating download bar on mobile:** could obscure content. Hidden on portrait < 600px width.

## 13. Appendix — language copy reference

### English (canonical)

| Slot | Copy |
|---|---|
| H1 | Scroll like you've always wanted. |
| Subhead | Buttery-smooth mouse-wheel scrolling for Windows and Mac. Free. No setup. Just install. |
| CTA (Win) | ⬇  Download for Windows |
| CTA (Mac) | ⬇  Download for Mac |
| Trust | v{ver}  ·  free  ·  {size}  ·  no signup |
| § 5.3 H2 | See the difference. |
| § 5.4 H2 | What you get. |
| § 5.5 H2 | See it in action. |
| § 5.6 H2 | Three steps. Done. |
| § 5.7 H2 | Install in under a minute. |
| § 5.8 H2 | Questions? Answers. |
| Footer | Made with ♥ by quangtruong2003 · © 2026 · MIT licensed |

### Vietnamese

| Slot | Copy |
|---|---|
| H1 | Cuộn chuột mượt như bạn vẫn mong. |
| Subhead | Cuộn chuột mượt mà cho Windows và Mac. Miễn phí. Không cài đặt phức tạp. Chỉ cần install. |
| CTA (Win) | ⬇  Tải cho Windows |
| CTA (Mac) | ⬇  Tải cho Mac |
| Trust | v{ver}  ·  miễn phí  ·  {size}  ·  không cần đăng ký |
| § 5.3 H2 | Thấy ngay sự khác biệt. |
| § 5.4 H2 | Bạn nhận được gì. |
| § 5.5 H2 | Xem app hoạt động. |
| § 5.6 H2 | Ba bước. Xong. |
| § 5.7 H2 | Cài trong chưa đến một phút. |
| § 5.8 H2 | Có thắc mắc? Đây là câu trả lời. |
| Footer | Làm bởi quangtruong2003 với ♥ · © 2026 · Giấy phép MIT |

### Simplified Chinese

| Slot | Copy |
|---|---|
| H1 | 让滚动如丝般顺滑。 |
| Subhead | 适用于 Windows 和 Mac 的顺滑鼠标滚轮滚动。免费,无需设置,安装即用。 |
| CTA (Win) | ⬇  下载 Windows 版 |
| CTA (Mac) | ⬇  下载 Mac 版 |
| Trust | v{ver}  ·  免费  ·  {size}  ·  无需注册 |
| § 5.3 H2 | 看看区别。 |
| § 5.4 H2 | 你将获得。 |
| § 5.5 H2 | 实际效果。 |
| § 5.6 H2 | 三步完成。 |
| § 5.7 H2 | 一分钟完成安装。 |
| § 5.8 H2 | 常见问题。 |
| Footer | 由 quangtruong2003 用心打造 · © 2026 · MIT 许可证 |

(Translations are starting points — owner reviews + adjusts for natural tone before publish.)

## 14. Migration plan

1. Build new files on `gh-pages` branch in scratch worktree
2. Test all 3 languages locally (`python -m http.server`)
3. Push as a single commit replacing root `index.html`, adding `en/`, `vi/`, `zh/`, scripts, assets
4. **Keep:** `googleb5a10d9504de3274.html`, `.nojekyll`, `robots.txt`, `sitemap.xml` (updated)
5. Wait for Pages rebuild, verify all 3 language URLs return 200, hreflang validates
6. Update Search Console: submit new sitemap, request indexing for `/en/`, `/vi/`, `/zh/`

Old `/index.html` becomes JS redirector; old single-file landing content moves into `/en/index.html` rewritten per this spec.

## 15. Success criteria (7 days post-launch)

- Lighthouse score on `/en/` ≥ 95 across all 4 categories
- All 3 language URLs indexed in Google (`site:smoothscroll.top/`)
- GitHub Releases v0.1.13+ download count increases vs prior 7-day baseline
- Zero accessibility regressions (manual keyboard pass through hero + install + FAQ)

---

**End of spec. Implementation plan to follow via writing-plans skill.**
