# Smooth Theme Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smooth, polished theme transitions (~150-200ms) when switching between Light/Dark/System themes in the settings UI.

**Architecture:** Pure CSS transitions approach - no animation libraries needed. Theme button highlight animates with transition-all, content colors fade smoothly using CSS transition on :root/dark class and universal selector.

**Tech Stack:** CSS transitions, Tailwind CSS, React

---

## File Structure

```
src/
├── index.css          # Global CSS with theme transitions
└── components/
    └── Sidebar.tsx     # Theme switch buttons with enhanced transitions
```

---

## Task 1: Add CSS Theme Transitions

**Files:**
- Modify: `src/index.css:52-68`

- [ ] **Step 1: Add transition rules to index.css**

The `index.css` already has theme CSS variables defined. Add smooth transition rules:

```css
@layer base {
  :root,
  .dark {
    transition: background-color 200ms ease-out,
                color 200ms ease-out,
                border-color 200ms ease-out;
  }
}

@layer base {
  /* ... existing code ... */
  * {
    @apply border-border;
    transition: background-color 200ms ease-out,
                color 200ms ease-out,
                border-color 200ms ease-out;
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm run build`
Expected: Build succeeds with no errors

---

## Task 2: Enhance Theme Button Transitions

**Files:**
- Modify: `src/components/Sidebar.tsx:150-155`

- [ ] **Step 1: Update button className with enhanced transitions**

In the `SidebarFooter` component's theme button renderer:

```tsx
className={cn(
  "flex flex-1 items-center justify-center rounded py-1 transition-all duration-150 ease-out",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
  isActive
    ? "bg-primary text-primary-foreground"
    : "text-muted-foreground hover:bg-accent hover:text-foreground",
)}
```

Change from `transition-colors` to `transition-all duration-150 ease-out`.

- [ ] **Step 2: Verify build passes**

Run: `pnpm run build`
Expected: Build succeeds

---

## Verification Checklist

- [ ] Theme button highlight transitions smoothly (~150ms)
- [ ] Content colors fade between light/dark themes (~200ms)
- [ ] No jarring flash or instant switch
- [ ] Build passes without errors

---

## Implementation Notes

This is a CSS-only implementation. No JavaScript changes needed since `applyTheme()` in `src/lib/theme.ts` already toggles the `.dark` class correctly.

The key insight: Tailwind's class-based dark mode and CSS transitions work together - when `.dark` class is toggled, the CSS variables change, and the transition property smooths the visual change.

---

## Related Files (Read-Only)

- `src/lib/theme.ts` - Contains `applyTheme()` function that toggles dark class
- `src/stores/settingsStore.ts` - Calls `applyTheme()` on theme change