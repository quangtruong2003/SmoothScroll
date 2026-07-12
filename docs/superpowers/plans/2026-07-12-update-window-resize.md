# Update Window Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resize the Tauri main window to 350x280 during update, restore to 800x600 after.

**Architecture:** Add two Rust commands (`resize_for_update`, `restore_window_size`), invoke them from React on boot state changes, and adjust ForcedUpdateModal CSS for the smaller viewport.

**Tech Stack:** Rust (Tauri v2), React, TypeScript

## Global Constraints

- Window update size: 350x280 physical pixels, fixed (not resizable)
- Window normal size: 800x600 physical pixels, resizable
- Re-center window after every resize

---

### Task 1: Add Rust resize commands

**Files:**
- Modify: `src-tauri/src/commands.rs:415` (after `show_main_window`)

**Interfaces:**
- Produces: `resize_for_update(app)` and `restore_window_size(app)` — Tauri commands callable via `invoke()` from JS

- [ ] **Step 1: Add `resize_for_update` command**

Open `src-tauri/src/commands.rs`. After the `show_main_window` function (line ~415), add:

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
```

- [ ] **Step 2: Add `restore_window_size` command**

Immediately after, add:

```rust
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

- [ ] **Step 3: Register commands in main.rs**

Open `src-tauri/src/main.rs`. Find the `.invoke_handler(tauri::generate_handler![...])` block. Add `resize_for_update` and `restore_window_size` to the list.

- [ ] **Step 4: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/main.rs
git commit -m "feat: add resize_for_update and restore_window_size commands"
```

---

### Task 2: Call resize commands from React

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `resize_for_update` and `restore_window_size` via `invoke()`
- Produces: Window resizes at correct boot state transitions

- [ ] **Step 1: Add import**

In `src/App.tsx`, add at the top with other imports:

```typescript
import { invoke } from "@tauri-apps/api/core";
```

- [ ] **Step 2: Add useEffect to resize on update detection**

In `AppContent`, add a `useEffect` that fires when `bootState.kind` changes to `"update-required"`. Place it before the `switch` statement:

```typescript
// Resize window for update modal
useEffect(() => {
  if (state.kind === "update-required") {
    void invoke("resize_for_update");
  }
}, [state.kind]);
```

Note: `AppContent` is currently a plain function, not a hook-using component with effects. You'll need to convert the resize logic to work inside the render flow. The simplest approach: add the effect in the parent `App` component instead, since it already has hooks:

```typescript
// In App() component, after existing useEffects:
useEffect(() => {
  if (state.kind === "update-required") {
    void invoke("resize_for_update");
  }
}, [state.kind]);
```

- [ ] **Step 3: Restore window on skip**

In `App.tsx`, find the `onSkip` handler passed to `ForcedUpdateModal` (line ~124). Wrap it to also restore window:

```typescript
onSkip={() => {
  void invoke("restore_window_size");
  dispatch({ type: "UPDATE_SKIPPED" });
}}
```

- [ ] **Step 4: Restore window on update completion**

The `ForcedUpdateModal` calls `restartApp()` after successful install — the app relaunches entirely, so the window resets naturally. No explicit restore needed for the success path. But add a restore in the error case inside `ForcedUpdateModal.tsx` (Task 3).

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: resize window for update, restore on skip"
```

---

### Task 3: Adjust ForcedUpdateModal UI for smaller window

**Files:**
- Modify: `src/components/ForcedUpdateModal.tsx`

**Interfaces:**
- Consumes: `restore_window_size` via `invoke()` (for error recovery)
- Produces: Compact UI that fits in 350x280

- [ ] **Step 1: Add import**

In `src/components/ForcedUpdateModal.tsx`, add:

```typescript
import { invoke } from "@tauri-apps/api/core";
```

- [ ] **Step 2: Restore window on error state**

In the `onInstall` function, in the outer `catch` block (line ~44), add a restore call before setting error state:

```typescript
} catch (e) {
  void invoke("restore_window_size");
  setState({ kind: "error", message: String(e) });
}
```

- [ ] **Step 3: Adjust outer container CSS**

Change the outer `div` className from:
```
className="flex h-screen w-screen flex-col justify-between gap-6 bg-background p-8"
```
to:
```
className="flex h-screen w-screen flex-col justify-between gap-3 bg-background p-3"
```

- [ ] **Step 4: Remove max-w-md constraints**

Change the content wrapper from:
```
className="mx-auto flex w-full max-w-md flex-1 flex-col space-y-4"
```
to:
```
className="flex w-full flex-1 flex-col space-y-2"
```

Change the buttons wrapper from:
```
className="mx-auto w-full max-w-md space-y-2"
```
to:
```
className="w-full space-y-1.5"
```

- [ ] **Step 5: Reduce release notes max height**

Change `max-h-40` to `max-h-24` on the release notes container to fit smaller window:
```
className="max-h-24 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap font-mono leading-relaxed"
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ForcedUpdateModal.tsx
git commit -m "feat: adjust ForcedUpdateModal layout for 350x280 window"
```

---

### Task 4: Build and manual test

**Files:**
- None (verification only)

- [ ] **Step 1: Build the app**

Run: `pnpm tauri build`
Expected: Build succeeds, exe path printed.

- [ ] **Step 2: Test update flow manually**

1. Launch the built exe
2. If an update is available, verify:
   - Window resizes to ~350x280
   - Window is centered on screen
   - Window is not resizable
   - All UI elements are visible and not clipped
   - Progress bar works during download
   - Skip button works (if trusted device)
3. After skip or update completion, verify:
   - Window restores to 800x600
   - Window is resizable again

- [ ] **Step 3: Final commit if fixes needed**

If any UI tweaks were needed during manual testing, commit them.
