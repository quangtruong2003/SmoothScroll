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

**Body:**

    Just shipped v0.1.11 of [SmoothScroll](https://github.com/quangtruong2003/SmoothScroll), a free open-source side project I've been polishing for the last few months.

    The itch: every time I switched from my Mac to my Windows desktop, mouse-wheel scrolling felt like jumping from a smooth glide to a series of clicks. Existing tools either only redirect scroll (WizMouse) or are tied to specific hardware (Logitech Options+). I wanted Mac-style inertia for any wheel mouse on any Windows app.

    Built it in Rust + Tauri 2:
    - Single binary, no Electron, ~10 MB resident
    - System tray UI, global hotkey toggle (Ctrl+Alt+S)
    - Per-app exclusion for games that need raw input
    - MIT licensed, signed releases for Windows and macOS

    Live site: https://quangtruong2003.github.io/SmoothScroll/
    Source: https://github.com/quangtruong2003/SmoothScroll

    Feedback very welcome — especially from anyone who's done OS-level input interception before.

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

**First comment (post immediately after launch goes live):**

    Hi Product Hunt! I built SmoothScroll because mouse-wheel scrolling on Windows feels jagged compared to macOS trackpad inertia, and the closest existing tools (WizMouse, KatMouse) only redirect scroll without smoothing motion.

    It sits between the OS and your apps via the Windows low-level mouse hook (WH_MOUSE_LL) and macOS CGEventTap, swallows raw wheel ticks, and re-emits them as eased pulses at 120 Hz. Per-app exclusion lets you disable it for games or apps that prefer raw input.

    Stack: Rust + Tauri 2 + React. Single binary, no Electron, no telemetry. MIT licensed.

    Happy to answer questions — and feedback on the easing curves or input-hook design is very welcome.

**Best launch day:** Tuesday or Wednesday at 12:01am Pacific.

---

## Posting checklist

- [ ] Take a 5-10s GIF of SmoothScroll smoothing a Notepad / browser scroll. Save as `docs/seo/demo.gif`.
- [ ] Post Show HN (Tue-Thu 8-10am ET).
- [ ] Post r/rust, r/Windows11, r/sideproject (stagger by 1 day each to avoid spam-flag).
- [ ] Post Twitter + LinkedIn the same day as HN.
- [ ] Schedule Product Hunt for the following Tuesday.
