# Auto-scale Font Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SmoothScroll app's font size responsive to viewport width so text remains readable on large displays (1920px+).

**Architecture:** Replace the hardcoded `13px` root font size with a `clamp()` expression that scales from 13px (small windows) to 18px (4K fullscreen), with a smooth transition. Convert 8 hardcoded `px` values in components to `rem`-based equivalents so they scale proportionally.

**Tech Stack:** CSS (clamp, calc, vw units), Tailwind CSS arbitrary values (rem-based)

## Global Constraints

- No JavaScript changes required
- No new dependencies
- Preserve exact visual appearance at default window sizes (480-800px)
- Font size must scale smoothly when window resizes

---

## File Structure

- Modify: `src/index.css:64-66` — Update root font-size from hardcoded `13px` to responsive `clamp()` expression with transition
- Modify: `src/components/CheatSheetOverlay.tsx:94,103` — Convert `text-[10px]` to `text-[0.77rem]` (2 occurrences)
- Modify: `src/components/Sidebar.tsx:187` — Convert `text-[10px]` to `text-[0.77rem]` (1 occurrence)
- Modify: `src/components/TrayPanel.tsx:23,213,284,285` — Convert `text-[10px]` to `text-[0.77rem]` (4 occurrences)
- Modify: `src/components/tray/CurrentAppCard.tsx:131` — Convert `text-[11px]` to `text-[0.846rem]` (1 occurrence)

---

### Task 1: Update Root Font Size

**Files:**
- Modify: `src/index.css:64-66`

**Interfaces:**
- Consumes: None
- Produces: Responsive root font-size that scales from 13px to 18px based on viewport width

- [ ] **Step 1: Read current root font-size declaration**

Run: `Read src/index.css` and locate the `html { font-size: 13px; }` block (around line 64-66)

- [ ] **Step 2: Replace hardcoded font-size with clamp expression**

Edit `src/index.css` at line 64-66:

```css
  /* Responsive font size: scales from 13px (small windows) to 18px (4K displays).
   * Formula: min + (max - min) * (vw / viewport-width)
   * At 1920px: 11 + 0.25*1920 = 11 + 480 = 491px? No, 0.25vw = 0.25% of viewport
   * Correct calc: 11px + 0.25vw = 11 + (0.25 * 1920 / 100) = 11 + 4.8 = 15.8px */
  html {
    font-size: clamp(13px, calc(11px + 0.25vw), 18px);
    transition: font-size 150ms ease-out;
  }
```

- [ ] **Step 3: Verify the change visually**

Run: `pnpm dev` and open the app in browser. Resize the window from narrow (~800px) to wide (~1920px). Observe that text size increases smoothly.

Expected: Text scales up noticeably as window widens. Transition is smooth, no jank.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(css): responsive root font-size with clamp for large displays"
```

---

### Task 2: Convert Hardcoded Pixel Values to Rem

**Files:**
- Modify: `src/components/CheatSheetOverlay.tsx:94,103`
- Modify: `src/components/Sidebar.tsx:187`
- Modify: `src/components/TrayPanel.tsx:23,213,284,285`
- Modify: `src/components/tray/CurrentAppCard.tsx:131`

**Interfaces:**
- Consumes: Responsive root font-size from Task 1
- Produces: All micro-labels (10px, 11px) that scale proportionally with root font-size

- [ ] **Step 1: Update CheatSheetOverlay.tsx (2 occurrences)**

Edit `src/components/CheatSheetOverlay.tsx`:

Line 94:
```tsx
// Before:
className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide"

// After:
className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[0.77rem] font-mono uppercase tracking-wide"
```

Line 103:
```tsx
// Before:
<footer className="mt-4 text-center text-[10px] text-muted-foreground">

// After:
<footer className="mt-4 text-center text-[0.77rem] text-muted-foreground">
```

- [ ] **Step 2: Update Sidebar.tsx (1 occurrence)**

Edit `src/components/Sidebar.tsx` line 187:

```tsx
// Before:
<div className="px-1 text-center text-[10px] tabular-nums text-muted-foreground">

