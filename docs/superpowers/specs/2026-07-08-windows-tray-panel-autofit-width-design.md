# Windows Tray Panel Auto-fit Width Design

**Date**: 2026-07-08
**Status**: Approved
**Goal**: Make Windows tray panel width auto-fit label content (no ellipsis, no wasted space).

## Problem

Current Windows tray panel renders inside a fixed-width window (`width: 220` in `tauri.conf.json`). Menu item labels get truncated with ellipsis when text is longer than the panel allows. Users see `Auto-detect s...` instead of `Auto-detect scroll direction`.

Verified via Read of `src/components/TrayPanel.tsx`, `src-tauri/src/tray.rs`, `src/index.css`, `src-tauri/tauri.conf.json` on 2026-07-08.

## Current Behavior

| Platform | Width | Ellipsis on overflow |
|----------|-------|----------------------|
| Windows  | 220px fixed (window) | Yes, labels truncated |
| macOS    | 264px fixed (CSS `.tray-panel-root`) | Yes (intentional, matches NSMenu) |
| Linux    | 268px fixed (CSS `.tray-panel-root`) | Yes (intentional, matches Adwaita) |

Resize plumbing already exists: `TrayPanel.tsx` observes `rootRef` via `ResizeObserver` and invokes `resize_tray_panel` Rust command (`src-tauri/src/tray.rs:157`). Rust clamps to `min_w = 200`, `max_w = 400`.

## Target Behavior

| Platform | Width |
|----------|-------|
| Windows  | Auto-fit content (min 200, max 480, no ellipsis) |
| macOS    | 264px fixed (unchanged) |
| Linux    | 268px fixed (unchanged) |

Mechanism: panel root uses `inline-flex` so it shrink-wraps to content. Existing `ResizeObserver` reports the actual content width to Rust, which clamps to `[200, 480]`.

## Design Decisions

### Why inline-flex on root, not observe body.scrollWidth

First-pass design proposed measuring `body.scrollWidth`. Verified to be **wrong on webview** — `scrollWidth` is bounded by viewport width (window width), not by content. Even if root grows to 400px, `body.scrollWidth` stays at the viewport size.

`ResizeObserver` on the root element with `inline-flex` works correctly because `contentRect.width` returns the natural shrink-wrap width of the inline-flex container.

### Why bump max_w from 400 to 480

Real longest menu label is `Auto-detect scroll direction` (~230px at 0.84rem Segoe UI). Bumping to 480 leaves headroom for locales that produce longer text (e.g. German `Scrollrichtung automatisch erkennen`) without needing a second PR for this.

### Why not remove the explicit width on macOS/Linux

`macOS`/`linux` blocks (`body[data-platform="mac"] .tray-panel-root { width: 264px }` etc.) define the platform's intentional width and stay. Only `body[data-platform="win"]` is touched.

## Changes

### `src/index.css`

Add one new block under the existing `body[data-platform="win"]` section (around line 686, near the existing `.menu-item` overrides):

```css
/* Windows: shrink-wrap root to label content (no ellipsis). */
body[data-platform="win"] .tray-panel-flex {
  display: inline-flex;  /* override `display: flex` from `.tray-panel-flex` */
  width: auto;            /* override `width: 100%` from `.tray-panel-flex` */
}
body[data-platform="win"] .tray-row-label {
  overflow: visible;
  text-overflow: clip;
}
```

Why both lines:

- `inline-flex` makes the panel shrink-wrap horizontally, so `ResizeObserver` sees the natural content width.
- Removing the explicit ellipsis on `.tray-row-label` is necessary because the `1fr` grid column still constrains the label to the cell width. With the panel now sized to fit, the constraint relaxes but we still need `overflow: visible` so labels don't truncate inside the cell.
- `white-space: nowrap` on `.tray-row-label` is kept so labels stay on one line.

### `src-tauri/src/tray.rs`

In `resize_panel` (line 189-191), change `max_w`:

```diff
-    let max_w = 400u32;
+    let max_w = 480u32;
     let clamped_width = width.clamp(min_w, max_w);
```

Only `max_w` changes. `min_w = 200` stays. Height clamp (`min_h = 120`, `max_h = work_area.height - 40`) is unchanged.

### `src/components/TrayPanel.tsx`

**No change.** The existing `ResizeObserver` on `rootRef` already reports `entry.contentRect.width` (line 116-120). Once CSS makes root an `inline-flex`, the reported width is the natural content width, so the existing `sync()` flow handles resize correctly.

## Render Sequence (after change)

1. User clicks tray icon → `show_tray_panel` positions window at cursor (Rust 220×600 initial).
2. Webview loads `/tray` → `<TrayPanel />` mounts.
3. `ResizeObserver` fires once during mount → reports `entry.contentRect.width` (= natural content width after CSS shrink-wrap).
4. TrayPanel invokes `resize_tray_panel` with that width (in physical px via `devicePixelRatio`).
5. Rust clamps to `[200, 480]`, calls `win.set_size(...)`, repositions panel to keep bottom edge pinned to taskbar (existing `position_panel_at_cursor` logic).
6. Hover state changes (`tray-row-label` may transition from abbreviated to full locale text) → observer fires → resize re-issues automatically.

