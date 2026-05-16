# Soft Scroll Next

Cross-platform smooth scrolling utility for Windows + macOS. Rust + Tauri 2 + React rewrite of the Windows-only C# WPF original (which still lives at the parent directory until the rewrite is fully retired).

## Install

### Windows

Download `Soft Scroll Next_<version>_x64-setup.exe` (NSIS) or the `.msi` from the Releases page and run it. Per-user install — no admin needed.

### macOS

Download `Soft Scroll Next_<version>_aarch64.dmg`, mount it, drag the app into `/Applications`. The first launch is blocked by Gatekeeper because the app isn't signed yet:

1. Right-click `Soft Scroll Next.app` → **Open**
2. Confirm in the dialog
3. The app will then prompt for **Accessibility** access. Open System Settings → Privacy & Security → Accessibility and toggle Soft Scroll Next on.
4. The app polls and resumes automatically once granted.

## Usage

- The app installs a low-level mouse hook (Windows) / event tap (macOS), swallows native wheel events, and re-emits them as smoothed pulses.
- Tray icon: left-click opens settings, right-click shows menu (Enable, Open Settings, Exit).
- Default hotkey **Ctrl+Alt+S** toggles smooth scrolling on/off.
- Per-app exclusion list lets you opt specific apps out of smoothing.
- Settings persist at `%APPDATA%/SoftScrollNext/settings.json` (Windows) or `~/Library/Application Support/SoftScrollNext/settings.json` (macOS).
- Logs at `%APPDATA%/SoftScrollNext/logs/` (Windows) or `~/Library/Logs/SoftScrollNext/` (macOS), rotated daily, kept 7 days.

## Build from source

Prerequisites:
- Rust 1.78+ (managed via `rust-toolchain.toml`)
- Node.js 20+
- **Windows**: WebView2 runtime (preinstalled on Win11), MSVC build tools
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)

```bash
cd tauri
npm install
cargo tauri dev          # development
cargo tauri build        # produce installers
```

Outputs:

- Windows: `tauri/src-tauri/target/release/bundle/{nsis,msi}/`
- macOS: `tauri/src-tauri/target/release/bundle/{macos,dmg}/`

## Layout

| Path | Purpose |
|------|---------|
| `crates/core/` | Pure scroll-engine logic, settings, easing math. No OS deps. Unit-tested. |
| `crates/platform/` | OS-specific implementations behind traits — Windows + macOS. |
| `src-tauri/` | Tauri 2 app. Composition root, IPC commands, tray, hotkey wiring. |
| `src/` | React + TypeScript frontend (settings UI). |
| `docs/` | Specs and migration plans (at repo root, alongside the C# project). |

## Status

v0.1.0 — feature-complete v1 on Windows and macOS. The C# original at the parent directory is preserved until v0.1.0 sees real-world use; once stable, the C# code will be removed.

## License

MIT
