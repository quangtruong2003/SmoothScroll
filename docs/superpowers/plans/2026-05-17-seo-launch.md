# SEO Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive Google search traffic to `github.com/quangtruong2003/SmoothScroll` by fixing repo metadata, rewriting the README for keyword coverage, shipping a GitHub Pages landing page, and preparing backlink + social content for manual posting.

**Architecture:**
- **Repo metadata** (description, topics, homepage, license detection) is set via `gh api` on `master` — no code changes required.
- **README rewrite** lands on a fresh branch `chore/seo-launch` cut from `master`, then merges via PR. The current `feature/ux-perf-overhaul` work is left untouched.
- **Landing page** lives on a dedicated `gh-pages` orphan branch (so private files in `docs/superpowers/` are NOT exposed publicly). It contains static HTML/CSS, JSON-LD schema, sitemap, and robots.txt.
- **Backlinks (awesome lists, Reddit, Hacker News, Product Hunt, Twitter, LinkedIn)** require human accounts. Claude prepares ready-to-paste drafts in `docs/seo/`; the user posts.

**Tech Stack:** `gh` CLI · GitHub Pages · static HTML/CSS · JSON-LD schema.org · sitemap.xml.

**Executor legend:**
- 🤖 **Claude** — Claude executes via tools available in this session.
- 👤 **User** — Requires the user (Google/Reddit/HN/Product Hunt accounts).

---

## Pre-flight check

**Files:**
- Inspect: working tree state on `feature/ux-perf-overhaul`

- [ ] **Step 0.1: Confirm clean state on current branch**

🤖 Claude

Run: `git status --short`
Expected: empty output (clean tree). If dirty, stash before proceeding:
```bash
git stash push -m "wip-before-seo-launch"
```

- [ ] **Step 0.2: Confirm gh auth**

🤖 Claude

Run: `gh auth status`
Expected: `✓ Logged in to github.com account quangtruong2003`

---

## Phase 1 — GitHub repo metadata (🤖 Claude)

The repo currently has `description: "SmoothScroll free."`, `topics: []`, `homepage: ""`, `license: null` (despite the LICENSE file). Google reads all of these. Fixing them is the highest-leverage action and takes one minute.

### Task 1.1: Set repo description

**Files:** none (GitHub API only)

- [ ] **Step 1.1.1: Update description via gh api**

🤖 Claude

Run:
```bash
gh api -X PATCH repos/quangtruong2003/SmoothScroll \
  -f description='Smooth mouse-wheel scrolling for Windows and macOS — native low-level input interception, frame-perfect easing, per-app exclusion. Built with Rust, Tauri 2, React.'
```
Expected: JSON response with the new `"description"` field.

- [ ] **Step 1.1.2: Verify**

🤖 Claude

Run: `gh api repos/quangtruong2003/SmoothScroll --jq '.description'`
Expected: the full description string.

### Task 1.2: Add topics (tags)

**Files:** none

- [ ] **Step 1.2.1: Set topics via gh api**

🤖 Claude

Run:
```bash
gh api -X PUT repos/quangtruong2003/SmoothScroll/topics \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  -f 'names[]=smooth-scrolling' \
  -f 'names[]=smooth-scroll' \
  -f 'names[]=windows' \
  -f 'names[]=macos' \
  -f 'names[]=mouse-wheel' \
  -f 'names[]=scroll' \
  -f 'names[]=inertia-scroll' \
  -f 'names[]=tauri' \
  -f 'names[]=tauri-app' \
  -f 'names[]=rust' \
  -f 'names[]=react' \
  -f 'names[]=typescript' \
  -f 'names[]=desktop-app' \
  -f 'names[]=windows-utility' \
  -f 'names[]=productivity' \
  -f 'names[]=accessibility' \
  -f 'names[]=input-method' \
  -f 'names[]=system-tray' \
  -f 'names[]=cross-platform' \
  -f 'names[]=tauri2'
```
Expected: JSON listing all 20 topics.

- [ ] **Step 1.2.2: Verify**

🤖 Claude

Run: `gh api repos/quangtruong2003/SmoothScroll/topics --jq '.names'`
Expected: array of 20 topic strings.

### Task 1.3: Trigger license auto-detection

**Files:** check `LICENSE`

- [ ] **Step 1.3.1: Confirm LICENSE file exists at repo root**

🤖 Claude

Run: `ls /d/SmoothScroll/LICENSE`
Expected: file exists. (License field is `null` because GitHub may not have re-scanned. Touching `LICENSE` then committing on the seo branch in Phase 2 will trigger re-detection. If LICENSE is missing, generate one — see Step 1.3.2.)

- [ ] **Step 1.3.2: If LICENSE missing, fetch MIT template**

🤖 Claude

Conditional: only if Step 1.3.1 fails.

Run:
```bash
cd /d/SmoothScroll
gh api /licenses/mit --jq '.body' \
  | sed 's/\[year\]/2026/' \
  | sed 's/\[fullname\]/SmoothScroll contributors/' \
  > LICENSE
```
Expected: `LICENSE` file at repo root with MIT text.

### Task 1.4: Set homepage placeholder

**Files:** none

- [ ] **Step 1.4.1: Set homepage to future Pages URL**

🤖 Claude

Run:
```bash
gh api -X PATCH repos/quangtruong2003/SmoothScroll \
  -f homepage='https://quangtruong2003.github.io/SmoothScroll'
```
Expected: JSON response with the new `"homepage"`.

- [ ] **Step 1.4.2: Verify**

🤖 Claude

Run: `gh api repos/quangtruong2003/SmoothScroll --jq '{description, homepage, topics_count: (.topics | length)}'`
Expected: description present, homepage set, topics_count = 20.

---

## Phase 2 — README SEO rewrite (🤖 Claude)

### Task 2.1: Create the seo branch from master

**Files:** none