// After:
<div className="px-1 text-center text-[0.77rem] tabular-nums text-muted-foreground">
```

- [ ] **Step 3: Update TrayPanel.tsx (4 occurrences)**

Edit `src/components/TrayPanel.tsx`:

Line 23:
```tsx
// Before:
<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">

// After:
<span className="text-[0.77rem] font-semibold uppercase tracking-wider text-muted-foreground">
```

Line 213:
```tsx
// Before:
className={`text-[10px] font-medium transition-colors duration-300 ${

// After:
className={`text-[0.77rem] font-medium transition-colors duration-300 ${
```

Line 284:
```tsx
// Before:
<span className="text-[10px] text-muted-foreground">SmoothScroll</span>

// After:
<span className="text-[0.77rem] text-muted-foreground">SmoothScroll</span>
```

Line 285:
```tsx
// Before:
<span className="text-[10px] text-muted-foreground">{appVersion}</span>

// After:
<span className="text-[0.77rem] text-muted-foreground">{appVersion}</span>
```

- [ ] **Step 4: Update CurrentAppCard.tsx (1 occurrence)**

Edit `src/components/tray/CurrentAppCard.tsx` line 131:

```tsx
// Before:
<div className="mt-0.5 truncate text-[11px] text-muted-foreground">

// After:
<div className="mt-0.5 truncate text-[0.846rem] text-muted-foreground">
```

- [ ] **Step 5: Verify all changes visually**

Run: `pnpm dev` and check:
1. Cheat sheet overlay (press `?`) — labels scale when window resizes
2. Sidebar version number — scales proportionally
3. Tray panel — all labels (Current App, status text, footer) scale
4. Current app card subtitle — scales with root

Expected: All micro-labels grow/shrink smoothly as window width changes. No layout breakage or truncation at max size (18px).

- [ ] **Step 6: Commit**

```bash
git add src/components/CheatSheetOverlay.tsx src/components/Sidebar.tsx src/components/TrayPanel.tsx src/components/tray/CurrentAppCard.tsx
git commit -m "feat(components): convert hardcoded px values to rem for responsive scaling"
```

---

### Task 3: Test Across Viewport Sizes

**Files:** None (testing only)

**Interfaces:**
- Consumes: All changes from Task 1 and Task 2
- Produces: Verification that feature works as specified

- [ ] **Step 1: Test at minimum window size (~480px)**

Run: `pnpm dev`, resize window to ~480px width.

Check:
- Root font-size is 13px (inspect `html` element in DevTools)
- All text is readable, no overflow
- Layout is intact

- [ ] **Step 2: Test at default window size (~800px)**

Resize window to ~800px width.

Check:
- Root font-size is still 13px (clamped)
- Visual appearance matches the version before changes
- No unintended scaling

- [ ] **Step 3: Test at 1080p display**

Maximize window on a 1920x1080 display (or set window width to 1920px).

Check:
- Root font-size is ~15.8px (inspect DevTools)
- Text is noticeably larger than at 800px
- All labels, buttons, and body text are readable
- No overflow or truncation

- [ ] **Step 4: Test at 4K display (if available)**

Maximize window on a 3840x2160 display (or set window width to 3840px).

Check:
- Root font-size is 18px (clamped max)
- Text is large and comfortable to read
- No elements are oversized or broken

- [ ] **Step 5: Test smooth transition**

Slowly resize window from 800px to 1920px and back.

Check:
- Font size changes smoothly (150ms transition)
- No jank or stuttering
- Transition feels natural

- [ ] **Step 6: Test tray panel specifically**

Open tray panel and resize main window.

Check:
- Tray panel labels scale proportionally
- Tray panel layout remains intact
- No text overflow in app names or subtitles

- [ ] **Step 7: Final commit (if any fixes needed)**

If any issues were found and fixed during testing, commit them:

```bash
git add -A
git commit -m "fix(css): address scaling issues found during testing"
```

If no issues, skip this step.

---

## Success Criteria

- [ ] Font size scales from 13px (480px window) to 18px (4K window)
- [ ] All 8 hardcoded `px` values converted to `rem`
- [ ] Smooth 150ms transition when resizing
- [ ] No visual breakage at any viewport size
- [ ] Text at 1920px+ is noticeably easier to read than before
- [ ] All tests pass (visual verification in Tasks 1-3)
