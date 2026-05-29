# Shift+Scroll Horizontal Fix Design

**Date:** 2026-05-29
**Status:** Draft
**Author:** Claude

## Problem Statement

When SmoothScroll is active and user holds Shift + scrolls wheel in apps like Excel, Pencil, or design tools, the horizontal scrolling does NOT work:
- IDEs (VSCode, JetBrains): Work fine
- Excel, Word, Pencil, design tools: Shift+Scroll does nothing or scrolls vertically

**Root cause:** SmoothScroll intercepts WM_MOUSEWHEEL, converts to horizontal via `on_hwheel_with_source()`, then emits `MOUSEEVENTF_HWHEEL` via `SendInput`. However, some apps (Excel, Pencil, design tools) don't recognize/process `MOUSEEVENTF_HWHEEL` from `SendInput` - they expect native `WM_MOUSEWHEEL` message with `MK_SHIFT` flag.

## Design: Hybrid Approach

### Strategy

Split shift+wheel handling into two paths:

| Input | Method | Result |
|-------|--------|--------|
| Shift+Wheel | PostMessage to target window with WM_MOUSEWHEEL + MK_SHIFT | Native horizontal scroll (no smooth) |
| Native HWHEEL (tilt wheel) | SendInput with MOUSEEVENTF_HWHEEL | Smooth horizontal scroll |

### Benefits
1. **Works in all apps** - Shift+Scroll uses native Windows mechanism
2. **Maintains smooth for tilt wheels** - Native horizontal wheels still get smooth scrolling
3. **User choice** - Settings to control behavior
4. **Backward compatible** - IDEs continue to work as before

### Implementation

#### 1. New Tauri Command: `post_wheel_message`

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub fn post_wheel_message(
    window: Window,
    delta: i32,
    horizontal: bool,
) -> Result<(), String> {
    // Get mouse position
    // Get foreground window or window under cursor
    // Post WM_MOUSEWHEEL with MK_SHIFT for horizontal, or WM_MOUSEWHEEL for vertical
}
```

#### 2. Modify EngineSink to use PostMessage for shift+wheel

```rust
// src-tauri/src/hook_wiring.rs

fn route_vertical_with_source(...) {
    // ... existing code ...
    
    if mods.shift && eff.shift_key_horizontal {
        // Use PostMessage instead of engine for shift+wheel
        // This bypasses smooth scrolling but ensures compatibility
        if let Some(pos) = get_mouse_position() {
            let flags = if eff.shift_horizontal_invert {
                -delta as u16
            } else {
                delta as u16
            };
            post_wheel_with_shift(pos.x, pos.y, flags)?;
        }
        return HookDecision::Pass; // Don't swallow, let app also handle if it wants
    }
}
```

#### 3. Settings (optional)

Add to settings:
```json
{
  "shift_wheel_behavior": "post_message" | "smooth" | "auto"
}
```

- `post_message` (default): Native horizontal scroll for shift+wheel
- `smooth`: Use smooth engine for shift+wheel (current behavior)
- `auto`: Try smooth, fall back to PostMessage on failure

#### 4. Windows PostMessage Implementation

```rust
// crates/platform/src/windows/post_message_emitter.rs (new file)

pub fn post_wheel_with_shift(x: i32, y: i32, delta: u16) -> Result<()> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;
    
    // Find window under cursor
    let hwnd = WindowFromPoint(POINT { x, y });
    if hwnd.is_null() {
        return Err("No window at cursor");
    }
    
    // Get lParam for mouse position
    let lparam = ((y as u32) << 16) | (x as u32 & 0xFFFF);
    
    // Post WM_MOUSEWHEEL with MK_SHIFT
    let wparam = ((delta as usize) << 16) as usize | (MK_SHIFT as usize);
    
    unsafe {
        PostMessageW(hwnd, WM_MOUSEWHEEL, wparam, lparam);
    }
    Ok(())
}
```

## Component Changes

| File | Change |
|------|--------|
| `crates/platform/src/windows/mod.rs` | Add `post_wheel_emitter` module |
| `crates/platform/src/traits.rs` | Add `PostMessageEmitter` trait |
| `src-tauri/src/hook_wiring.rs` | Modify `route_vertical_with_source` for shift+wheel |
| `src-tauri/src/commands.rs` | Add `post_wheel_message` command |
| `src/lib/tauri.ts` | Add `postWheelMessage` wrapper |
| `src/i18n/locales/en.json` | Add shift wheel behavior settings strings |

## Data Flow

```
User presses Shift + scrolls wheel
         │
         ▼
Windows sends WM_MOUSEWHEEL to hook
         │
         ▼
hook calls sink.on_wheel_ext(delta, mods)
         │
         ▼
EngineSink.route_vertical_with_source()
         │
         ├──► mods.shift && shift_key_horizontal?
         │         │
         │         ▼
         │    PostMessage with MK_SHIFT to target window
         │         │
         │         ▼
         │    App receives WM_MOUSEWHEEL + MK_SHIFT
         │         │
         │         ▼
         │    Native horizontal scroll (no smooth)
         │
         ▼
    mods.shift == false
         │
         ▼
    Normal vertical smooth scroll
```

## Testing Plan

1. **Unit tests**: Verify PostMessage path works correctly
2. **Manual tests**:
   - Excel + Shift+Scroll → Should scroll horizontally
   - Pencil + Shift+Scroll → Should scroll horizontally
   - IDEs + Shift+Scroll → Should still work (verify no regression)
   - Native HWHEEL (tilt wheel) → Should still be smooth

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PostMessage may not reach nested windows | Use `SendMessageTimeout` with timeout |
| App already scrolled before PostMessage | Pass through (don't swallow) |
| Double scroll if app also handles | Don't swallow the original event |
| Performance impact | PostMessage is async, no blocking |
