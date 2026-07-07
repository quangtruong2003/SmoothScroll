# Tray Panel Simplify Design

**Date**: 2026-07-07
**Status**: Approved
**Goal**: Simplify Windows tray panel UI while maintaining high UX/UI quality

## Current State

Windows tray panel has complex structure with section labels, multiple action items, and dropdown-based CurrentAppCard.

## Target State

```
┌─────────────────────────────┐
│ ● SmoothScroll    ON        │  ← Header
├─────────────────────────────┤
│ 📱 Chrome            [●]    │  ← CurrentAppCard (per-app toggle)
├─────────────────────────────┤
│ Smooth Scrolling     [●]    │  ← Global toggle
│ Start with Windows   [●]    │  ← Toggle
├─────────────────────────────┤
│ ⚙ Open Settings             │  ← Action
│ ⚠ Quit SmoothScroll         │  ← Destructive
└─────────────────────────────┘
```

## Changes

### Removed
- Section labels ("QUICK ACCESS", "ACTIONS")
- Start minimized toggle
- Excluded Apps action
- Open Log File action
- Footer with version number

### Modified
- **CurrentAppCard**: Simplified from dropdown to single-row with per-app scroll toggle
  - Before: App name + category + profile dropdown
  - After: App icon + name + toggle on/off

### Kept
- Header (status dot + title + ON/OFF)
- Smooth Scrolling global toggle
- Start with Windows toggle
- Open Settings action
- Quit SmoothScroll (destructive)
- Visual style (semi-transparent background, blur, rounded corners)

## Interactions

### Toggles
- **Smooth Scrolling** (global): Updates `settings.enabled`
- **Start with Windows**: Updates `settings.start_with_windows`
- **Per-app toggle**: Enables/disables scroll for specific app

### Actions
- **Open Settings**: Opens main settings window → closes tray panel
- **Quit**: Shows confirmation → quits app

### Panel Behavior
- Auto-resize based on content height
- Click outside → closes panel (existing)
- Positioned near cursor, anchored to taskbar (existing)

## Components

### TrayPanel.tsx
- Remove `SectionLabel` component usage
- Remove `MenuItem` for: Start minimized, Excluded Apps, Open Log File
- Remove footer section
- Keep header, CurrentAppCard, 2 toggles, 2 actions

### CurrentAppCard.tsx
- Remove category display
- Remove profile dropdown
- Add per-app scroll toggle
- Single row layout: icon + name + toggle

### index.css
- Remove section label styles (if no longer used elsewhere)
- Keep all other tray panel styles unchanged

## IPC Commands

### Existing (reuse)
- `get_foreground_app_context` - Get current foreground app info
- `settings-changed` - Listen for settings updates

### New (if needed)
- `toggle_app_scroll` - Enable/disable scroll for specific app
  - Input: `{ app_name: string, enabled: boolean }`
  - Output: `void`

## i18n Keys

### Reuse existing
- `tray.title` - "SmoothScroll"
- `tray.on` / `tray.off` - Status text
- `tray.current_app.category.*` - Category labels (if kept in future)
- `tray.quick_access.smooth_scrolling` - "Smooth Scrolling"
- `tray.quick_access.start_with_os` - "Start with Windows"
- `tray.actions.open_settings` - "Open Settings"
- `tray.actions.quit` - "Quit SmoothScroll"

### Remove
- `tray.quick_access.start_minimized` - "Start minimized"
- `tray.actions.excluded_apps` - "Excluded Apps"
- `tray.actions.open_log` - "Open Log File"
- `tray.footer.version` - Version text

## Files to Modify

1. `src/components/TrayPanel.tsx` - Remove items, simplify structure
2. `src/components/tray/CurrentAppCard.tsx` - Simplify to toggle
3. `src/index.css` - Clean up unused styles (if applicable)
4. `src-tauri/src/commands.rs` - Add toggle_app_scroll command (if needed)
5. `src/stores/settingsStore.ts` - Add per-app scroll state (if needed)

## Verification

- [ ] Panel renders with correct items
- [ ] All toggles work (global, per-app, start with windows)
- [ ] Open Settings opens main window
- [ ] Quit shows confirmation and exits
- [ ] Panel auto-resizes correctly
- [ ] Visual style matches current Windows style
- [ ] No regressions on macOS/Linux (if applicable)
