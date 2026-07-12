# Design: Update Window Resize

**Date:** 2026-07-12  
**Status:** Draft  
**Author:** Claude (brainstorming session)

---

## Problem

The current `ForcedUpdateModal` occupies the entire main window (800x600), but the actual content only needs ~448px width. This makes the update window feel disproportionately large for a simple progress/status UI.

## Solution

Resize the Tauri main window to 350x280 when an update is detected, then restore to 800x600 after update completes or is skipped.

---

## Architecture

### 1. Rust Commands (src-tauri/src/commands.rs)

Add two new Tauri commands:

```rust
#[tauri::command]
pub fn resize_for_update<R: tauri::Runtime>(app: AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: 350,
            height: 280,
        }));
        let _ = win.set_resizable(false);
        let _ = win.center();
    }
}

#[tauri::command]
pub fn restore_window_size<R: tauri::Runtime>(app: AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: 800,
            height: 600,
        }));
        let _ = win.set_resizable(true);
        let _ = win.center();
    }
}
```

**Key decisions:**
- Use `PhysicalSize` for consistency across DPI settings
- `set_resizable(false)` locks the window during update
- `center()` re-centers after resize for clean UX

### 2. React Integration (src/App.tsx)

```tsx
import { invoke } from "@tauri-apps/api/core";

// In AppContent component:
useEffect(() => {
  if (bootState.kind === "update-required") {
    invoke("resize_for_update");
  }
}, [bootState.kind]);

// Update complete handler:
const handleUpdateComplete = () => {
  invoke("restore_window_size");
  // ... existing logic
};

// Skip update handler:
const handleSkipUpdate = () => {
  invoke("restore_window_size");
  dispatch({ type: "UPDATE_SKIPPED" });
};
```

**Flow:**
1. App starts → window 800x600 (hidden)
2. Update detected → `resize_for_update()` → window 350x280
3. User updates → download/install → `restore_window_size()` → window 800x600
4. Or skip → `restore_window_size()` → window 800x600

### 3. UI Adjustments (src/components/ForcedUpdateModal.tsx)

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="forced-update-title"
  className="flex h-screen w-screen flex-col justify-between gap-4 bg-background p-4"
>
  <div className="flex flex-1 flex-col space-y-3">
    {/* Content - remove max-w-md constraint */}
  </div>
  
  <div className="space-y-2">
    {/* Buttons - full width */}
  </div>
</div>
```

**Changes:**
- Reduce padding: `p-8` → `p-4`
- Reduce gap: `gap-6` → `gap-4`
- Remove `max-w-md` and `mx-auto` (window is already small enough)
- Reduce spacing as needed for compact layout

---

## Success Criteria

- [ ] Window resizes to 350x280 when update is detected
- [ ] Window is not resizable during update mode
- [ ] Window centers on screen after resize
- [ ] Window restores to 800x600 after update completes
- [ ] Window restores to 800x600 when update is skipped
- [ ] All existing update functionality works (progress bar, download, install, restart)
- [ ] UI elements fit comfortably in 350x280 without overflow

---

## Files to Modify

1. `src-tauri/src/commands.rs` - Add resize commands
2. `src/App.tsx` - Call resize/restore commands
3. `src/components/ForcedUpdateModal.tsx` - Adjust padding/spacing

---

## Out of Scope

- Resizing the tray panel window
- Changing the update check logic
- Modifying the Settings page update UI