## Edge Cases

### Text longer than 480px (e.g. locale paste-bomb)

Root `inline-flex` would grow past 480px; Rust clamps to `max_w = 480`. With `overflow: hidden` still on `.tray-panel-flex` *as a whole panel* (we did not remove this), content beyond 480px is clipped. Adding `overflow: visible` on `.tray-row-label` does not break this — the panel root still has its outer overflow, and Rust pins the window at 480. Acceptable safety net for absurd inputs.

### Locale change at runtime (`i18n.switchLanguage`)

React re-renders with new strings → label widths change → ResizeObserver fires → window resizes. No code change needed; works automatically.

### Theme switch (light ↔ dark)

Only colors change; label widths don't. ResizeObserver does not fire (content rect identical). No issue.

### HiDPI / scale factor

Unchanged from current behaviour. `TrayPanel.tsx:109-111` already multiplies CSS px by `devicePixelRatio` before invoking Rust.

### First-frame flicker

Existing `show_tray_panel` (tray.rs:204) does not call `win.show()` until after positioning. Window remains invisible during initial layout → resize, so no flicker is observed. Verified — no change needed.

### Window overflows screen edge

Out of scope. `position_panel_at_cursor` (tray.rs:111) clamps horizontally inside the work area but does not move vertically when the panel grows. A growing panel could push off the right edge of a small monitor. Tracked as a possible follow-up but not part of this PR.

## Files Modified

1. `src/index.css` — add 1 block (2 CSS rules for `body[data-platform="win"]`)
2. `src-tauri/src/tray.rs` — change 1 integer literal (`400` → `480`)

## Files NOT Modified

- `src/components/TrayPanel.tsx` — resize plumbing already correct
- `src-tauri/src/commands.rs` — `resize_tray_panel` signature unchanged
- `src-tauri/tauri.conf.json` — window `width: 220` initial size retained (Rust grows as needed)
- macOS / Linux CSS blocks — explicitly not touched (verified by greps against `data-platform` attributes)

## Acceptance Criteria

1. **AC-1**: Windows panel width = natural content width for normal labels. Visually no white-space trailing on right edge.
2. **AC-2**: Full label `Auto-detect scroll direction` visible without ellipsis on Windows.
3. **AC-3**: macOS still 264px, ellipsis intact.
4. **AC-4**: Linux still 268px, ellipsis intact.
5. **AC-5**: Panel width never less than 200px, never more than 480px (Rust clamps).
6. **AC-6**: No first-frame flicker (window only `show()`n after first resize).
7. **AC-7**: No new runtime dependencies added.
8. **AC-8**: `npx tauri build` produces a working `SmoothScroll_<ver>_x64-setup.exe` on Windows (per `build-locally-before-push` rule).

## Test Plan

Manual, on Windows build produced by local `npx tauri build`:

| Test | Steps | Expected |
|------|-------|----------|
| WT-1 | Right-click tray icon → panel appears | Panel width hugs content; no right-side dead space. |
| WT-2 | Read label `Auto-detect scroll direction` (if any — currently only present in some settings pages, else check `Start with Windows` with locale switch). | No ellipsis on full label. |
| WT-3 | Switch app locale to Vietnamese (Settings → General → Language → Tiếng Việt), reopen tray panel | Panel width matches Vietnamese label widths. |
| WT-4 | Dev-only: set label string to a 200-char dummy in TrayPanel, rebuild | Panel clamps at 480px, no crash, content clipped cleanly. |
| WT-5 | Switch theme between Light and Dark | Width unchanged (verified by eye). |
| WT-6 | Hover over each menu item rapidly | Window resizes smoothly without flicker or jump. |

Cross-platform regression check:

| Platform | Verify |
|----------|--------|
| macOS | `tauri build` → install on Mac → panel still 264px with ellipsis. |
| Linux | `tauri build` → install on Linux → panel still 268px with ellipsis. |

Pre-push local build (per `build-locally-before-push` rule):

```bash
cd D:/SmoothScroll
npm run build:wasm   # only if src/lib/engine-wasm not yet generated
cd src-tauri && npx tauri build
```

Expected output: `src-tauri/target/release/bundle/nsis/SmoothScroll_<ver>_x64-setup.exe` and `src-tauri/target/release/bundle/msi/SmoothScroll_<ver>_x64_en-US.msi`. Hand these to user to test before any push to `master`.

## Rollback

Single commit, two files. `git revert` cleanly removes both changes. No data migration, no schema change.

## Out of Scope

- Smart anchor: keep panel from overflowing right screen edge when window grows.
- Animation/easing on width change (UX nicety, not a defect).
- Per-platform minimum width tweaks (`min_w = 200` is Rust-enforced; CSS min not redefined).
