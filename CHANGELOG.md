# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-05-16

### Added (M8 — Hardening + Installer)

- Rolling daily logs with 7-day retention via `tracing-appender` — Windows at `%APPDATA%/SoftScrollNext/logs/`, macOS at `~/Library/Logs/SoftScrollNext/`
- `app_version` and `open_log_dir` Tauri commands + AboutSection UI
- Deterministic drop order for OS handles via Tauri-managed `OwnedHandles` state (no orphan processes on Exit)
- Pre-build kill-running-instance (`taskkill` / `pkill`) to avoid file locks
- NSIS installer (per-user, 3 languages: en/vi/zh) + WiX MSI bundle config
- DMG + .app bundle config (unsigned, minimum macOS 12.0)
- AboutSection with version, homepage link, and "Open log folder" button

### Added (M7 — macOS Port)

- macOS `MouseHook` via `CGEventTap` on a dedicated `CFRunLoop` thread
- macOS `WheelEmitter` via `CGEventCreateScrollWheelEvent2` + `CGEventPost`
- macOS `ProcessQuery` via `CGWindowList` + `NSWorkspace`
- macOS `Autostart` via `~/Library/LaunchAgents/com.softscroll.next.plist` + `launchctl`
- macOS `Hotkey` via Carbon `RegisterEventHotKey`
- First-run Accessibility permission gate with auto-detection polling
- Bundle config: minimum macOS 12, `NSAccessibilityUsageDescription` in `Info.plist`

### Known issues for 0.1.0

- Toggling "Global hotkey" requires a restart to take effect
- Tray menu localization picks up at launch, not at runtime

### Added (M6 — Hotkey + Autostart + i18n)

- Windows global hotkey Ctrl+Alt+S via `RegisterHotKey` on a dedicated message-pump thread
- HKCU\Run autostart with quoted exe path
- React i18next with three locales (en, vi, zh)
- Settings UI sections: Behavior (hotkey/autostart/start-minimized) + Language (picker)
- Window close button hides instead of exiting; tray Exit fully quits
- Tray menu labels localized at app launch; "Open Settings" menu item

### Added (M5 — App Exclusion List)

- Windows `ProcessQuery` impl (100ms TTL + HWND-change cache)
- `EnumWindows` walker for the picker dialog
- Tauri commands: `list_running_processes`, `add_excluded_app`, `remove_excluded_app`
- React UI: ExcludedAppsSection + AddAppDialog with picker + manual entry

### Added (M4 — Horizontal + Shift + Reverse)

- Native `WM_MOUSEHWHEEL` smoothing path
- Shift+wheel→horizontal conversion gated by `shift_key_horizontal`
- Reverse-wheel-direction toggle (applies to both axes)

### Added (M3 — Settings UI)

- Real `AppSettings::clamp` with full unit tests (12 tests)
- Tauri commands: `get_settings`, `save_settings`
- React + shadcn settings UI: enable header, scrolling section, appearance section, direction section
- Settings persistence at `%APPDATA%/SoftScrollNext/settings.json` (Windows)

### Added (M2 — Vertical Scroll Smooth, Windows)

- Real easing math (Linear, CubicOut, QuinticOut, ExponentialOut) with 9 unit tests
- Real `SmoothScrollEngine` with per-axis state, acceleration ramp, fractional accumulator
- Windows `WH_MOUSE_LL` hook on a dedicated message-pump thread
- Windows `SendInput`-based wheel emitter
- 60fps modifier sampler + 120fps engine thread
- `timeBeginPeriod(1)` RAII guard
- Tray icon with Enable toggle and Exit

## [0.1.0] — 2026-05-14

### Added

- **Milestone 1: Workspace Skeleton** — Initial project scaffold:
  - `tauri/Cargo.toml` workspace with three members: `crates/core`, `crates/platform`, `src-tauri`
  - `crates/core/` — pure scroll engine logic, settings model, easing math. OS-agnostic.
  - `crates/platform/` — OS-specific traits with `#[cfg(windows)]` and `#[cfg(target_os = "macos")]` gated stubs for M1
  - `src-tauri/` — Tauri 2 app binary (Windows + macOS)
  - `src/` — React 18 + TypeScript + Vite 6 + Tailwind CSS + shadcn/ui frontend skeleton
  - MSI and NSIS installers built successfully
