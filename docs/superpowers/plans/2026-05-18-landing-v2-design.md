# SmoothScroll Landing Page v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-file MVP landing with a 3-language, high-conversion landing page that gets a first-time visitor to download within 30 seconds.

**Architecture:** Static site on `gh-pages` branch. Three separate HTML files (en/vi/zh), one shared CSS file, two shared JS files (download.js + ui.js). OS detection + GitHub Releases API for dynamic download CTAs. CSS custom properties for light/dark theming. No build step, no framework, no external CDN.

**Tech Stack:** Vanilla HTML / CSS / JS. System fonts only. WebP screenshots. GitHub Pages hosting.

---

## File Map

```
/ (gh-pages branch, orphan)
├── index.html                     # JS language redirector (root)
├── en/index.html                 # canonical English landing
├── vi/index.html                 # Vietnamese landing
├── zh/index.html                 # Simplified Chinese landing
├── styles.css                    # All styles, light + dark via CSS vars
├── scripts/
│   ├── download.js               # OS detect + GitHub API + CTA wiring
│   └── ui.js                    # FAQ accordion, install tabs, scroll spy, floating bar
├── assets/
│   ├── icon-128.png             # App icon
│   ├── og-image.png             # 1200×630 social card
│   ├── screenshot-settings.webp # Settings UI screenshot
│   ├── screenshot-tray.webp    # Tray menu open
│   ├── screenshot-exclusion.webp # Per-app exclusion list
│   └── screenshot-theme.webp   # Theme switcher
├── sitemap.xml                   # 3 URLs with hreflang
├── robots.txt
├── .nojekyll
└── googleb5a10d9504de3274.html  # KEEP — GSC verification
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `scripts/download.js`
- Create: `scripts/ui.js`
- Test: Verify all files exist and load without errors

- [ ] **Step 1: Create `scripts/download.js`**

```javascript
// @ts-check
(function () {
  'use strict';

  const REPO = 'quangtruong2003/SmoothScroll';

  /** @returns {'win'|'mac'|'other'} */
  function detectOS() {
    const ua = navigator.userAgent;
    if (/Mac|iPhone|iPad/.test(ua)) return 'mac';
    if (/Windows/.test(ua)) return 'win';
    return 'other';
  }

  /** @param {string} url */
  async function fetchAssetSize(url) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      return parseInt(/** @type {string} */ (r.headers.get('content-length') || '0'), 10);
    } catch {
      return 0;
    }
  }

  /** @param {number} bytes */
  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  /** @param {string} filename */
  function guessSizeFromName(filename) {
    // Fallback heuristic: extract MB from filename like "SmoothScroll-0.1.13_x64-setup.exe"
    const m = filename.match(/(\d+\.\d+\.\d+)/);
    return m ? 'v' + m[1] : '';
  }

  /**
   * @typedef {Object} ReleaseAsset
   * @property {string} name
   * @property {string} browser_download_url
   * @property {number} [size]
   */

  /** @type {ReleaseAsset[]} */
  const FALLBACK_ASSETS = [
    { name: 'SmoothScroll-0.1.13_x64-setup.exe', browser_download_url: `https://github.com/${REPO}/releases/download/v0.1.13/SmoothScroll-0.1.13_x64-setup.exe` },
    { name: 'SmoothScroll-0.1.13_x64.msi', browser_download_url: `https://github.com/${REPO}/releases/download/v0.1.13/SmoothScroll-0.1.13_x64.msi` },
    { name: 'SmoothScroll-0.1.13_aarch64.dmg', browser_download_url: `https://github.com/${REPO}/releases/download/v0.1.13/SmoothScroll-0.1.13_aarch64.dmg` },
    { name: 'SmoothScroll-0.1.13_x64.dmg', browser_download_url: `https://github.com/${REPO}/releases/download/v0.1.13/SmoothScroll-0.1.13_x64.dmg` },
  ];

  /** @type {string} */
  let latestVersion = '0.1.13';

  /** @param {string} v */
  function updateVersion(v) { latestVersion = v; }

  /** @param {string} trustElId */
  function updateTrustLine(trustElId) {
    const el = document.getElementById(trustElId);
    if (el) el.textContent = `v${latestVersion}  ·  free  ·  no signup`;
  }

  /** @param {string} ctaId */
  /** @param {string} fallbackUrl */
  function wirePrimaryCTA(ctaId, fallbackUrl) {
    const cta = document.getElementById(ctaId);
    if (!cta) return;
    const os = detectOS();
    const asset = FALLBACK_ASSETS.find(a => {
      if (os === 'win' && a.name.endsWith('_x64-setup.exe')) return true;
      if (os === 'mac' && a.name.endsWith('_aarch64.dmg')) return true;
      return false;
    });
    if (asset) cta.href = asset.browser_download_url;
    else cta.href = fallbackUrl;
  }

  /** @param {string} containerId */
  function wireOtherDownloads(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    FALLBACK_ASSETS.forEach(asset => {
      const a = document.createElement('a');
      a.href = asset.browser_download_url;
      a.className = 'download-link';
      a.textContent = asset.name;
      container.appendChild(a);
    });
  }

  async function init() {
    const os = detectOS();

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      latestVersion = data.tag_name.replace(/^v/, '');

      /** @type {ReleaseAsset[]} */
      const assets = (data.assets || []).map(/** @param {any} a */(a) => ({
        name: a.name,
        browser_download_url: a.browser_download_url,
        size: a.size,
      }));

      // Primary CTA
      const primaryCTA = document.getElementById('cta-primary');
      if (primaryCTA) {
        const match = os === 'mac'
          ? assets.find(a => a.name.endsWith('_aarch64.dmg'))
          : assets.find(a => a.name.endsWith('_x64-setup.exe'));
        if (match) primaryCTA.href = match.browser_download_url;
      }

      // Trust line
      const trustLine = document.getElementById('trust-line');
      if (trustLine) {
        const primaryAsset = os === 'mac'
          ? assets.find(a => a.name.endsWith('_aarch64.dmg'))
          : assets.find(a => a.name.endsWith('_x64-setup.exe'));
        const size = primaryAsset && primaryAsset.size ? formatSize(primaryAsset.size) : '4.2 MB';
        trustLine.textContent = `v${latestVersion}  ·  free  ·  ${size}  ·  no signup`;
      }

      // Version in floating bar
      const fbVer = document.getElementById('floating-version');
      if (fbVer) fbVer.textContent = `v${latestVersion}`;

      // Other downloads
      const others = document.getElementById('other-downloads');
      if (others) {
        assets.forEach(a => {
          const p = document.createElement('p');
          const link = document.createElement('a');
          link.href = a.browser_download_url;
          link.className = 'download-link';
          link.textContent = `${a.name} (${a.size ? formatSize(a.size) : '—'})`;
          p.appendChild(link);
          others.appendChild(p);
        });
      }
    } catch (err) {
      // Graceful degradation: use fallback links and hardcoded version
      console.warn('[SmoothScroll] Could not fetch GitHub release:', err);
      const primaryCTA = document.getElementById('cta-primary');
      if (primaryCTA) {
        primaryCTA.href = `https://github.com/${REPO}/releases/latest`;
      }
    }
  }

  // Expose for manual platform switching
  window._ssc = { detectOS, updateVersion, updateTrustLine, wirePrimaryCTA, wireOtherDownloads, init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Run test to verify syntax**

Run: Open `scripts/download.js` in browser devtools console, verify no syntax errors.
Expected: No errors

- [ ] **Step 3: Create `scripts/ui.js`**

```javascript
// @ts-check
(function () {
  'use strict';

  // ── Scroll spy for header nav ────────────────────────────────────────
  function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    if (!sections.length) return;
    const navLinks = document.querySelectorAll('.header-nav a[href^="#"]');

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            navLinks.forEach(a => {
              a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
            });
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sections.forEach(s => obs.observe(s));
  }

  // ── Header shrink on scroll ──────────────────────────────────────────
  function initHeaderShrink() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('shrunken', window.scrollY > 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Smooth scroll for anchor links ───────────────────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(/** @type {string} */ (a.getAttribute('href')));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // ── Install tabs ────────────────────────────────────────────────────
  function initInstallTabs() {
    const tabs = document.querySelectorAll('.install-tab');
    const panels = document.querySelectorAll('.install-panel');
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const platform = /** @type {string} */ (tab.dataset.platform);
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        panels.forEach(p => p.classList.toggle('active', p.id === `panel-${platform}`));
      });
    });

    // Auto-detect from URL param or UA
    const params = new URLSearchParams(location.search);
    const paramPlatform = params.get('platform');
    if (paramPlatform) {
      const match = document.querySelector(`.install-tab[data-platform="${paramPlatform}"]`);
      if (match) match.click();
    } else {
      const ua = navigator.userAgent;
      const isMac = /Mac|iPhone|iPad/.test(ua);
      const defaultTab = document.querySelector(`.install-tab[data-platform="${isMac ? 'mac' : 'win'}"]`);
      if (defaultTab) defaultTab.click();
    }
  }

  // ── Before/After animation ───────────────────────────────────────────
  function initBeforeAfter() {
    const section = document.querySelector('.before-after');
    if (!section) return;

    const beforeTexts = section.querySelectorAll('.ba-before .scroll-text');
    const afterTexts = section.querySelectorAll('.ba-after .scroll-text');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) return; // Fall back to static labels already in HTML

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          beforeTexts.forEach(el => el.style.animationPlayState = 'running');
          afterTexts.forEach(el => el.style.animationPlayState = 'running');
        }
      });
    }, { threshold: 0.3 });

    obs.observe(section);
  }

  // ── Screenshot lightbox ──────────────────────────────────────────────
  function initLightbox() {
    document.querySelectorAll('[data-lightbox]').forEach(img => {
      img.addEventListener('click', () => {
        const src = /** @type {string} */ (img.getAttribute('data-lightbox') || img.getAttribute('src'));
        const alt = /** @type {string} */ (img.getAttribute('alt') || '');
        const dialog = document.getElementById('lightbox-dialog');
        if (!dialog) return;
        const imgEl = dialog.querySelector('img');
        if (imgEl) { imgEl.src = src; imgEl.alt = alt; }
        dialog.showModal();
      });
    });

    const dialog = document.getElementById('lightbox-dialog');
    if (dialog) {
      dialog.addEventListener('click', e => {
        if (e.target === dialog) dialog.close();
      });
    }
  }

  // ── Floating download bar ────────────────────────────────────────────
  function initFloatingBar() {
    const bar = document.querySelector('.floating-bar');
    const hero = document.querySelector('.hero');
    if (!bar || !hero) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // Hide when hero is visible, show when scrolled past
        bar.classList.toggle('visible', !entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });

    obs.observe(hero);
  }

  // ── Copy buttons in install code blocks ────────────────────────────
  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pre = btn.closest('.code-block')?.querySelector('pre');
        if (!pre) return;
        try {
          await navigator.clipboard.writeText(pre.textContent || '');
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        } catch {
          // Clipboard not available
        }
      });
    });
  }

  // ── Language switcher ───────────────────────────────────────────────
  function initLangSwitcher() {
    const dropdown = document.getElementById('lang-dropdown');
    if (!dropdown) return;
    dropdown.addEventListener('change', () => {
      const lang = /** @type {string} */ (dropdown.value);
      localStorage.setItem('ssc-lang', lang);
      const base = 'https://smoothscroll.top/';
      location.replace(`${base}${lang}/`);
    });
  }

  // ── Init all ────────────────────────────────────────────────────────
  function init() {
    initScrollSpy();
    initHeaderShrink();
    initSmoothScroll();
    initInstallTabs();
    initBeforeAfter();
    initLightbox();
    initFloatingBar();
    initCopyButtons();
    initLangSwitcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 4: Run test to verify syntax**

Run: Open `scripts/ui.js` in browser devtools, verify no syntax errors.
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add scripts/download.js scripts/ui.js
git commit -m "feat(landing): scaffold download.js and ui.js"
```

---

## Task 2: Shared CSS — `styles.css`

**Files:**
- Create: `styles.css`
- Test: Load any language page, verify light/dark mode both work

- [ ] **Step 1: Write the CSS**

```css
/* ============================================================
   SmoothScroll Landing v2 — styles.css
   ============================================================ */

/* ── Reset ─────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
img, svg { display: block; max-width: 100%; }
button { cursor: pointer; font: inherit; }
a { color: inherit; }

/* ── Design tokens (light) ─────────────────────────────────── */
:root {
  --bg: #ffffff;
  --surface: #fafafa;
  --fg: #0a0a0a;
  --muted: #5b6273;
  --border: #e6e8ee;
  --accent: #6366f1;
  --accent-2: #8b5cf6;
  --accent-fg: #ffffff;
  --gradient: linear-gradient(135deg, #6366f1, #8b5cf6);
  --gradient-text: linear-gradient(135deg, #6366f1, #8b5cf6);

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 999px;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.10);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --transition: 200ms var(--ease-out);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0b10;
    --surface: #14151c;
    --fg: #f5f6fa;
    --muted: #9aa0b3;
    --border: #232531;
    --accent: #818cf8;
    --accent-2: #a78bfa;
    --accent-fg: #0a0b10;
    --gradient: linear-gradient(135deg, #818cf8, #a78bfa);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.30);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.40);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.50);
  }
}

/* ── Base ───────────────────────────────────────────────────── */
html {
  scroll-behavior: smooth;
  font-size: 16px;
}
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
::selection { background: var(--accent); color: var(--accent-fg); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

/* ── Skip link ──────────────────────────────────────────────── */
.skip-link {
  position: absolute;
  top: -999px;
  left: 16px;
  background: var(--accent);
  color: var(--accent-fg);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-weight: 600;
  z-index: 9999;
}
.skip-link:focus { top: 16px; }

/* ── Container ──────────────────────────────────────────────── */
.container {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ── Typography ─────────────────────────────────────────────── */
h1 {
  font-size: clamp(2.5rem, 1rem + 5vw, 4.5rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
h2 {
  font-size: clamp(1.875rem, 1rem + 2vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  text-align: center;
  margin-bottom: 48px;
}
h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
}
p { max-width: 65ch; }
.muted { color: var(--muted); }
.micro { font-size: 0.875rem; color: var(--muted); }
.gradient-text {
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Header ─────────────────────────────────────────────────── */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 16px 0;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid transparent;
  transition: padding var(--transition), border-color var(--transition);
}
.site-header.shrunken { padding: 10px 0; border-bottom-color: var(--border); }
.header-inner {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 1.125rem;
  text-decoration: none;
  color: var(--fg);
}
.header-logo img { width: 32px; height: 32px; }
.header-nav {
  display: flex;
  gap: 24px;
  list-style: none;
  margin-left: auto;
}
.header-nav a {
  text-decoration: none;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 500;
  transition: color var(--transition);
}
.header-nav a:hover, .header-nav a.active { color: var(--fg); }
.header-actions { display: flex; align-items: center; gap: 12px; }
.lang-select {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  padding: 4px 8px;
  font-size: 0.875rem;
  cursor: pointer;
}
.github-btn iframe { display: block; border: none; }

/* ── Buttons ─────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  border: none;
  transition: transform var(--transition), box-shadow var(--transition);
  cursor: pointer;
}
.btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.btn:active { transform: translateY(0); }
.btn-primary {
  background: var(--gradient);
  color: var(--accent-fg);
}
.btn-outline {
  background: transparent;
  color: var(--fg);
  border: 1.5px solid var(--border);
}
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }
.btn-sm { padding: 8px 16px; font-size: 0.875rem; }

/* ── Hero ───────────────────────────────────────────────────── */
.hero {
  padding: 96px 0 80px;
  text-align: center;
}
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 24px;
}
.hero h1 { margin-bottom: 24px; }
.hero-subhead {
  font-size: clamp(1.125rem, 1rem + 1vw, 1.375rem);
  color: var(--muted);
  max-width: 55ch;
  margin: 0 auto 40px;
}
.hero-cta { margin-bottom: 12px; }
#trust-line { display: block; margin-top: 12px; }
.hero-other-dl { margin-top: 16px; }
.hero-other-dl > button {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.875rem;
  text-decoration: underline;
  cursor: pointer;
}
#other-downloads { display: none; margin-top: 12px; }
#other-downloads.open { display: block; }
#other-downloads p { margin-bottom: 6px; }
.download-link { color: var(--accent); text-decoration: none; font-size: 0.875rem; }
.download-link:hover { text-decoration: underline; }

/* Hero visual composite */
.hero-visual {
  position: relative;
  width: 100%;
  max-width: 800px;
  height: 480px;
  margin: 56px auto 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}
.hero-visual .screenshot-settings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-visual .screenshot-tray {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 280px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  background: var(--surface);
}

/* ── Before/After ─────────────────────────────────────────────── */
.before-after {
  padding: 80px 0;
  background: var(--surface);
}
.before-after .grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  max-width: 800px;
  margin: 0 auto;
}
@media (max-width: 640px) {
  .before-after .grid { grid-template-columns: 1fr; }
}
.ba-col {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  text-align: center;
}
.ba-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 24px;
}
.ba-before .ba-label { color: #ef4444; }
.ba-after .ba-label { color: #22c55e; }
.ba-scroller {
  height: 120px;
  overflow: hidden;
  position: relative;
}
.scroll-text {
  font-size: 0.875rem;
  line-height: 2;
  color: var(--muted);
}
.ba-before .scroll-text {
  animation: scroll-choppy 2s steps(8, end) infinite;
}
.ba-after .scroll-text {
  animation: scroll-smooth 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes scroll-choppy {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
@keyframes scroll-smooth {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-text { animation: none; }
}
.before-after .caption {
  margin-top: 24px;
  font-size: 1.125rem;
  font-weight: 500;
  text-align: center;
  color: var(--muted);
}

/* ── Features ────────────────────────────────────────────────── */
.features {
  padding: 80px 0;
}
.features .grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 768px) {
  .features .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .features .grid { grid-template-columns: 1fr; }
}
.feature-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}
.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--accent);
}
.feature-icon {
  font-size: 2rem;
  margin-bottom: 16px;
  display: block;
}
.feature-card h3 { font-size: 1.125rem; margin-bottom: 8px; }
.feature-card p { font-size: 0.9rem; color: var(--muted); }

/* ── Screenshots bento ───────────────────────────────────────── */
.screenshots {
  padding: 80px 0;
  background: var(--surface);
}
.bento-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: auto auto;
  gap: 16px;
}
@media (max-width: 640px) {
  .bento-grid { grid-template-columns: 1fr; }
}
.bento-item {
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  cursor: zoom-in;
}
.bento-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--transition);
}
.bento-item:hover img { transform: scale(1.02); }
.bento-item--tall { grid-row: span 2; }

/* Lightbox */
dialog#lightbox-dialog {
  border: none;
  background: transparent;
  padding: 0;
  max-width: 90vw;
  max-height: 90vh;
}
dialog#lightbox-dialog::backdrop {
  background: rgba(0,0,0,0.85);
}
dialog#lightbox-dialog img {
  max-width: 100%;
  max-height: 90vh;
  border-radius: var(--radius-md);
}

/* ── How it works ────────────────────────────────────────────── */
.how-it-works {
  padding: 80px 0;
}
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 48px;
}
@media (max-width: 640px) {
  .steps-grid { grid-template-columns: 1fr; }
}
.step {
  text-align: center;
  padding: 32px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.step-num {
  font-size: clamp(4rem, 8vw, 6rem);
  font-weight: 700;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 16px;
}
.step h3 { font-size: 1.125rem; margin-bottom: 8px; }
.step p { color: var(--muted); font-size: 0.9rem; max-width: none; margin: 0 auto; }
.how-it-works .cta-row { text-align: center; }

/* ── Install ─────────────────────────────────────────────────── */
.install {
  padding: 80px 0;
  background: var(--surface);
}
.install-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 4px;
  width: fit-content;
  margin: 0 auto 32px;
}
.install-tab {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--muted);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
}
.install-tab.active {
  background: var(--accent);
  color: var(--accent-fg);
}
.install-panel { display: none; max-width: 600px; margin: 0 auto; }
.install-panel.active { display: block; }
.code-block {
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 24px;
  position: relative;
}
.code-block pre {
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--fg);
  white-space: pre-wrap;
  word-break: break-all;
}
.code-block .copy-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  font-size: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}
.install-note {
  margin-top: 16px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  color: var(--muted);
}

/* ── FAQ ─────────────────────────────────────────────────────── */
.faq {
  padding: 80px 0;
}
.faq-list { max-width: 720px; margin: 0 auto; }
.faq-item {
  border-bottom: 1px solid var(--border);
}
.faq-item:first-child { border-top: 1px solid var(--border); }
.faq-item details { padding: 0; }
.faq-item summary {
  padding: 20px 0;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--fg);
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item summary::after {
  content: '+';
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--muted);
  transition: transform var(--transition);
}
.faq-item details[open] summary::after { transform: rotate(45deg); }
.faq-item .answer {
  padding: 0 0 20px;
  color: var(--muted);
  font-size: 0.9375rem;
  line-height: 1.7;
}
.faq-item .answer p { margin-bottom: 12px; }
.faq-item .answer p:last-child { margin-bottom: 0; }

/* ── Footer ─────────────────────────────────────────────────── */
.site-footer {
  padding: 48px 0;
  border-top: 1px solid var(--border);
}
.footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
.footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.footer-links {
  display: flex;
  gap: 24px;
  list-style: none;
}
.footer-links a {
  color: var(--muted);
  font-size: 0.875rem;
  text-decoration: none;
  transition: color var(--transition);
}
.footer-links a:hover { color: var(--fg); }
.footer-copy {
  width: 100%;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--muted);
  margin-top: 24px;
}

/* ── Floating bar ────────────────────────────────────────────── */
.floating-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 90;
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  transform: translateY(100%);
  opacity: 0;
  transition: transform var(--transition), opacity var(--transition);
}
.floating-bar.visible {
  transform: translateY(0);
  opacity: 1;
}
@media (max-width: 600px) {
  .floating-bar { display: none; }
}
.floating-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}
.floating-brand img { width: 24px; height: 24px; }
#floating-version { color: var(--muted); font-weight: 400; }

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 768px) {
  .header-nav { display: none; }
  .hero { padding: 64px 0 48px; }
  .hero-visual { height: 300px; margin-top: 40px; }
  .hero-visual .screenshot-tray { width: 180px; }
}

/* ── Reduced motion ──────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  html { scroll-behavior: auto; }
}
```

- [ ] **Step 2: Run test to verify styles**

Run: Open page in browser, toggle DevTools device toolbar, verify responsive at 375px, 768px, 1440px.
Expected: No overflow, no broken layout at any viewport

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat(landing): add shared styles.css with light/dark tokens and all sections"
```

---

## Task 3: Root language redirector — `index.html`

**Files:**
- Create: `index.html` (root)
- Test: Open root URL, verify redirects to correct language

- [ ] **Step 1: Write the root redirector**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=https://smoothscroll.top/en/">
  <title>Redirecting...</title>
  <script>
    (function () {
      var lang = (navigator.language || '').toLowerCase();
      var stored = localStorage.getItem('ssc-lang');
      var target;
      if (stored) {
        target = stored;
      } else if (lang.startsWith('vi')) {
        target = 'vi';
      } else if (lang.startsWith('zh')) {
        target = 'zh';
      } else {
        target = 'en';
      }
      var base = 'https://smoothscroll.top/';
      location.replace(base + target + '/');
    })();
  </script>
</head>
<body>
  <p>Redirecting to your language version…</p>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(landing): add root language redirector"
```

---

## Task 4: English landing — `en/index.html`

**Files:**
- Create: `en/index.html`
- Test: All CTAs wire up, all sections render, JSON-LD valid

- [ ] **Step 1: Write the English HTML**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmoothScroll — Smooth Mouse Wheel Scrolling for Windows and macOS</title>
  <meta name="description" content="Buttery-smooth mouse-wheel scrolling for Windows and macOS. Free. No setup. Just install.">
  <meta name="keywords" content="smooth scroll, mouse wheel, windows, macos, scroll smoother">
  <link rel="canonical" href="https://smoothscroll.top/en/">
  <link rel="alternate" hreflang="en" href="https://smoothscroll.top/en/">
  <link rel="alternate" hreflang="vi" href="https://smoothscroll.top/vi/">
  <link rel="alternate" hreflang="zh-Hans" href="https://smoothscroll.top/zh/">
  <link rel="alternate" hreflang="x-default" href="https://smoothscroll.top/en/">

  <meta property="og:type" content="website">
  <meta property="og:title" content="SmoothScroll — Smooth Mouse Wheel Scrolling">
  <meta property="og:description" content="Buttery-smooth mouse-wheel scrolling for Windows and macOS. Free. No setup. Just install.">
  <meta property="og:url" content="https://smoothscroll.top/en/">
  <meta property="og:image" content="https://smoothscroll.top/assets/og-image.png">
  <meta name="twitter:card" content="summary_large_image">

  <link rel="stylesheet" href="/SmoothScroll/styles.css">
  <link rel="icon" type="image/png" href="/SmoothScroll/assets/icon-128.png">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SmoothScroll",
    "operatingSystem": ["Windows", "macOS"],
    "applicationCategory": "UtilityApplication",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "description": "Buttery-smooth mouse-wheel scrolling for Windows and macOS.",
    "url": "https://smoothscroll.top/en/",
    "softwareVersion": "0.1.13",
    "author": { "@type": "Person", "name": "quangtruong2003" }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "How do I enable smooth scrolling on Windows 11?", "acceptedAnswer": { "@type": "Answer", "text": "Download SmoothScroll, install it, and smooth scrolling is automatically enabled system-wide. No configuration required." }},
      { "@type": "Question", "name": "How do I get Mac-style inertia scrolling on Windows?", "acceptedAnswer": { "@type": "Answer", "text": "SmoothScroll intercepts your mouse wheel input and applies a smooth easing curve, giving you the same momentum-based scrolling feel as macOS." }},
      { "@type": "Question", "name": "Is SmoothScroll free?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. SmoothScroll is completely free and open source under the MIT license. No tiers, no ads, no nagging." }},
      { "@type": "Question", "name": "Does SmoothScroll work with gaming mice (Logitech, Razer, MX Master)?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. SmoothScroll works with any mouse that sends standard scroll wheel input, including Logitech G-series, Razer DeathAdder, MX Master 2S/3, and most other mice." }},
      { "@type": "Question", "name": "How is SmoothScroll different from WizMouse, Logitech SetPoint, or built-in OS smooth scrolling?", "acceptedAnswer": { "@type": "Answer", "text": "SmoothScroll works at the input driver level for the smoothest possible result, with per-app exclusion, 120 Hz support, and a lightweight 4 MB binary with no bloat." }},
      { "@type": "Question", "name": "Is it safe? What about anti-cheat / EAC / BattlEye?", "acceptedAnswer": { "@type": "Answer", "text": "SmoothScroll is safe to use. It does not inject into games or modify game memory, so it is compatible with anti-cheat systems like EAC and BattlEye." }},
      { "@type": "Question", "name": "Where are settings and logs stored?", "acceptedAnswer": { "@type": "Answer", "text": "Settings are stored in your user profile folder. No data is sent anywhere — there is no telemetry." }},
      { "@type": "Question", "name": "Does SmoothScroll work on Linux?", "acceptedAnswer": { "@type": "Answer", "text": "SmoothScroll is currently Windows and macOS only. For Linux, native desktop environments often have built-in smooth scrolling." }}
    ]
  }
  </script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>

  <!-- Header -->
  <header class="site-header">
    <div class="container header-inner">
      <a href="/SmoothScroll/en/" class="header-logo">
        <img src="/SmoothScroll/assets/icon-128.png" alt="SmoothScroll icon" width="32" height="32">
        SmoothScroll
      </a>
      <nav aria-label="Main navigation">
        <ul class="header-nav">
          <li><a href="#features">Features</a></li>
          <li><a href="#install">Install</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
      </nav>
      <div class="header-actions">
        <select id="lang-dropdown" class="lang-select" aria-label="Select language">
          <option value="en" selected>English</option>
          <option value="vi">Tiếng Việt</option>
          <option value="zh">简体中文</option>
        </select>
        <div class="github-btn">
          <iframe src="https://ghbtns.com/github-btn.html?user=quangtruong2003&repo=SmoothScroll&type=star&count=true" width="100" height="20" title="GitHub Stars"></iframe>
        </div>
      </div>
    </div>
  </header>

  <main id="main">
    <!-- Hero -->
    <section class="hero">
      <div class="container">
        <div class="hero-eyebrow">
          <span>&#11088;</span> Trusted by power users on Windows and Mac
        </div>
        <h1>Scroll like you've always wanted.</h1>
        <p class="hero-subhead">Buttery-smooth mouse-wheel scrolling for Windows and Mac. Free. No setup. Just install.</p>
        <div class="hero-cta">
          <a id="cta-primary" href="#" class="btn btn-primary">&#11015; Download for Windows</a>
        </div>
        <span id="trust-line" class="micro">v0.1.13  &middot;  free  &middot;  4.2 MB  &middot;  no signup</span>
        <div class="hero-other-dl">
          <button id="toggle-other" aria-expanded="false">Other downloads &#8595;</button>
          <div id="other-downloads" aria-live="polite"></div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <img class="screenshot-settings"
               src="/SmoothScroll/assets/screenshot-settings.webp"
               alt="SmoothScroll settings panel"
               width="800" height="480"
               loading="eager">
          <img class="screenshot-tray"
               src="/SmoothScroll/assets/screenshot-tray.webp"
               alt="SmoothScroll tray menu"
               width="280" height="200"
               loading="eager">
        </div>
      </div>
    </section>

    <!-- Before/After -->
    <section class="before-after" id="compare" aria-labelledby="compare-heading">
      <div class="container">
        <h2 id="compare-heading">See the difference.</h2>
        <div class="grid">
          <div class="ba-col ba-before">
            <div class="ba-label">Without SmoothScroll</div>
            <div class="ba-scroller" aria-label="Demonstration of choppy scrolling">
              <div class="scroll-text">
                &#9608; choppy<br>&#9608; jumps<br>&#9608; stops abruptly<br>&#9608; choppy<br>&#9608; jumps<br>&#9608; stops abruptly<br>&#9608; choppy<br>&#9608; jumps
              </div>
            </div>
          </div>
          <div class="ba-col ba-after">
            <div class="ba-label">With SmoothScroll</div>
            <div class="ba-scroller" aria-label="Demonstration of smooth scrolling">
              <div class="scroll-text">
                &nbsp;&#9617; buttery<br>&nbsp;&#9617; smooth<br>&nbsp;&#9617; glides<br>&nbsp;&#9617; buttery<br>&nbsp;&#9617; smooth<br>&nbsp;&#9617; glides<br>&nbsp;&#9617; buttery<br>&nbsp;&#9617; smooth
              </div>
            </div>
          </div>
        </div>
        <p class="caption">Your scroll wheel, finally smooth.</p>
      </div>
    </section>

    <!-- Features -->
    <section class="features" id="features" aria-labelledby="features-heading">
      <div class="container">
        <h2 id="features-heading">What you get.</h2>
        <div class="grid">
          <article class="feature-card">
            <span class="feature-icon">&#10022;</span>
            <h3>Works everywhere</h3>
            <p>Browsers, Word, Excel, Photoshop — any app on your PC.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">&#9889;</span>
            <h3>Lightning fast</h3>
            <p>120 Hz pulses, no input lag. 4 MB binary. Runs silently in the background.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">&#127919;</span>
            <h3>Per-app control</h3>
            <p>Disable for games or apps where smooth scroll gets in the way.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">&#128274;</span>
            <h3>Private &amp; open source</h3>
            <p>No telemetry, no ads, no signup. MIT licensed. Read the code yourself.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">&#128992;</span>
            <h3>Free forever</h3>
            <p>MIT-licensed. No tier, no ads, no nagging. One install, yours forever.</p>
          </article>
          <article class="feature-card">
            <span class="feature-icon">&#9000;</span>
            <h3>Hotkey toggle</h3>
            <p>Press Ctrl+Alt+S to toggle smoothing on or off instantly.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Screenshots bento -->
    <section class="screenshots" id="screenshots" aria-labelledby="screenshots-heading">
      <div class="container">
        <h2 id="screenshots-heading">See it in action.</h2>
        <div class="bento-grid">
          <div class="bento-item bento-item--tall">
            <img src="/SmoothScroll/assets/screenshot-settings.webp"
                 alt="SmoothScroll settings panel"
                 width="800" height="600"
                 loading="lazy"
                 data-lightbox="/SmoothScroll/assets/screenshot-settings.webp">
          </div>
          <div>
            <div class="bento-item" style="margin-bottom:16px">
              <img src="/SmoothScroll/assets/screenshot-theme.webp"
                   alt="SmoothScroll theme switcher"
                   width="400" height="240"
                   loading="lazy"
                   data-lightbox="/SmoothScroll/assets/screenshot-theme.webp">
            </div>
            <div class="bento-item">
              <img src="/SmoothScroll/assets/screenshot-exclusion.webp"
                   alt="SmoothScroll per-app exclusion list"
                   width="400" height="240"
                   loading="lazy"
                   data-lightbox="/SmoothScroll/assets/screenshot-exclusion.webp">
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Lightbox dialog -->
    <dialog id="lightbox-dialog" aria-label="Screenshot lightbox">
      <img src="" alt="">
    </dialog>

    <!-- How it works -->
    <section class="how-it-works" id="how" aria-labelledby="how-heading">
      <div class="container">
        <h2 id="how-heading">Three steps. Done.</h2>
        <div class="steps-grid">
          <div class="step">
            <div class="step-num">1</div>
            <h3>Download</h3>
            <p>4 MB, free, no signup required. Pick Windows or Mac.</p>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <h3>Install</h3>
            <p>Per-user install, no admin needed, no reboot required.</p>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <h3>Done.</h3>
            <p>SmoothScroll launches automatically. Scroll any app, anywhere.</p>
          </div>
        </div>
        <div class="cta-row">
          <a id="cta-how" href="#" class="btn btn-primary">&#11015; Download for Windows</a>
        </div>
      </div>
    </section>

    <!-- Install -->
    <section class="install" id="install" aria-labelledby="install-heading">
      <div class="container">
        <h2 id="install-heading">Install in under a minute.</h2>
        <div class="install-tabs" role="tablist" aria-label="Platform">
          <button class="install-tab active" data-platform="win" role="tab" aria-selected="true">Windows</button>
          <button class="install-tab" data-platform="mac" role="tab" aria-selected="false">macOS</button>
        </div>

        <div id="panel-win" class="install-panel active" role="tabpanel">
          <div class="code-block">
            <button class="copy-btn" type="button" aria-label="Copy download link">Copy</button>
            <pre>1. Download SmoothScroll-0.1.13_x64-setup.exe
   <a href="#" class="btn btn-primary btn-sm" style="margin-top:8px">&#11015; Download (.exe, 4.2 MB)</a>

