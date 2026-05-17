<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="SmoothScroll — smooth mouse wheel scrolling for Windows and macOS" width="128" height="128" />

# SmoothScroll — Smooth Scrolling for Windows and macOS

🌐 **[Website &amp; download → quangtruong2003.github.io/SmoothScroll](https://quangtruong2003.github.io/SmoothScroll/)**

**Smooth mouse-wheel scrolling for Windows 10, Windows 11, and macOS.** Native low-level input interception, frame-perfect easing, per-app exclusion. A free, open-source alternative to Logitech SmoothScroll, WizMouse, and Mac-style inertia scrolling utilities — built with Rust, Tauri 2, and React.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#install)
[![Stack](https://img.shields.io/badge/stack-Rust%20%7C%20Tauri%202%20%7C%20React-orange.svg)](#architecture)
[![Release](https://img.shields.io/github/v/release/quangtruong2003/SmoothScroll?label=release)](https://github.com/quangtruong2003/SmoothScroll/releases)
[![Downloads](https://img.shields.io/github/downloads/quangtruong2003/SmoothScroll/total)](https://github.com/quangtruong2003/SmoothScroll/releases)

</div>

---

## Why SmoothScroll

Most mice and trackpads emit discrete wheel ticks that feel jagged on apps without native inertia. SmoothScroll sits between the OS and your applications, swallows raw wheel events, and re-emits them as fluid, eased pulses at 120 Hz — giving you Mac-style smooth scrolling on Windows and consistent inertia across every app on macOS. Configurable easing, per-application opt-out, system-tray UI, global hotkey toggle. Free, open-source, no telemetry.

## Features

- **Native input interception** — low-level mouse hook on Windows, `CGEventTap` on macOS. Works in any app that accepts wheel input.
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

### macOS

1. Download `SmoothScroll_<version>_aarch64.dmg` and mount it.
2. Drag **SmoothScroll.app** into `/Applications`.
3. The first launch is blocked by Gatekeeper (the app isn't notarized yet):
   - Right-click **SmoothScroll.app** → **Open**
   - Confirm in the dialog
4. Grant **Accessibility** access when prompted: System Settings → Privacy & Security → Accessibility → toggle SmoothScroll on.
5. The app detects the grant automatically and resumes.

**Requirements:** macOS 12 (Monterey) or later, Apple Silicon.

## Usage

| Action | How |
|--------|-----|
| Open settings | Left-click tray icon |
| Quick menu | Right-click tray icon — Enable, Open Settings, Exit |
| Toggle on/off | `Ctrl+Alt+S` (rebindable in settings) |
| Exclude an app | Settings → **Excluded Apps** → add by process name |

**Settings file:**
- Windows — `%APPDATA%\SmoothScroll\settings.json`
- macOS — `~/Library/Application Support/SmoothScroll/settings.json`

**Logs** (rotated daily, retained 7 days):
- Windows — `%APPDATA%\SmoothScroll\logs\`
- macOS — `~/Library/Logs/SmoothScroll/`

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

| Path | Purpose |
|------|---------|
| `crates/core/` | Scroll engine, easing math, settings model. Pure Rust, OS-agnostic, fully unit-tested. |
| `crates/platform/` | OS-specific implementations behind traits — Windows hook, macOS event tap, wheel emitters, process queries. |
| `src-tauri/` | Tauri 2 host — composition root, IPC commands, tray, hotkey wiring, lifecycle. |
| `src/` | React + TypeScript settings UI. |
| `docs/` | Specs, design notes, migration plans. |

## Build from source

**Prerequisites**

- Rust 1.78+ (pinned via `rust-toolchain.toml`)
- Node.js 20+ with npm/pnpm
- **Windows:** MSVC build tools, WebView2 runtime
- **macOS:** Xcode Command Line Tools — `xcode-select --install`

**Build**

```bash
git clone https://github.com/quangtruong2003/SmoothScroll
cd SmoothScroll

npm install
npm run tauri dev      # run with hot reload
npm run tauri build    # produce installers
```

**Outputs**

- Windows — `src-tauri/target/release/bundle/{nsis,msi}/`
- macOS — `src-tauri/target/release/bundle/{macos,dmg}/`

**Test**

```bash
cargo test --workspace
```

## Status

`v0.1.8` — feature-complete v1 on Windows and macOS. The macOS build is currently unsigned; signing and notarization are tracked in [docs/](docs/).

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

Issues and pull requests are welcome. For substantial changes, open an issue first to discuss the approach. Run `cargo fmt`, `cargo clippy -- -D warnings`, and `cargo test --workspace` before submitting.

## License

[MIT](LICENSE) © SmoothScroll contributors
