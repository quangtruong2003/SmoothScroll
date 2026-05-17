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