2. Double-click to install. No admin password needed.

3. SmoothScroll starts automatically.
   Look for the icon (&#9688;) near your system clock.

Right-click the tray icon for settings,
or press Ctrl+Alt+S to toggle smoothing on/off.</pre>
          </div>
          <p class="install-note">No admin rights needed. Installs per-user to <code>%LOCALAPPDATA%</code>.</p>
        </div>

        <div id="panel-mac" class="install-panel" role="tabpanel">
          <div class="code-block">
            <button class="copy-btn" type="button" aria-label="Copy download link">Copy</button>
            <pre>1. Download SmoothScroll-0.1.13_aarch64.dmg (Apple Silicon)
   <a href="#" class="btn btn-primary btn-sm" style="margin-top:8px">&#11015; Download (.dmg, ~4 MB)</a>

2. Open the .dmg, drag SmoothScroll to Applications.

3. Open SmoothScroll from Applications.
   Grant Accessibility permission when prompted.</pre>
          </div>
          <p class="install-note">macOS requires Accessibility permission to intercept scroll events.</p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="faq" id="faq" aria-labelledby="faq-heading">
      <div class="container">
        <h2 id="faq-heading">Questions? Answers.</h2>
        <div class="faq-list">
          <div class="faq-item">
            <details>
              <summary>How do I enable smooth scrolling on Windows 11?</summary>
              <div class="answer"><p>Download SmoothScroll, install it, and smooth scrolling is automatically enabled system-wide. No configuration required.</p></div>
            </details>
          </div>
          <div class="faq-item">
            <details>
              <summary>How do I get Mac-style inertia scrolling on Windows?</summary>
              <div class="answer"><p>SmoothScroll intercepts your mouse wheel input and applies a smooth easing curve, giving you the same momentum-based scrolling feel as macOS.</p></div>
            </details>
          </div>
          <div class="faq-item">
            <details>
              <summary>Is SmoothScroll free?</summary>
              <div class="answer"><p>Yes. SmoothScroll is completely free and open source under the MIT license. No tiers, no ads, no nagging.</p></div>
            </details>
          </div>
          <div class="faq-item">
            <details>
              <summary>Does SmoothScroll work with gaming mice (Logitech, Razer, MX Master)?</summary>
              <div class="answer"><p>Yes. SmoothScroll works with any mouse that sends standard scroll wheel input, including Logitech G-series, Razer DeathAdder, MX Master 2S/3, and most other mice.</p></div>
            </details>
          </div>
          <div class="faq-item">
            <details>
              <summary>How is SmoothScroll different from WizMouse, Logitech SetPoint, or built-in OS smooth scrolling?</summary>
              <div class="answer"><p>SmoothScroll works at the input driver level for the smoothest possible result, with per-app exclusion, 120 Hz support, and a lightweight 4 MB binary with no bloat.</p></div>
            </details>
          </div>
          <div class="faq-item">
            <details>
              <summary>Is it safe? What about anti-cheat / EAC / BattlEye?</summary>
              <div class="answer"><p>SmoothScroll is safe to use. It does not inject into games or modify game memory, so it is compatible with anti-cheat systems like EAC and BattlEye.</p></div>
            </details>
          </div>
          <div class="faq-item">
            <details>
              <summary>Where are settings and logs stored?</summary>
              <div class="answer"><p>Settings are stored in your user profile folder. No data is sent anywhere — there is no telemetry.</p></div>
            </details>
          </div>
          <div class="faq-item">
            <details>
              <summary>Does SmoothScroll work on Linux?</summary>
              <div class="answer"><p>SmoothScroll is currently Windows and macOS only. For Linux, native desktop environments often have built-in smooth scrolling.</p></div>
            </details>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-brand">
          <img src="/SmoothScroll/assets/icon-128.png" alt="" width="24" height="24">
          SmoothScroll
        </div>
        <ul class="footer-links">
          <li><a href="https://github.com/quangtruong2003/SmoothScroll" target="_blank" rel="noopener">GitHub</a></li>
          <li><a href="https://github.com/quangtruong2003/SmoothScroll/blob/main/LICENSE" target="_blank" rel="noopener">License</a></li>
          <li><a href="https://github.com/quangtruong2003/SmoothScroll/releases" target="_blank" rel="noopener">Releases</a></li>
          <li><a href="https://github.com/quangtruong2003/SmoothScroll/issues" target="_blank" rel="noopener">Issues</a></li>
        </ul>
      </div>
      <p class="footer-copy">Made with &#9829; by quangtruong2003 &middot; &copy; 2026 &middot; MIT licensed</p>
    </div>
  </footer>

  <!-- Floating bar -->
  <div class="floating-bar" aria-label="Download">
    <div class="floating-brand">
      <img src="/SmoothScroll/assets/icon-128.png" alt="" width="24" height="24">
      SmoothScroll <span id="floating-version">v0.1.13</span>
    </div>
    <a id="cta-floating" href="#" class="btn btn-primary btn-sm">&#11015; Download for Windows</a>
  </div>

  <script src="/SmoothScroll/scripts/download.js"></script>
  <script src="/SmoothScroll/scripts/ui.js"></script>
  <script>
    // Wire "Other downloads" toggle
    document.getElementById('toggle-other').addEventListener('click', function () {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      document.getElementById('other-downloads').classList.toggle('open');
    });
    // Wire #cta-how and #cta-floating to the same href as #cta-primary
    var primaryHref = document.getElementById('cta-primary').href;
    document.getElementById('cta-how').href = primaryHref;
    document.getElementById('cta-floating').href = primaryHref;
    // Override after download.js populates href
    window.addEventListener('load', function () {
      setTimeout(function () {
        var href = document.getElementById('cta-primary').href;
        document.getElementById('cta-how').href = href;
        document.getElementById('cta-floating').href = href;
      }, 2000); // wait for GitHub API response
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Run test**

Run: `python -m http.server 8080` in the `gh-pages` directory, visit `http://localhost:8080/en/`
Expected: Page loads, all sections visible, CTA buttons present, FAQ accordion works

- [ ] **Step 3: Commit**

```bash
git add en/index.html
git commit -m "feat(landing): add English landing page (en/index.html)"
```

---

## Task 5: Vietnamese landing — `vi/index.html`

**Files:**
- Create: `vi/index.html`
- Test: All Vietnamese copy renders correctly, CTA wires up

- [ ] **Step 1: Write the Vietnamese HTML**

Copy `en/index.html` as the base, then change:

1. `<html lang="vi">`
2. `<title>` → `SmoothScroll — Cuộn chuột mượt cho Windows và macOS`
3. `<meta name="description">` → `Cuộn chuột mượt mà cho Windows và Mac. Miễn phí. Không cài đặt phức tạp. Chỉ cần install.`
4. `<link rel="canonical">` → `/SmoothScroll/vi/`
5. `hreflang` links adjusted accordingly
6. All visible copy per the Vietnamese copy reference table (§ 13.2 of spec):
   - H1: `Cuộn chuột mượt như bạn vẫn mong.`
   - Subhead: `Cuộn chuột mượt mà cho Windows và Mac. Miễn phí. Không cài đặt phức tạp. Chỉ cần install.`
   - CTA: `&#11015; Tải cho Windows` / `&#11015; Tải cho Mac`
   - Trust: Vietnamese copy
   - All section headings in Vietnamese
   - Footer Vietnamese
7. FAQ answers in Vietnamese
8. JSON-LD FAQPage `name`/`text` fields in Vietnamese
9. `lang-select` default: `<option value="vi" selected>`
10. OG `og:title` and `og:description` in Vietnamese

- [ ] **Step 2: Run test**

Run: Visit `http://localhost:8080/vi/` — verify all Vietnamese text renders, FAQ accordion works.
Expected: Vietnamese copy, no broken elements

- [ ] **Step 3: Commit**

```bash
git add vi/index.html
git commit -m "feat(landing): add Vietnamese landing page (vi/index.html)"
```

---

## Task 6: Simplified Chinese landing — `zh/index.html`

**Files:**
- Create: `zh/index.html`
- Test: All Chinese copy renders correctly, CTA wires up

- [ ] **Step 1: Write the Chinese HTML**

Copy `en/index.html` as the base, then change:

1. `<html lang="zh-Hans">`
2. `<title>` → `SmoothScroll — 让滚动如丝般顺滑的 Windows 和 macOS 鼠标滚轮`
3. `<meta name="description">` → `适用于 Windows 和 Mac 的顺滑鼠标滚轮滚动。免费,无需设置,安装即用。`
4. `<link rel="canonical">` → `/SmoothScroll/zh/`
5. `hreflang` links adjusted
6. All visible copy per the Chinese copy reference table (§ 13.3 of spec):
   - H1: `让滚动如丝般顺滑。`
   - Subhead: `适用于 Windows 和 Mac 的顺滑鼠标滚轮滚动。免费,无需设置,安装即用。`
   - CTA: `&#11015; 下载 Windows 版` / `&#11015; 下载 Mac 版`
   - Trust: Chinese copy
   - All section headings in Chinese
   - Footer Chinese
7. FAQ answers in Chinese
8. JSON-LD FAQPage `name`/`text` fields in Chinese
9. `lang-select` default: `<option value="zh" selected>`
10. OG `og:title` and `og:description` in Chinese

- [ ] **Step 2: Run test**

Run: Visit `http://localhost:8080/zh/` — verify all Chinese text renders, FAQ accordion works.
Expected: Chinese copy, no broken elements

- [ ] **Step 3: Commit**

```bash
git add zh/index.html
git commit -m "feat(landing): add Simplified Chinese landing page (zh/index.html)"
```

---

## Task 7: SEO — `sitemap.xml`, `robots.txt`, OG image

**Files:**
- Create: `sitemap.xml`
- Modify: `robots.txt` (if needed)
- Create: `assets/og-image.png` (placeholder 1200×630)
- Test: sitemap.xml validates, all 3 language URLs present with hreflang

- [ ] **Step 1: Write `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://smoothscroll.top/en/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://smoothscroll.top/en/"/>
    <xhtml:link rel="alternate" hreflang="vi" href="https://smoothscroll.top/vi/"/>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://smoothscroll.top/zh/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://smoothscroll.top/en/"/>
    <changefreq>monthly</changefreq>
  </url>
  <url>
    <loc>https://smoothscroll.top/vi/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://smoothscroll.top/en/"/>
    <xhtml:link rel="alternate" hreflang="vi" href="https://smoothscroll.top/vi/"/>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://smoothscroll.top/zh/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://smoothscroll.top/en/"/>
    <changefreq>monthly</changefreq>
  </url>
  <url>
    <loc>https://smoothscroll.top/zh/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://smoothscroll.top/en/"/>
    <xhtml:link rel="alternate" hreflang="vi" href="https://smoothscroll.top/vi/"/>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://smoothscroll.top/zh/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://smoothscroll.top/en/"/>
    <changefreq>monthly</changefreq>
  </url>
</urlset>
```

- [ ] **Step 2: Create OG image placeholder**

Create a 1200×630 PNG at `assets/og-image.png`. Can be a simple branded image with the app name and tagline. For production, design with Figma or similar.

- [ ] **Step 3: Run test**

Run: Open `sitemap.xml` in browser — verify all 3 URLs present with hreflang.
Expected: Valid XML, 3 `<url>` entries, each with 4 `xhtml:link` siblings

- [ ] **Step 4: Commit**

```bash
git add sitemap.xml assets/og-image.png
git commit -m "feat(landing): add sitemap.xml with hreflang and OG image"
```

---

## Task 8: Assets — Screenshots

**Files:**
- Create: `assets/screenshot-settings.webp`
- Create: `assets/screenshot-tray.webp`
- Create: `assets/screenshot-exclusion.webp`
- Create: `assets/screenshot-theme.webp`
- Test: All images load with correct dimensions, no broken images

- [ ] **Step 1: Generate or provide screenshots**

For each screenshot, save as WebP format at these dimensions:
| File | Dimensions | Content |
|------|-----------|---------|
| `screenshot-settings.webp` | 800×480 | Main settings panel UI |
| `screenshot-tray.webp` | 280×200 | Tray icon menu open |
| `screenshot-exclusion.webp` | 400×240 | Per-app exclusion list |
| `screenshot-theme.webp` | 400×240 | Theme switcher |

Use the actual SmoothScroll app to capture these, or generate placeholder images that match the described content. Ensure all have explicit `width`/`height` attributes in HTML to prevent CLS.

- [ ] **Step 2: Verify images**

Run: `python -m http.server 8080`, visit `/en/`, open DevTools Network tab.
Expected: All 4 images return 200, no broken image icons

- [ ] **Step 3: Commit**

```bash
git add assets/screenshot-settings.webp assets/screenshot-tray.webp assets/screenshot-exclusion.webp assets/screenshot-theme.webp
git commit -m "feat(landing): add screenshot assets for bento showcase"
```

---

## Task 9: Preserve existing files and final verification

**Files:**
- Verify: `.nojekyll`, `robots.txt`, `googleb5a10d9504de3274.html` still present
- Test: All 3 language pages load, hreflang correct, JSON-LD valid

- [ ] **Step 1: Verify existing files**

```bash
git status
```
Expected: `.nojekyll`, `robots.txt`, `googleb5a10d9504de3274.html` are unchanged.

- [ ] **Step 2: Final local test**

```bash
# From gh-pages worktree
python -m http.server 8080
# Then visit:
# - http://localhost:8080/ → should redirect to /en/
# - http://localhost:8080/en/ → English page
# - http://localhost:8080/vi/ → Vietnamese page
# - http://localhost:8080/zh/ → Chinese page
```

Check in DevTools:
- Console: No errors
- Network: All assets return 200
- JSON-LD: Valid (DevTools > Elements > search for `type="application/ld+json"`)
- `<link rel="alternate" hreflang>`: Present in `<head>` of each page
- Accessibility: Tab through page, all interactive elements reachable

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(landing): deliver SmoothScroll v2 landing — 3 languages, full SEO, conversion-optimized"
```

---

## Task 10: Deploy and post-launch

**Files:**
- Push to `gh-pages` branch
- Verify GitHub Pages URL
- Submit sitemap to Google Search Console
- Request indexing for `/en/`, `/vi/`, `/zh/`

- [ ] **Step 1: Push**

```bash
git push origin gh-pages
```

- [ ] **Step 2: Wait for GitHub Pages rebuild (~2 minutes), then verify**

Visit each URL and confirm HTTP 200:
- `https://smoothscroll.top/`
- `https://smoothscroll.top/en/`
- `https://smoothscroll.top/vi/`
- `https://smoothscroll.top/zh/`

- [ ] **Step 3: Run Lighthouse**

Run Lighthouse against `/en/`:
Expected: Performance ≥ 95, SEO 100, Accessibility ≥ 95

- [ ] **Step 4: Google Search Console**

1. Submit new `sitemap.xml` URL
2. Request crawling/indexing for all 3 language URLs
3. Verify hreflang in GSC → Enhancements → Sitelinks (if present)

- [ ] **Step 5: Commit (deployment commit)**

```bash
git add -A && git commit -m "chore: deploy v2 landing to GitHub Pages"
```
