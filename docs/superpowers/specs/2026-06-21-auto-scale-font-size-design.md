# Design: Auto-scale Font Size for Large Displays

**Issue:** [#3 — Font Size](https://github.com/quangtruong2003/SmoothScroll/issues/3)
**Date:** 2026-06-21
**Status:** Approved

## Problem

When the SmoothScroll app is fullscreen on large displays (1920px+), text is difficult to read because the root font size is hardcoded to `13px`. The entire UI renders at a fixed size regardless of viewport width.

## Approach

Use CSS `clamp()` to make the root font size responsive to viewport width, with a smooth transition when the window resizes. This is a pure CSS solution — no JavaScript, no new settings, no performance overhead.

## Changes

### 1. Root font size in `src/index.css`

Replace the hardcoded value:

```css
/* Before */
html {
  font-size: 13px;
}

/* After */
html {
  font-size: clamp(13px, calc(11px + 0.25vw), 18px);
  transition: font-size 150ms ease-out;
}
```

**Scaling behavior:**

| Window width | Effective font size |
|---|---|
| 480px (min window) | 13px (clamped min) |
| 800px | 13px |
| 1080px | ~13.7px |
| 1440px | ~14.6px |
| 1920px | ~15.8px |
| 2560px (QHD) | ~17.4px |
| 3840px (4K) | 18px (clamped max) |

### 2. Hardcoded `px` values → `rem`-based equivalents

8 usages of hardcoded `text-[10px]` and `text-[11px]` across 4 files need to be converted to `rem`-based values so they scale with the root:

| Current | Replace with | Effective at 13px | Effective at 18px |
|---|---|---|---|
| `text-[10px]` | `text-[0.77rem]` | ~10px | ~13.9px |
| `text-[11px]` | `text-[0.846rem]` | ~11px | ~15.2px |

**Files affected:**

- `src/components/CheatSheetOverlay.tsx` — 2 usages of `text-[10px]`
- `src/components/Sidebar.tsx` — 1 usage of `text-[10px]`
- `src/components/TrayPanel.tsx` — 4 usages of `text-[10px]`
- `src/components/tray/CurrentAppCard.tsx` — 1 usage of `text-[11px]`

### 3. No changes needed

- `tailwind.config.js` — no changes, Tailwind's default `rem`-based type scale handles the rest
- Tauri config — no changes needed
- JavaScript — no changes needed

## Testing

- [ ] Open app at default window size (~800px) → text looks identical to before
- [ ] Maximize window on 1920px display → text noticeably larger, easier to read
- [ ] Maximize window on 4K display → text capped at 18px, still readable
- [ ] Resize window slowly → transition is smooth, no jank
- [ ] All UI elements render correctly at max font size (no overflow, no truncation)
- [ ] Cheat sheet overlay, sidebar labels, tray panel labels all scale proportionally

## Out of scope

- User-controllable font size setting (separate feature if needed)
- Linux support (Issue #2, separate effort)
