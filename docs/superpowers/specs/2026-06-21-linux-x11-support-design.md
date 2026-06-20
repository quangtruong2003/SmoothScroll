# Design: Linux X11 Support for SmoothScroll

**Issue:** [#2 — on linux support](https://github.com/quangtruong2003/SmoothScroll/issues/2)
**Date:** 2026-06-21
**Status:** Approved

## Problem

SmoothScroll currently only supports Windows and macOS. Linux users see `PlatformError::Unsupported` on startup. The `smoothscroll_platform` crate has no Linux implementations for any of its 11 platform traits.

## Approach

Add X11-only Linux support by implementing all platform traits behind `#[cfg(target_os = "linux")]`. Use X11 libraries (XInput2, XTest, EWMH atoms) for input hooking, scroll injection, and window querying. Wayland sessions are detected and shown a "not yet supported" message.

## Architecture

### Module Structure

```
crates/platform/src/
├── lib.rs                      ← Add #[cfg(target_os = "linux")] branch
├── linux/
│   ├── mod.rs                  ← `pub fn build() -> Result<Platform>`
│   ├── mouse_hook.rs           ← XInput2 raw button events
│   ├── wheel_emitter.rs        ← XTest fake button events
│   ├── process_query.rs        ← EWMH atoms + /proc
│   ├── hotkey.rs               ← XGrabKey on root window
│   ├── keyboard.rs             ← XQueryKeymap polling
│   ├── fullscreen.rs           ← _NET_WM_STATE_FULLSCREEN atom
│   ├── window_geom.rs          ← XQueryPointer + XGetWindowAttributes
│   ├── autostart.rs            ← XDG ~/.config/autostart/*.desktop
│   ├── accessibility.rs        ← Stub (return false)
│   ├── timer.rs                ← No-op (Linux timers already precise)
│   └── text_input_detector.rs  ← Stub (return false)
```

### Dependencies

**Cargo.toml (crates/platform/):**
```toml
[target.'cfg(target_os = "linux")'.dependencies]
x11 = { version = "2.21", features = ["xinput", "xtest"] }
libc = "0.2"
```

**System packages (Ubuntu/Debian):**
```
libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
libx11-dev libxi-dev libxtst-dev libssl-dev
```

## Component Details

### 1. MouseHook — XInput2 (Complex)

- Open X11 display connection
- Query XI opcode via `XIQueryVersion`
- Select `XI_RawButtonPress` / `XI_RawButtonRelease` on root window
- Event loop: `XPending` → `XNextEvent` → filter button 4/5 (scroll wheel)
- Emit via `HookEventSink::on_wheel` / `on_hwheel`
- **Limitation:** XInput2 can observe but not swallow events. Use pointer grab to prevent original scroll from reaching target app while smooth scroll is active.

### 2. WheelEmitter — XTest (Complex)

- Use `XTestFakeButtonEvent` to inject synthetic scroll:
  - Button 4 = scroll up, Button 5 = scroll down
  - Shift + Button 4/5 = horizontal scroll
  - Ctrl + Button 4/5 = zoom
- Pulse-based: press then release for each scroll unit

### 3. ProcessQuery — EWMH + /proc (Complex)

- `XQueryPointer` → window under cursor
- Walk window tree upward looking for `_NET_WM_PID` atom → get PID
- Read `/proc/<pid>/comm` for process name
- `_NET_ACTIVE_WINDOW` for foreground window detection
- **No UIPI equivalent:** No integrity level concept on Linux

### 4. Hotkey — XGrabKey (Medium)

- `XKeysymToKeycode` to convert key symbols
- `XGrabKey` on root window with modifier masks (Ctrl, Alt, Shift)
- Event loop listening for `KeyPress` events on grabbed keys
- **Known issue:** Race conditions with other apps grabbing same key

### 5. Keyboard — XQueryKeymap (Simple)

- Background thread polls at 60Hz (same as Windows)
- `XQueryKeymap` returns 32-byte array, each bit = keycode state
- Map keycodes: 50=Shift_L, 37=Control_L, 64=Alt_L

### 6. Fullscreen — _NET_WM_STATE (Simple)

- Get `_NET_ACTIVE_WINDOW` from root
- Read `_NET_WM_STATE` property
- Check if `_NET_WM_STATE_FULLSCREEN` atom is present

### 7. WindowGeometry — XQueryPointer (Simple)

- `XQueryPointer` returns cursor position relative to window
- `XGetWindowAttributes` for window dimensions

### 8. Autostart — XDG (Simple)

- Enable: Write `.desktop` file to `~/.config/autostart/smoothscroll.desktop`
- Disable: Delete the file
- Status: Check if file exists

### 9. Accessibility, Timer, TextInputDetector — Stubs

- `AccessibilitySignals::reduce_motion()` → always `false`
- `HighResTimerGuard` → no-op (Linux `clock_nanosleep` is already ~1ms precise)
- `TextInputDetector::is_focused_text_input()` → always `false`

## Wayland Handling

Detect Wayland via environment variables and show a dialog:

```rust
let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
if session_type == "wayland" {
    // Dialog: "SmoothScroll requires X11. Please log out and select
    // 'GNOME on Xorg' (or equivalent) before launching."
}
```

## Build Configuration

**tauri.conf.json updates:**
```json
{
  "bundle": {
    "targets": ["nsis", "msi", "app", "dmg", "deb", "appimage"],
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0",
          "libayatana-appindicator3-1",
          "libx11-6", "libxi6", "libxtst6"
        ]
      }
    }
  }
}
```

**GitHub Actions:** Add `build-linux` job on `ubuntu-22.04` runner with system deps installed before `cargo tauri build`.

**build.rs:** Add `#[cfg(target_os = "linux")]` block using `pkill -x smoothscroll-app`.

## Frontend Changes

- `BehaviorSection.tsx`: Hide "Auto-disable Windows apps with native smooth scrolling" toggle on Linux (no Windows apps exist)
- `TrayPanel.tsx`: Change `t('tray.start_with_windows')` label to platform-agnostic "Start with system" on Linux
- `commands.rs`: `open_path()` use `xdg-open` on Linux instead of `explorer.exe`

## Testing Strategy

1. **GitHub Actions CI/CD:** Build verification on Ubuntu 22.04, unit tests
2. **WSL:** Build `.deb`/`.AppImage` on Windows via WSL2
3. **Community testing:** Request testers via Issue #2 reply
4. **Virtual machine:** User sets up Linux VM for manual testing

## Known Limitations

1. X11-only — Wayland not supported
2. No UIPI / integrity level check
3. TextInputDetector stubbed (always returns `false`)
4. GNOME system tray may require `gnome-shell-extension-appindicator`
5. Mouse hook cannot swallow events natively — uses pointer grab workaround

## Out of Scope

- Wayland native support (future phase)
- TextInputDetector full implementation
- Per-distro packaging (rpm, snap, flatpak)
