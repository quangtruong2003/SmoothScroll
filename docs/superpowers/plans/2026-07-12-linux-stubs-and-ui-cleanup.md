# S3+S4 Linux Stubs + UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Document Linux Wayland stub acceptance criteria (B2/B3/B4), remove dead React UI files (C1/C2), document orphan component (C3), and rename misnamed section (C4).

**Architecture:** Linux Wayland stubs get doc comments defining what implementer needs (same pattern as S2 macOS). Dead code files confirmed with zero imports.

**Tech Stack:** Rust (crates/platform target Linux Wayland), TypeScript/React (src/).

## Global Constraints
- No behavior changes; documentation only (S3) + dead code removal (S4).
- S3 stubs: same doc pattern as macOS S2 stubs.

---

### Task S3: Document Linux Wayland stubs (B2/B3/B4)

**Files:**
- Modify: `crates/platform/src/linux/wayland/hotkey.rs`
- Modify: `crates/platform/src/linux/wayland/fullscreen.rs`
- Modify: `crates/platform/src/linux/wayland/process_query.rs`

- [ ] **Step 1: Document hotkey.rs stub**

Add doc comment to the `Ok(false)` return in `WaylandHotkey::register()`:
```rust
    // Stub: Wayland does not provide a standard global shortcut protocol.
    // Future implementer must use the xdg-desktop-portal GlobalShortcuts interface
    // via D-Bus (org.freedesktop.portal.GlobalShortcuts). If unavailable, log warning.
```

- [ ] **Step 2: Document fullscreen.rs stub**

Add doc comment to `is_foreground_fullscreen()`:
```rust
    // Stub: future implementer must query the compositor for the focused window's geometry
    // and compare with the screen bounds. Protocol varies by compositor:
    // - KDE: D-Bus org.kde.KWin or _NET_WM_STATE_FULLSCREEN
    // - GNOME: org.gnome.Shell introspection
    // - wlroots compositors: wlr-foreign-toplevel-management protocol
```

- [ ] **Step 3: Document process_query.rs stubs**

Add doc comments to `process_name_under_cursor()` and `foreground_process_id()`:
```rust
    // Stub: process_name_under_cursor - future implementer must query compositor
    // for the window under cursor coordinates and resolve its pid.
    // - KDE: D-Bus org.kde.KWin for focused window pid
    // - GNOME: org.gnome.Shell introspection for window under pointer
    // Note: foreground_process_id already works on KDE via qdbus; returns None on GNOME.
```

- [ ] **Step 4: Commit**

```bash
git add crates/platform/src/linux/wayland/hotkey.rs crates/platform/src/linux/wayland/fullscreen.rs crates/platform/src/linux/wayland/process_query.rs
git commit -m "docs(platform): add Linux Wayland stub acceptance criteria"
```

---

### Task S4: UI cleanup — remove dead code (C1/C2), document orphan (C3), rename section (C4)

**Files:**
- Delete: `src/lib/settings.ts` (C1, zero imports)
- Delete: `src/lib/i18n.ts` (C2, zero imports)
- Modify: `src/components/settings/AddAppDialog.tsx` (C3, add orphan doc comment)
- Modify: `src/components/settings/ExcludedAppsSection.tsx` (C4, rename section title)

- [ ] **Step 1: Delete settings.ts**

```bash
rm src/lib/settings.ts
```

- [ ] **Step 2: Delete i18n.ts**

```bash
rm src/lib/i18n.ts
```

- [ ] **Step 3: Document orphan AddAppDialog**

Add top-of-file doc comment to `src/components/settings/AddAppDialog.tsx`:
```typescript
/**
 * @deprecated Orphan component — not currently imported by any parent component.
 * Previously used in ExcludedAppsSection but superseded by AppProfileAssignDialog.
 * Remove or wire into the App Profiles flow when ready.
 */
```

- [ ] **Step 4: Rename section title in ExcludedAppsSection**

Read `src/components/settings/ExcludedAppsSection.tsx` and find the section title string.
Rename it from the i18n key `section.excluded_apps` to `section.app_profiles` (or change the visible label to "App Profiles"). Verify the i18n key exists in `src/i18n/locales/en.json`.

- [ ] **Step 5: Build check**

Run: `pnpm build` (or `tsc --noEmit` at minimum) to verify deleted files break nothing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts src/lib/i18n.ts src/components/settings/AddAppDialog.tsx src/components/settings/ExcludedAppsSection.tsx
git commit -m "chore: remove dead UI files and document orphan components"
```