- [ ] **Step 2.1.1: Fetch & cut branch from master**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git fetch origin
git checkout -b chore/seo-launch origin/master
```
Expected: `Switched to a new branch 'chore/seo-launch'`.

### Task 2.2: Rewrite README intro for keyword coverage

**Files:**
- Modify: `README.md`

- [ ] **Step 2.2.1: Replace the icon+title block to include alt text + tagline keywords**

🤖 Claude

Replace lines 1-15 of `README.md` with:

```markdown
<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="SmoothScroll — smooth mouse wheel scrolling for Windows and macOS" width="128" height="128" />

# SmoothScroll — Smooth Scrolling for Windows and macOS

**Smooth mouse-wheel scrolling for Windows 10, Windows 11, and macOS.** Native low-level input interception, frame-perfect easing, per-app exclusion. A free, open-source alternative to Logitech SmoothScroll, WizMouse, and Mac-style inertia scrolling utilities — built with Rust, Tauri 2, and React.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#install)
[![Stack](https://img.shields.io/badge/stack-Rust%20%7C%20Tauri%202%20%7C%20React-orange.svg)](#architecture)
[![Release](https://img.shields.io/github/v/release/quangtruong2003/SmoothScroll?label=release)](https://github.com/quangtruong2003/SmoothScroll/releases)
[![Downloads](https://img.shields.io/github/downloads/quangtruong2003/SmoothScroll/total)](https://github.com/quangtruong2003/SmoothScroll/releases)

</div>

---
```

- [ ] **Step 2.2.2: Verify**

🤖 Claude

Run: `head -20 /d/SmoothScroll/README.md`
Expected: new intro present with H1 containing "Smooth Scrolling for Windows and macOS".

### Task 2.3: Add FAQ section before Contributing

The FAQ is the highest-impact SEO addition. Google's "People Also Ask" pulls from H2/H3 question headings.

**Files:**
- Modify: `README.md`

- [ ] **Step 2.3.1: Insert FAQ section before "## Contributing"**

🤖 Claude

Use Edit to replace the line `## Contributing` with the FAQ block followed by `## Contributing`. Exact replacement:

Old:
```markdown
## Contributing
```

New:
```markdown
## FAQ

### How do I enable smooth scrolling on Windows 11?

Install SmoothScroll from the [Releases page](https://github.com/quangtruong2003/SmoothScroll/releases), launch it, and scrolling becomes smooth system-wide. No drivers, no admin rights, no reboot required. Toggle on/off any time with `Ctrl+Alt+S`.

### How do I get Mac-style inertia scrolling on Windows?

SmoothScroll re-emits raw mouse-wheel ticks as eased pulses at 120 Hz, producing the same gliding inertia feel as macOS trackpad scrolling — for any wheel mouse, in any Windows app that accepts wheel input.

### Is SmoothScroll free?

Yes. SmoothScroll is free and open source under the MIT license. No telemetry, no ads, no paid tier.

### Does SmoothScroll work with gaming mice (Logitech, Razer, MX Master)?

Yes. SmoothScroll intercepts wheel events at the OS level via the Windows low-level mouse hook (`WH_MOUSE_LL`) and macOS `CGEventTap`, so it works with any mouse the OS recognizes — including Logitech MX Master, Razer, Logitech G-series, and trackpads.

### How is SmoothScroll different from WizMouse, Logitech SetPoint, or built-in OS smooth scrolling?

- **vs. WizMouse / KatMouse** — those tools redirect scroll to the window under the cursor; SmoothScroll adds the eased motion curve on top.
- **vs. Logitech SetPoint / Options+** — works with any mouse, not just Logitech hardware.
- **vs. Windows built-in** — Windows has no system-wide smoothing; only some apps (Edge, Chrome) implement their own.
- **vs. macOS built-in** — macOS smooths trackpad input but not external wheel mice; SmoothScroll fills that gap.

### Is it safe? What about anti-cheat / EAC / BattlEye?

SmoothScroll uses standard Windows `SetWindowsHookEx` and macOS `CGEventTap` APIs — the same APIs used by accessibility tools, screen readers, and remote-desktop software. It does not inject into any process. Per-app exclusion lets you disable it for games or apps that prefer raw input.

### Where are settings and logs stored?

- Windows — `%APPDATA%\SmoothScroll\settings.json` and `%APPDATA%\SmoothScroll\logs\`
- macOS — `~/Library/Application Support/SmoothScroll/settings.json` and `~/Library/Logs/SmoothScroll/`

### Does SmoothScroll work on Linux?

Not yet. Linux support requires X11 / Wayland event interception, which is on the roadmap. Track progress in [issues](https://github.com/quangtruong2003/SmoothScroll/issues).

## Contributing
```

- [ ] **Step 2.3.2: Verify**

🤖 Claude

Run: `grep -c "^### " /d/SmoothScroll/README.md`
Expected: at least 8 (the eight FAQ H3 headings).

### Task 2.4: Update "Why SmoothScroll" section with keyword variants

**Files:**
- Modify: `README.md`

- [ ] **Step 2.4.1: Replace "Why SmoothScroll" paragraph**

🤖 Claude

Old:
```
Most mice and trackpads emit discrete wheel ticks that feel jagged on apps without native inertia. SmoothScroll sits between the OS and your applications, swallows raw wheel events, and re-emits them as fluid, eased pulses at 120 Hz — with per-application opt-out, configurable easing, and a system-tray UI that stays out of your way.
```

New:
```
Most mice and trackpads emit discrete wheel ticks that feel jagged on apps without native inertia. SmoothScroll sits between the OS and your applications, swallows raw wheel events, and re-emits them as fluid, eased pulses at 120 Hz — giving you Mac-style smooth scrolling on Windows and consistent inertia across every app on macOS. Configurable easing, per-application opt-out, system-tray UI, global hotkey toggle. Free, open-source, no telemetry.
```

- [ ] **Step 2.4.2: Verify**

🤖 Claude

Run: `grep -c "Mac-style smooth scrolling on Windows" /d/SmoothScroll/README.md`
Expected: 1.

### Task 2.5: Commit the README rewrite

**Files:**
- Stage: `README.md` (and `LICENSE` if Phase 1.3.2 ran)

- [ ] **Step 2.5.1: Stage and commit**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git add README.md
git status --short
git commit -m "docs(readme): rewrite for SEO — keyword-rich intro, FAQ section, alt text"
```
Expected: 1 file changed, commit created.

- [ ] **Step 2.5.2: Push branch**

🤖 Claude

Run: `git push -u origin chore/seo-launch`
Expected: branch pushed, gh prints PR creation URL.

---

## Phase 3 — GitHub Pages landing (🤖 Claude)

We use a **dedicated `gh-pages` orphan branch** so private files in `docs/superpowers/` are not exposed. The branch contains only static landing files.

### Task 3.1: Create the gh-pages orphan branch

**Files:** scratch checkout (not on main worktree)

- [ ] **Step 3.1.1: Create orphan branch in a scratch worktree**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git worktree add --detach /tmp/ssc-pages
cd /tmp/ssc-pages
git checkout --orphan gh-pages
git rm -rf . 2>/dev/null || true
```
Expected: detached worktree at `/tmp/ssc-pages`, on orphan branch `gh-pages`, working tree empty.

### Task 3.2: Write landing page index.html

**Files:**
- Create: `/tmp/ssc-pages/index.html`

- [ ] **Step 3.2.1: Write index.html**

🤖 Claude

Write the following content to `/tmp/ssc-pages/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SmoothScroll — Smooth Mouse Wheel Scrolling for Windows and macOS (Free, Open Source)</title>
  <meta name="description" content="Free open-source app that adds Mac-style smooth scrolling to Windows 10/11 and consistent inertia scrolling on macOS. Native low-level input, frame-perfect easing, per-app exclusion. Built with Rust + Tauri 2.">
  <meta name="keywords" content="smooth scrolling windows, smooth scroll windows 11, mac style scrolling windows, mouse wheel inertia, windows smooth scroll app, free smoothscroll, tauri rust scroll, logitech smoothscroll alternative, wizmouse alternative">
  <link rel="canonical" href="https://quangtruong2003.github.io/SmoothScroll/">

  <meta property="og:title" content="SmoothScroll — Smooth Mouse Wheel Scrolling for Windows and macOS">
  <meta property="og:description" content="Free open-source smooth scrolling for Windows 10/11 and macOS. Native input, frame-perfect easing, per-app exclusion.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://quangtruong2003.github.io/SmoothScroll/">
  <meta property="og:image" content="https://raw.githubusercontent.com/quangtruong2003/SmoothScroll/master/src-tauri/icons/128x128@2x.png">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="SmoothScroll — Smooth Scrolling for Windows & macOS">
  <meta name="twitter:description" content="Free open-source smooth scrolling for Windows and macOS.">
  <meta name="twitter:image" content="https://raw.githubusercontent.com/quangtruong2003/SmoothScroll/master/src-tauri/icons/128x128@2x.png">

  <link rel="icon" href="https://raw.githubusercontent.com/quangtruong2003/SmoothScroll/master/src-tauri/icons/icon.ico">
  <link rel="stylesheet" href="styles.css">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SmoothScroll",
    "operatingSystem": "Windows 10, Windows 11, macOS 12+",
    "applicationCategory": "UtilitiesApplication",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "downloadUrl": "https://github.com/quangtruong2003/SmoothScroll/releases",
    "softwareVersion": "0.1.11",
    "license": "https://opensource.org/licenses/MIT",
    "url": "https://quangtruong2003.github.io/SmoothScroll/",
    "sameAs": "https://github.com/quangtruong2003/SmoothScroll",
    "description": "Smooth mouse-wheel scrolling for Windows and macOS. Native low-level input interception, frame-perfect easing, per-app exclusion. Built with Rust, Tauri 2, and React.",
    "author": { "@type": "Person", "name": "Quang Truong" }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "How do I enable smooth scrolling on Windows 11?",
        "acceptedAnswer": { "@type": "Answer", "text": "Install SmoothScroll from the GitHub Releases page, launch it, and scrolling becomes smooth system-wide. No drivers, no admin rights, no reboot. Toggle with Ctrl+Alt+S." } },
      { "@type": "Question", "name": "How do I get Mac-style inertia scrolling on Windows?",
        "acceptedAnswer": { "@type": "Answer", "text": "SmoothScroll re-emits raw mouse-wheel ticks as eased pulses at 120 Hz, producing macOS-trackpad-style gliding inertia for any wheel mouse in any Windows app." } },
      { "@type": "Question", "name": "Is SmoothScroll free?",
        "acceptedAnswer": { "@type": "Answer", "text": "Yes. SmoothScroll is free and open source under the MIT license. No telemetry, no ads." } },
      { "@type": "Question", "name": "Does SmoothScroll work with gaming mice like Logitech MX Master and Razer?",
        "acceptedAnswer": { "@type": "Answer", "text": "Yes. SmoothScroll intercepts wheel events at the OS level via the Windows low-level mouse hook and macOS CGEventTap, so it works with any mouse the OS recognizes." } }
    ]
  }
  </script>
</head>
<body>
<header class="hero">
  <img src="https://raw.githubusercontent.com/quangtruong2003/SmoothScroll/master/src-tauri/icons/128x128@2x.png" alt="SmoothScroll app icon" width="96" height="96">
  <h1>SmoothScroll</h1>
  <p class="tagline">Smooth mouse-wheel scrolling for <strong>Windows 10/11</strong> and <strong>macOS</strong>.</p>
  <p class="sub">Native low-level input interception · frame-perfect easing · per-app exclusion · free &amp; open source.</p>
  <div class="cta">
    <a class="btn primary" href="https://github.com/quangtruong2003/SmoothScroll/releases/latest">Download latest release</a>
    <a class="btn ghost" href="https://github.com/quangtruong2003/SmoothScroll">View on GitHub</a>
  </div>
</header>

<main>
<section>
  <h2>What it does</h2>
  <p>Most mice emit discrete wheel ticks that feel jagged in apps without native inertia. SmoothScroll sits between the OS and your applications, swallows raw wheel events, and re-emits them as fluid, eased pulses at 120 Hz — giving you <strong>Mac-style smooth scrolling on Windows</strong> and consistent inertia across every app on macOS.</p>
</section>

<section>
  <h2>Features</h2>
  <ul>
    <li><strong>Native input interception</strong> — Windows low-level mouse hook (<code>WH_MOUSE_LL</code>); macOS <code>CGEventTap</code>.</li>
    <li><strong>Frame-perfect easing</strong> — Linear, Cubic, Quintic, Exponential curves tuned for 120 Hz output.</li>
    <li><strong>Per-app exclusion</strong> — opt apps out by process name; everything else stays smoothed.</li>
    <li><strong>Global hotkey</strong> — <code>Ctrl+Alt+S</code> default, rebindable.</li>
    <li><strong>System tray UI</strong> — left-click for settings, right-click for quick controls.</li>
    <li><strong>Auto-update</strong> — signed releases via Tauri updater (opt-in).</li>
    <li><strong>Tiny footprint</strong> — single Rust binary, no Electron, no background services.</li>
  </ul>
</section>

<section>
  <h2>Install</h2>
  <h3>Windows 10 / 11</h3>
  <p>Download <code>SmoothScroll_&lt;version&gt;_x64-setup.exe</code> (NSIS) or <code>.msi</code> from the <a href="https://github.com/quangtruong2003/SmoothScroll/releases">Releases page</a>. Per-user install, no admin rights.</p>
  <h3>macOS 12+ (Apple Silicon)</h3>
  <p>Download the <code>.dmg</code>, drag SmoothScroll.app to <code>/Applications</code>, right-click → Open on first launch (Gatekeeper), then grant Accessibility access.</p>
</section>

<section id="faq">
  <h2>FAQ</h2>
  <h3>How do I enable smooth scrolling on Windows 11?</h3>
  <p>Install SmoothScroll, launch it, and scrolling becomes smooth system-wide. No drivers, no admin rights, no reboot. Toggle on/off with <code>Ctrl+Alt+S</code>.</p>
  <h3>How do I get Mac-style inertia scrolling on Windows?</h3>
  <p>SmoothScroll re-emits raw mouse-wheel ticks as eased pulses at 120 Hz, producing the same gliding inertia feel as macOS trackpad scrolling — for any wheel mouse, in any Windows app.</p>
  <h3>Does it work with Logitech MX Master, Razer, and other gaming mice?</h3>
  <p>Yes. SmoothScroll intercepts at the OS level, so any mouse the OS recognizes works.</p>
  <h3>Is it safe with anti-cheat (EAC, BattlEye)?</h3>
  <p>SmoothScroll uses the same standard input APIs as accessibility tools and screen readers. Per-app exclusion lets you disable it for games that prefer raw input.</p>
  <h3>Is it free?</h3>
  <p>Yes — MIT licensed, no telemetry, no ads.</p>
</section>

<section>
  <h2>Open source</h2>
  <p>Source code, issue tracker, and roadmap on <a href="https://github.com/quangtruong2003/SmoothScroll">GitHub</a>. Built with Rust, Tauri 2, and React. Pull requests welcome.</p>
</section>
</main>

<footer>
  <p>&copy; 2026 SmoothScroll contributors · <a href="https://github.com/quangtruong2003/SmoothScroll/blob/master/LICENSE">MIT License</a> · <a href="https://github.com/quangtruong2003/SmoothScroll">GitHub</a></p>
</footer>
</body>
</html>
```

- [ ] **Step 3.2.2: Verify**

🤖 Claude

Run: `wc -l /tmp/ssc-pages/index.html`
Expected: ~120 lines.

### Task 3.3: Write styles.css

**Files:**
- Create: `/tmp/ssc-pages/styles.css`

- [ ] **Step 3.3.1: Write styles.css**

🤖 Claude

Write to `/tmp/ssc-pages/styles.css`:

```css
:root {
  --bg: #0b0d12;
  --fg: #e8eaf0;
  --muted: #9aa1b1;
  --accent: #5b8cff;
  --accent-fg: #ffffff;
  --surface: #131722;
  --border: #1f2433;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #fafbfc;
    --fg: #0b0d12;
    --muted: #5b6273;
    --surface: #ffffff;
    --border: #e6e8ee;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
}
.hero {
  text-align: center;
  padding: 6rem 1.5rem 4rem;
  max-width: 720px;
  margin: 0 auto;
}
.hero img { border-radius: 22%; box-shadow: 0 12px 40px rgba(0,0,0,.25); }
.hero h1 { font-size: clamp(2.5rem, 1rem + 5vw, 4.5rem); margin: 1.25rem 0 0.5rem; letter-spacing: -.02em; }
.tagline { font-size: clamp(1.1rem, .9rem + .5vw, 1.4rem); color: var(--fg); margin: 0 0 .5rem; }
.tagline strong { color: var(--accent); }
.sub { color: var(--muted); margin: 0 0 2rem; }
.cta { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }
.btn {
  display: inline-block;
  padding: .85rem 1.5rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 600;
  transition: transform .15s ease, box-shadow .15s ease;
}
.btn:hover { transform: translateY(-1px); }
.btn.primary { background: var(--accent); color: var(--accent-fg); box-shadow: 0 6px 20px rgba(91,140,255,.35); }
.btn.ghost { background: var(--surface); color: var(--fg); border: 1px solid var(--border); }
main { max-width: 760px; margin: 0 auto; padding: 0 1.5rem 4rem; }
section { padding: 2rem 0; border-top: 1px solid var(--border); }
section:first-child { border-top: 0; }
h2 { font-size: 1.6rem; margin: 0 0 .75rem; letter-spacing: -.01em; }
h3 { font-size: 1.05rem; margin: 1.25rem 0 .25rem; }
p, li { color: var(--fg); }
li { margin: .35rem 0; }
ul { padding-left: 1.25rem; }
code { background: var(--surface); padding: .15rem .4rem; border-radius: 4px; font-size: .9em; border: 1px solid var(--border); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
footer { text-align: center; padding: 2rem 1.5rem 4rem; color: var(--muted); font-size: .9rem; }
@media (max-width: 540px) { .hero { padding-top: 3rem; } }
```

- [ ] **Step 3.3.2: Verify**

🤖 Claude

Run: `wc -l /tmp/ssc-pages/styles.css`
Expected: ~50 lines.

### Task 3.4: Write sitemap.xml + robots.txt + .nojekyll

**Files:**
- Create: `/tmp/ssc-pages/sitemap.xml`
- Create: `/tmp/ssc-pages/robots.txt`
- Create: `/tmp/ssc-pages/.nojekyll`

- [ ] **Step 3.4.1: Write sitemap.xml**

🤖 Claude

Write to `/tmp/ssc-pages/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://quangtruong2003.github.io/SmoothScroll/</loc>
    <lastmod>2026-05-17</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://github.com/quangtruong2003/SmoothScroll</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://github.com/quangtruong2003/SmoothScroll/releases</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

- [ ] **Step 3.4.2: Write robots.txt**

🤖 Claude

Write to `/tmp/ssc-pages/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://quangtruong2003.github.io/SmoothScroll/sitemap.xml
```

- [ ] **Step 3.4.3: Write empty .nojekyll**

🤖 Claude

Write empty file: `/tmp/ssc-pages/.nojekyll`. (Disables Jekyll processing on Pages.)

### Task 3.5: Commit & push gh-pages branch

**Files:** all in /tmp/ssc-pages

- [ ] **Step 3.5.1: Commit**

🤖 Claude

Run:
```bash
cd /tmp/ssc-pages
git add -A
git status --short
git commit -m "feat(site): initial GitHub Pages landing"
```
Expected: 5 files added, commit created.

- [ ] **Step 3.5.2: Push gh-pages**

🤖 Claude

Run: `git push -u origin gh-pages`
Expected: branch pushed.

- [ ] **Step 3.5.3: Remove the temp worktree**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git worktree remove /tmp/ssc-pages
```
Expected: worktree gone.

### Task 3.6: Enable GitHub Pages from gh-pages branch

**Files:** none (API call)

- [ ] **Step 3.6.1: Enable Pages via gh api**

🤖 Claude

Run:
```bash
gh api -X POST repos/quangtruong2003/SmoothScroll/pages \
  -H "Accept: application/vnd.github+json" \
  -f 'source[branch]=gh-pages' \
  -f 'source[path]=/'
```
Expected: 201 with `"html_url": "https://quangtruong2003.github.io/SmoothScroll/"`. If Pages already exists (409), update via PUT:
```bash
gh api -X PUT repos/quangtruong2003/SmoothScroll/pages \
  -H "Accept: application/vnd.github+json" \
  -f 'source[branch]=gh-pages' -f 'source[path]=/'
```

- [ ] **Step 3.6.2: Verify Pages status**

🤖 Claude

Run: `gh api repos/quangtruong2003/SmoothScroll/pages --jq '{status, html_url, source}'`
Expected: `status: "building"` or `"built"`, html_url present.

- [ ] **Step 3.6.3: Wait for build, then curl**

🤖 Claude

Wait ~60s then run:
```bash
curl -sI https://quangtruong2003.github.io/SmoothScroll/ | head -3
```
Expected: `HTTP/2 200`.

### Task 3.7: Add landing-page link to README

**Files:**
- Modify: `README.md` (on `chore/seo-launch` branch)

- [ ] **Step 3.7.1: Switch back to seo branch & add link**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git checkout chore/seo-launch
```

Then Edit `README.md`. Old:
```markdown
# SmoothScroll — Smooth Scrolling for Windows and macOS
```

New:
```markdown
# SmoothScroll — Smooth Scrolling for Windows and macOS

🌐 **[Website &amp; download → quangtruong2003.github.io/SmoothScroll](https://quangtruong2003.github.io/SmoothScroll/)**
```

- [ ] **Step 3.7.2: Commit**

🤖 Claude

Run:
```bash
git add README.md
git commit -m "docs(readme): link to landing page"
git push
```
Expected: commit pushed to `chore/seo-launch`.

### Task 3.8: Open the SEO PR

**Files:** none

- [ ] **Step 3.8.1: Create PR**

🤖 Claude

Run:
```bash
gh pr create --base master --head chore/seo-launch \
  --title "chore(seo): SEO launch — README rewrite + landing page link" \
  --body "$(cat <<'EOF'
## Summary
- Rewrite README intro for keyword coverage (Windows 10/11, macOS, Mac-style smooth scrolling, Logitech alternative)
- Add image alt text and badge row (release version + downloads)
- Add 8-question FAQ section optimized for Google "People Also Ask"
- Link to new GitHub Pages landing at https://quangtruong2003.github.io/SmoothScroll/

## Companion changes (already live on master via API)
- Repo description set
- 20 topics added
- Homepage set to Pages URL
- Pages enabled from gh-pages branch (orphan, separate from this PR)

## Test plan
- [ ] Open the PR diff and skim README rendering
- [ ] Visit https://quangtruong2003.github.io/SmoothScroll/ — confirm hero + FAQ render
- [ ] curl -sI https://quangtruong2003.github.io/SmoothScroll/sitemap.xml returns 200
- [ ] After merge, request indexing in Google Search Console (see docs/seo/search-console.md)
EOF
)"
```
Expected: PR URL printed.

---

## Phase 4 — Backlinks: drafts + automation (🤖 Claude drafts; 👤 user submits)

### Task 4.1: Generate awesome-list PR drafts

**Files:**
- Create: `docs/seo/awesome-list-prs.md`

- [ ] **Step 4.1.1: Write draft file**

🤖 Claude

Write the following to `/d/SmoothScroll/docs/seo/awesome-list-prs.md`:

```markdown
# Awesome-list PR drafts

Targets prioritized by relevance and acceptance rate. Submit in this order:

## 1. tauri-apps/awesome-tauri (highest signal, fastest accept)

**Repo:** https://github.com/tauri-apps/awesome-tauri
**Section:** `## Applications` → likely `### Utilities` or `### Productivity`

**File to edit:** `README.md`
**Line to add (alphabetical order in Utilities):**

    - [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll) - Smooth mouse-wheel scrolling for Windows and macOS. Native low-level input, frame-perfect easing, per-app exclusion. ![macOS][apple-icon] ![Windows][windows-icon]

**PR title:** `Add SmoothScroll to Applications/Utilities`

**PR body:**

    Adds [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll), a Tauri 2 + Rust desktop utility that adds Mac-style smooth scrolling to Windows and consistent mouse-wheel inertia on macOS.

    - Tauri 2, Rust 1.78+, React + TypeScript front end
    - MIT licensed, signed releases for Windows and macOS
    - Working v0.1.11 release

    Per the [contributing guide](CONTRIBUTING.md), the entry is alphabetized within Utilities and follows the existing format with platform icons.

## 2. rust-unofficial/awesome-rust

**Repo:** https://github.com/rust-unofficial/awesome-rust
**Section:** `## Applications` → `### Utilities` or `### System tools`

**Line to add:**

    * [quangtruong2003/SmoothScroll](https://github.com/quangtruong2003/SmoothScroll) — Smooth mouse-wheel scrolling utility for Windows and macOS. [![build](https://github.com/quangtruong2003/SmoothScroll/actions/workflows/auto-release.yml/badge.svg)](https://github.com/quangtruong2003/SmoothScroll/actions)

**PR title:** `Add SmoothScroll under Applications`

**PR body:**

    Adds [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll), a cross-platform smooth-scrolling utility written in Rust (Tauri 2 host + native low-level input on Windows/macOS, MIT licensed).

## 3. Awesome-Windows/Awesome

**Repo:** https://github.com/Awesome-Windows/Awesome
**Section:** `## Productivity` → likely `### Mouse and Keyboard`

**Line to add:**

    * [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll) - Free, open-source smooth mouse-wheel scrolling for Windows 10/11. Native low-level input hook, frame-perfect easing, per-app exclusion.

## 4. agarrharr/awesome-cli-apps — skip (not a CLI)
## 5. styfle/awesome-online-ide — skip (not an IDE)

---

## Submission checklist

- [ ] Fork awesome-tauri, edit README.md, push to `add-smoothscroll` branch, open PR
- [ ] Fork awesome-rust, edit README.md, push, open PR
- [ ] Fork Awesome-Windows, edit README.md, push, open PR
- [ ] Track PRs in https://github.com/quangtruong2003?tab=overview
```

- [ ] **Step 4.1.2: Verify**

🤖 Claude

Run: `wc -l /d/SmoothScroll/docs/seo/awesome-list-prs.md`
Expected: ~60 lines.

### Task 4.2: Auto-fork & open the awesome-tauri PR (Claude executes if user authorizes)

**Files:** scratch fork

- [ ] **Step 4.2.1: User authorization gate**

👤 User

This task forks a third-party repo to your `quangtruong2003` account and opens a PR. Confirm before Claude proceeds. The branch is named `add-smoothscroll` and the only edit is one line added to `README.md`.

- [ ] **Step 4.2.2: Fork awesome-tauri & prep branch**

🤖 Claude (after user approves)

Run:
```bash
cd /tmp
gh repo fork tauri-apps/awesome-tauri --clone --remote
cd awesome-tauri
git checkout -b add-smoothscroll
```

- [ ] **Step 4.2.3: Locate Utilities section in README and edit**

🤖 Claude

Run: `grep -n "Utilities\|Productivity" README.md | head -10`

Then use Edit to insert the SmoothScroll entry alphabetically into the appropriate section (entry text from Task 4.1).

- [ ] **Step 4.2.4: Commit, push, open PR**

🤖 Claude

Run:
```bash
git add README.md
git diff --cached
git commit -m "Add SmoothScroll to Applications/Utilities"
git push -u origin add-smoothscroll
gh pr create --repo tauri-apps/awesome-tauri \
  --title "Add SmoothScroll to Applications/Utilities" \
  --body "Adds [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll), a Tauri 2 + Rust desktop utility that adds Mac-style smooth scrolling to Windows and consistent mouse-wheel inertia on macOS. MIT licensed, signed releases for Windows and macOS, working v0.1.11 release."
```
Expected: PR URL printed.

- [ ] **Step 4.2.5: Repeat for awesome-rust and Awesome-Windows**

🤖 Claude (after user approves each)

Same flow as 4.2.2-4.2.4 but with respective upstream repos. Skip if user prefers manual submission.

### Task 4.3: Generate Reddit / HN / Twitter / Product Hunt drafts

**Files:**
- Create: `docs/seo/social-posts.md`

- [ ] **Step 4.3.1: Write the social drafts file**

🤖 Claude

Write to `/d/SmoothScroll/docs/seo/social-posts.md`:

```markdown
# Social-launch drafts

Each draft is ready to copy-paste. Posting requires the user's account on each platform.

---

## Hacker News — Show HN

**URL:** https://news.ycombinator.com/submit
**Title (max 80 chars):** `Show HN: SmoothScroll – Mac-style smooth scrolling for Windows, in Rust + Tauri`
**URL field:** `https://github.com/quangtruong2003/SmoothScroll`

**Comment to post immediately after submission:**

    Hi HN — I built SmoothScroll because mouse-wheel scrolling on Windows feels jagged compared to macOS trackpad inertia, and the closest existing tools (WizMouse, KatMouse) only redirect scroll without smoothing motion.

    It sits between the OS and your apps via the Windows low-level mouse hook (WH_MOUSE_LL) and macOS CGEventTap, swallows raw wheel ticks, and re-emits them as eased pulses at 120 Hz. Per-app exclusion lets you disable it for games or apps that prefer raw input.

    Stack: Rust (workspace with crates/core for the engine + crates/platform for OS-specific hooks), Tauri 2 host, React + TypeScript settings UI. Single binary, no Electron, no background services. MIT.

    Happy to answer questions about the input hook approach, the easing math, or the Tauri 2 migration.

**Best time to post:** Tuesday-Thursday, 8-10am Eastern. Avoid weekends and Mondays.

---

## Reddit — r/rust

**Title:** `[Project] SmoothScroll: Mac-style smooth mouse-wheel scrolling for Windows, written in Rust + Tauri 2`

**Body:**

    Hey r/rust, I just released v0.1.11 of [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll) — a small cross-platform utility that adds eased, 120 Hz inertia to raw mouse-wheel input on Windows and macOS.

    Architecture:
    - `crates/core/` — pure Rust engine, easing math, settings model. No OS deps. Fully unit-tested.
    - `crates/platform/` — OS-specific behind traits. Windows uses `SetWindowsHookEx(WH_MOUSE_LL)`; macOS uses `CGEventTap`. Process resolver and wheel emitter live here.
    - `src-tauri/` — Tauri 2 composition root, IPC commands, system tray, global hotkey.
    - `src/` — React + TS settings UI.

    Things I'd love feedback on:
    - The trait abstraction for the OS-specific input layer
    - Easing curve choice (Linear / Cubic / Quintic / Exponential — currently Quintic default)
    - Test strategy for the platform layer (currently mocked at the trait boundary)

    MIT, signed releases, no telemetry. Repo: https://github.com/quangtruong2003/SmoothScroll

**Flair:** `🛠️ project`

---

## Reddit — r/Windows10 and r/Windows11

**Title:** `I made a free open-source app for Mac-style smooth mouse-wheel scrolling on Windows`

**Body:**

    Hi all — Windows scrolling has always felt jagged to me compared to macOS trackpad scrolling, so I built [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll) to fix it.

    It runs in the system tray, intercepts raw mouse-wheel ticks at the OS level, and re-emits them as smooth eased pulses. Works in any app that takes wheel input — browsers, file explorer, IDEs, Office, even most games (with per-app exclusion if a game prefers raw input).

    - Free, open source (MIT)
    - No drivers, no admin, no reboot
    - Toggle with Ctrl+Alt+S
    - Tiny — single Rust binary

    Direct download: https://github.com/quangtruong2003/SmoothScroll/releases/latest

---

## Reddit — r/sideproject

**Title:** `SmoothScroll v0.1.11 — built a free smooth-scrolling app for Windows + macOS in Rust`

**Body:** (same body as r/rust, less technical detail; emphasize the journey + open source angle)

---

## Twitter / X

**Tweet 1 (announce):**

    Just shipped SmoothScroll v0.1.11 🪶

    Free, open-source, Mac-style smooth mouse-wheel scrolling for Windows and macOS.

    → Native input hook (no driver)
    → 120 Hz frame-perfect easing
    → Per-app exclusion
    → Single Rust binary, MIT

    https://quangtruong2003.github.io/SmoothScroll/
    #rustlang #tauri

**Tweet 2 (technical thread, optional):**

    Stack:
    - crates/core: pure Rust engine + easing math
    - crates/platform: WH_MOUSE_LL on Windows, CGEventTap on macOS
    - Tauri 2 host
    - React + TS settings UI

    Trait-bounded OS layer keeps core 100% unit-testable.

---

## LinkedIn

**Post:**

    Excited to share v0.1.11 of SmoothScroll — a small, free, open-source utility that brings Mac-style smooth mouse-wheel scrolling to Windows.

    Built with Rust and Tauri 2, it intercepts wheel input at the OS level and re-emits eased pulses at 120 Hz. The core engine is pure Rust with full unit-test coverage; OS-specific input lives behind trait abstractions.

    If you've ever felt that Windows scrolling was rougher than macOS — try it.

    GitHub: https://github.com/quangtruong2003/SmoothScroll
    Site: https://quangtruong2003.github.io/SmoothScroll/

    #opensource #rustlang #tauri #productivity

---

## Product Hunt launch

**URL:** https://www.producthunt.com/posts/new
**Tagline (60 chars):** `Smooth mouse-wheel scrolling for Windows and macOS`

**Description:**

    Free, open-source utility that adds Mac-style smooth scrolling to Windows and consistent mouse-wheel inertia on macOS. Native low-level input interception, frame-perfect easing at 120 Hz, per-app exclusion, system-tray UI. Built with Rust and Tauri 2. MIT licensed, no telemetry.

**Topics:** Productivity · Developer Tools · Open Source · Mac · Windows
**First comment:** same body as the HN comment.
**Best launch day:** Tuesday or Wednesday at 12:01am Pacific.

---

## Posting checklist

- [ ] Take a 5-10s GIF of SmoothScroll smoothing a Notepad / browser scroll. Save as `docs/seo/demo.gif`.
- [ ] Post Show HN (Tue-Thu 8-10am ET).
- [ ] Post r/rust, r/Windows11, r/sideproject (stagger by 1 day each to avoid spam-flag).
- [ ] Post Twitter + LinkedIn the same day as HN.
- [ ] Schedule Product Hunt for the following Tuesday.
```

- [ ] **Step 4.3.2: Verify**

🤖 Claude

Run: `wc -l /d/SmoothScroll/docs/seo/social-posts.md`
Expected: ~120 lines.

### Task 4.4: Commit drafts to seo branch

**Files:**
- Stage: `docs/seo/awesome-list-prs.md`, `docs/seo/social-posts.md`

- [ ] **Step 4.4.1: Commit & push**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git checkout chore/seo-launch
git add docs/seo/
git commit -m "docs(seo): backlink + social-post drafts"
git push
```
Expected: commit pushed to `chore/seo-launch`, PR auto-updates.

---

## Phase 5 — Search Console + final verification (👤 User; 🤖 Claude prepares)

### Task 5.1: Write Search Console submission guide

**Files:**
- Create: `docs/seo/search-console.md`

- [ ] **Step 5.1.1: Write the guide**

🤖 Claude

Write to `/d/SmoothScroll/docs/seo/search-console.md`:

```markdown
# Google Search Console submission

Google indexes GitHub fast (1-3 days), but indexing the new landing page is faster if you submit it explicitly.

## Step 1 — verify the landing page

1. Go to https://search.google.com/search-console
2. Click **Add property** → **URL prefix**
3. Enter: `https://quangtruong2003.github.io/SmoothScroll/`
4. Verification method: **HTML file** (Search Console gives a file like `googleXXXXXXXX.html`).
5. Add the file to the `gh-pages` branch:

       git worktree add /tmp/ssc-pages-verify gh-pages
       cp ~/Downloads/googleXXXXXXXX.html /tmp/ssc-pages-verify/
       cd /tmp/ssc-pages-verify
       git add googleXXXXXXXX.html
       git commit -m "chore(site): Search Console verification"
       git push
       cd /d/SmoothScroll
       git worktree remove /tmp/ssc-pages-verify

6. Wait ~30 seconds for Pages to redeploy. Click **Verify** in Search Console.

## Step 2 — submit sitemap

1. In Search Console, go to **Sitemaps** (left sidebar)
2. Add sitemap URL: `sitemap.xml`
3. Click **Submit**. Status should turn green within minutes.

## Step 3 — request indexing for the landing page

1. **URL Inspection** (top search bar): paste `https://quangtruong2003.github.io/SmoothScroll/`
2. Click **Request Indexing**.
3. Repeat for `https://github.com/quangtruong2003/SmoothScroll` (you don't own github.com, but the URL Inspection tool still nudges Googlebot).

## Step 4 — Bing (optional, 5 min for ~3% extra traffic)

1. https://www.bing.com/webmasters → sign in
2. Import from Google Search Console (one click) — Bing pulls verification + sitemap automatically.

## Expected timeline

- 1-3 days: landing page appears in `site:quangtruong2003.github.io` search.
- 1-2 weeks: starts ranking for long-tail keywords like "tauri smooth scroll" or "windows mouse wheel inertia rust".
- 1-2 months: starts ranking for high-competition keywords like "smooth scrolling windows" if backlinks land (awesome-tauri PR + 1-2 social posts).
```

### Task 5.2: Final verification checklist

**Files:** none

- [ ] **Step 5.2.1: Verify Phase 1**

🤖 Claude

Run:
```bash
gh api repos/quangtruong2003/SmoothScroll --jq '{description, homepage, has_pages, license: .license.spdx_id, topics: (.topics | length)}'
```
Expected:
- description: full SEO string
- homepage: `https://quangtruong2003.github.io/SmoothScroll`
- has_pages: true
- license: `MIT` (may take 5-10 min after License file lands)
- topics: 20

- [ ] **Step 5.2.2: Verify Phase 2 (PR)**

🤖 Claude

Run: `gh pr view chore/seo-launch --json url,state,title --jq .`
Expected: state `OPEN`, title contains "SEO launch".

- [ ] **Step 5.2.3: Verify Phase 3 (live landing)**

🤖 Claude

Run:
```bash
curl -sI https://quangtruong2003.github.io/SmoothScroll/ | head -1
curl -s https://quangtruong2003.github.io/SmoothScroll/ | grep -c "FAQPage"
curl -sI https://quangtruong2003.github.io/SmoothScroll/sitemap.xml | head -1
```
Expected:
- First curl: `HTTP/2 200`
- Second: `1` (FAQPage JSON-LD present)
- Third: `HTTP/2 200`

- [ ] **Step 5.2.4: User confirms manual steps**

👤 User

- [ ] Post Hacker News Show HN (Tue-Thu 8-10am ET)
- [ ] Post Reddit r/rust + r/Windows11 + r/sideproject (stagger 1 day each)
- [ ] Post Twitter / X + LinkedIn
- [ ] Submit Product Hunt for next Tuesday
- [ ] Submit awesome-tauri PR (or have Claude submit per Task 4.2)
- [ ] Submit awesome-rust PR
- [ ] Submit Awesome-Windows PR
- [ ] Verify in Google Search Console (Task 5.1 guide)
- [ ] Submit sitemap in Search Console
- [ ] Request indexing for landing page

### Task 5.3: Commit Search Console guide

**Files:**
- Stage: `docs/seo/search-console.md`

- [ ] **Step 5.3.1: Commit & push**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git checkout chore/seo-launch
git add docs/seo/search-console.md
git commit -m "docs(seo): Search Console submission guide"
git push
```

### Task 5.4: Merge the SEO PR

**Files:** none

- [ ] **Step 5.4.1: Merge**

👤 User (or 🤖 Claude if user authorizes)

Run:
```bash
gh pr merge chore/seo-launch --squash --delete-branch
```
Expected: PR merged into master, branch deleted.

- [ ] **Step 5.4.2: Return to original branch**

🤖 Claude

Run:
```bash
cd /d/SmoothScroll
git checkout feature/ux-perf-overhaul
```
Expected: back on the original feature branch with no changes.

---

## Done.

After this plan completes:
- Repo metadata is keyword-rich (description, 20 topics, license, homepage).
- README ranks for Windows / macOS / smooth-scrolling / Tauri / Rust queries.
- Live landing page at `https://quangtruong2003.github.io/SmoothScroll/` with structured data (SoftwareApplication + FAQPage JSON-LD), sitemap, robots.txt.
- Drafts ready for HN, Reddit, Twitter, LinkedIn, Product Hunt, and 3 awesome-list PRs.
- Search Console submission guide ready.

Realistic outcome at 4-6 weeks: top-3 ranking for `smooth scroll windows tauri`, `windows mouse wheel inertia rust`; first-page for `mac style smooth scrolling windows free`.
