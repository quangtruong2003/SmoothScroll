



# SmoothScroll — Smooth Scrolling for Windows

🌐 **[Website & download → quangtruong2003.github.io/SmoothScroll](https://quangtruong2003.github.io/SmoothScroll/)**

**Smooth mouse-wheel scrolling for Windows 10 and Windows 11.** Native low-level input interception, frame-perfect easing, per-app exclusion. A free, open-source alternative to Logitech SmoothScroll, WizMouse, and Mac-style inertia scrolling utilities — built with Rust, Tauri 2, and React.

> **macOS support is coming soon.** Track progress in [issues](https://github.com/quangtruong2003/SmoothScroll/issues).

[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/license-FSL--1.1--Apache--2.0-blue.svg)](#license)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](#install)
[![Stack](https://img.shields.io/badge/stack-Rust%20%7C%20Tauri%202%20%7C%20React-orange.svg)](#architecture)
[![Release](https://img.shields.io/github/v/release/quangtruong2003/SmoothScroll?label=release)](https://github.com/quangtruong2003/SmoothScroll/releases)
[![Stars](https://img.shields.io/github/stars/quangtruong2003/SmoothScroll?style=social&logo=github)](https://github.com/quangtruong2003/SmoothScroll/stargazers) Windows 10/11

<p align="center">
  <img src="landing/public/assets/before.gif" alt="Before" width="420" />
  <img src="landing/public/assets/after.gif" alt="After" width="420" />
</p>

*Jerky native scroll → SmoothScroll eased scroll*

---

## Why SmoothScroll

Most mice and trackpads emit discrete wheel ticks that feel jagged on apps without native inertia. SmoothScroll sits between the OS and your applications, swallows raw wheel events, and re-emits them as fluid, eased pulses at 120 Hz — giving you Mac-style smooth scrolling on Windows. Configurable easing, per-application opt-out, system-tray UI, global hotkey toggle. Free, open-source, no telemetry.

## Features

- **Native input interception** — low-level mouse hook on Windows (`WH_MOUSE_LL`). Works in any app that accepts wheel input.
- **Frame-perfect easing** — pluggable curves (Linear, Cubic, Quintic, Exponential), tuned for 120 Hz output.
- **Per-app exclusion** — opt specific applications out by process name; everything else stays smoothed.
- **Global hotkey** — toggle smoothing on/off without leaving your keyboard. Default `Ctrl+Alt+S`.
- **System tray** — left-click for settings, right-click for quick controls.
- **Themed UI** — light/dark/system, multi-language (i18next), keyboard-accessible.
- **Auto-update** — built-in updater, signed releases, opt-in.
- **Tiny footprint** — single Rust binary, no Electron, no background services.

## Install

### Windows

Grab `SmoothScroll_<version>_x64-setup.exe` (NSIS) or `.msi` from the [Releases page](https://github.com/quangtruong2003/SmoothScroll/releases) and run it. Installation is per-user — no administrator privileges required.

**Requirements:** Windows 10/11 with WebView2 runtime (preinstalled on Windows 11).

### macOS (coming soon)

> **macOS support is in development.** Track progress in [issues](https://github.com/quangtruong2003/SmoothScroll/issues).

## Usage


| Action         | How                                                 |
| -------------- | --------------------------------------------------- |
| Open settings  | Left-click tray icon                                |
| Quick menu     | Right-click tray icon — Enable, Open Settings, Exit |
| Toggle on/off  | `Ctrl+Alt+S` (rebindable in settings)               |
| Exclude an app | Settings → **Excluded Apps** → add by process name  |


**Settings file:** `%APPDATA%\SmoothScroll\settings.json`

**Logs** (rotated daily, retained 7 days): `%APPDATA%\SmoothScroll\logs\`

## Architecture

SmoothScroll is structured as a workspace with a clean separation between pure logic, OS-specific I/O, and UI.

```
┌────────────────────────────────────────────────────────────────┐
│  src/  (React + TypeScript)                                    │
│  Settings UI · Radix primitives · Tailwind · Zustand · i18next │
└──────────────────────────────┬─────────────────────────────────┘
                               │ Tauri IPC
┌──────────────────────────────▼─────────────────────────────────┐
│  src-tauri/  (Tauri 2 · Rust)                                  │
│  Composition root · IPC commands · tray · global hotkey        │
└──────────────────────────────┬─────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────┐           ┌─────────────────────────────┐
│  crates/core/         │           │  crates/platform/           │
│  Engine · easing math │           │  Windows: low-level hook    │
│  Settings model       │           │  macOS:   CGEventTap        │
│  No OS dependencies   │           │  Process resolver · emitter │
│  Fully unit-tested    │           │  Behind trait abstractions  │
└───────────────────────┘           └─────────────────────────────┘
```


| Path               | Purpose                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `crates/core/`     | Scroll engine, easing math, settings model. Pure Rust, OS-agnostic, fully unit-tested.                      |
| `crates/platform/` | OS-specific implementations behind traits — Windows hook, macOS event tap, wheel emitters, process queries. |
| `src-tauri/`       | Tauri 2 host — composition root, IPC commands, tray, hotkey wiring, lifecycle.                              |
| `src/`             | React + TypeScript settings UI.                                                                             |
| `docs/`            | Specs, design notes, migration plans.                                                                       |


## Build from source

**Prerequisites**

- Rust 1.95+ (pinned via `rust-toolchain.toml`)
- Node.js 20+ with pnpm
- **Windows:** MSVC build tools, WebView2 runtime (preinstalled on Windows 11)

**Build**

```bash
git clone https://github.com/quangtruong2003/SmoothScroll
cd SmoothScroll

npm install
npm run tauri dev      # run with hot reload
npm run tauri build    # produce installers
```

**Output:** `src-tauri/target/release/bundle/{nsis,msi}/`

**Test**

```bash
cargo test --workspace
```

## Status

[Latest release](https://github.com/quangtruong2003/SmoothScroll/releases/latest) — feature-complete v1 on Windows. macOS support is in development.

## Comparison

| | SmoothScroll | LibreScroll | Windows built-in |
|---|---|---|---|
| System-wide | ✅ | ✅ | ❌ |
| Per-app profiles | ✅ | ❌ | ❌ |
| Game mode | ✅ | ❌ | ❌ |
| Open source | FSL-1.1 | GPL-3.0 | Proprietary |

## FAQ

### How do I enable smooth scrolling on Windows 11?

Install SmoothScroll from the [Releases page](https://github.com/quangtruong2003/SmoothScroll/releases), launch it, and scrolling becomes smooth system-wide. No drivers, no admin rights, no reboot required. Toggle on/off any time with `Ctrl+Alt+S`.

### How do I get Mac-style inertia scrolling on Windows?

SmoothScroll re-emits raw mouse-wheel ticks as eased pulses at 120 Hz, producing the same gliding inertia feel as macOS trackpad scrolling — for any wheel mouse, in any Windows app that accepts wheel input.

### Is SmoothScroll free?

Yes. SmoothScroll is free for personal, educational, research, and internal use under the [Functional Source License (FSL-1.1-Apache-2.0)](LICENSE). No telemetry, no ads. Commercial use that competes with SmoothScroll requires a separate license — contact the author. Two years after each release, the code automatically converts to Apache 2.0.

### Does SmoothScroll work on gaming mice (Logitech, Razer, MX Master)?

Yes. SmoothScroll intercepts wheel events at the OS level via the Windows low-level mouse hook (`WH_MOUSE_LL`), so it works with any mouse the OS recognizes — including Logitech MX Master, Razer, Logitech G-series, and trackpads.

### How is SmoothScroll different from WizMouse, Logitech SetPoint, or built-in OS smooth scrolling?

- **vs. WizMouse / KatMouse** — those tools redirect scroll to the window under the cursor; SmoothScroll adds the eased motion curve on top.
- **vs. Logitech SetPoint / Options+** — works with any mouse, not just Logitech hardware.
- **vs. Windows built-in** — Windows has no system-wide smoothing; only some apps (Edge, Chrome) implement their own.

### Is it safe? What about anti-cheat / EAC / BattlEye?

SmoothScroll uses standard Windows `SetWindowsHookEx` API — the same API used by accessibility tools, screen readers, and remote-desktop software. It does not inject into any process. Per-app exclusion lets you disable it for games or apps that prefer raw input.

### Where are settings and logs stored?

**Settings:** `%APPDATA%\SmoothScroll\settings.json`

**Logs** (rotated daily, retained 7 days): `%APPDATA%\SmoothScroll\logs\`

### Does SmoothScroll work on Linux?

Not yet. Linux support requires X11 / Wayland event interception, which is on the roadmap. Track progress in [issues](https://github.com/quangtruong2003/SmoothScroll/issues).

## Contributing

Issues and pull requests are welcome. For substantial changes, open an issue first to discuss the approach. Run `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test --workspace` before submitting.

If this helps your workflow, star us on GitHub — it helps others find the project.

## License

Licensed under the [Functional Source License, Version 1.1, Apache 2.0 Future License](LICENSE) (FSL-1.1-Apache-2.0).

**What you can do for free:**

- View, study, and learn from the source code
- Use it for personal, educational, or research purposes
- Use it internally within your organization
- Modify it and contribute back via pull requests
- Redistribute copies under the same license

**What requires a separate commercial license:**

- Offering SmoothScroll (or a substantially similar product) as a paid product or service
- Selling, sublicensing, or hosting it as a competing commercial offering

**Future Apache 2.0 grant:** Two years after each release date, that release automatically becomes available under the Apache License 2.0 — fully open source, no restrictions.

For commercial licensing inquiries, please open an issue or contact the author.

Copyright © 2026 Quang Truong ([@quangtruong2003](https://github.com/quangtruong2003))
