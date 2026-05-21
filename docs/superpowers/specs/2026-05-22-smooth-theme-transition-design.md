# Smooth Theme Transitions - Design Spec

**Date:** 2026-05-22
**Status:** Approved

## Overview

Add smooth, polished theme transitions when switching between Light/Dark/System themes in the SmoothScroll settings UI.

## Design Goals

- **Feel:** Subtle, fast, macOS/iOS-like transitions (~150-200ms)
- **Scope:** Theme button highlight animation + content color transitions
- **No overhead:** Pure CSS transitions, no animation libraries

## Implementation

### 1. Button Highlight Animation

**Location:** `Sidebar.tsx` - theme switch buttons in footer

**Changes:**
- Add `transition-all duration-150` to button elements
- Scale effect on hover: `hover:scale-105`
- Selected state: smooth background transition

```tsx
<button
  className={cn(
    "flex flex-1 items-center justify-center rounded py-1 transition-all duration-150",
    isActive ? "bg-primary text-primary-foreground" : "..."
  )}
>
```

### 2. Content Theme Transitions

**Location:** `src/index.css` or component CSS

**Changes:**
- Add transition on `:root` or `body` for theme colors
- Transition key properties: `background-color`, `color`, `border-color`
- Duration: ~200ms with ease-out

```css
:root,
.dark {
  transition: background-color 200ms ease-out,
              color 200ms ease-out,
              border-color 200ms ease-out;
}
```

### 3. Tailwind Config (if needed)

Ensure Tailwind's dark mode uses class-based toggling for smooth transitions.

## Files to Modify

1. `src/components/Sidebar.tsx` - Add button transitions
2. `src/index.css` - Add CSS theme transitions

## Success Criteria

- [ ] Theme button highlight transitions smoothly (150-200ms)
- [ ] Content colors fade between light/dark themes
- [ ] No jarring flash or instant switch
- [ ] Performance: No layout shift, smooth 60fps