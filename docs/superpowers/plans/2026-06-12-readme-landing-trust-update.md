# README & Landing Trust-Boost Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add before/after demo GIFs, trust badges, comparison table, and star CTA to README and landing hero to boost conversion.

**Architecture:** Minimal additive changes to existing README and Hero component. Reuses existing `before.gif` and `after.gif` assets. No new dependencies, no new i18n keys.

**Tech Stack:** Markdown, React/Next.js, TypeScript, Tailwind CSS

---

### Task 1: Update README with demo GIFs and trust signals

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Restore Shields badges and add trust row**

Replace the broken badge block in `README.md`:

```markdown
[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/license-FSL--1.1--Apache--2.0-blue.svg)](#license)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](#install)
[![Stack](https://img.shields.io/badge/stack-Rust%20%7C%20Tauri%202%20%7C%20React-orange.svg)](#architecture)
[![Release](https://img.shields.io/github/v/release/quangtruong2003/SmoothScroll?label=release)](https://github.com/quangtruong2003/SmoothScroll/releases)
[![Downloads](https://img.shields.io/github/downloads/quangtruong2003/SmoothScroll/total)](https://github.com/quangtruong2003/SmoothScroll/releases)

⭐ 15 stars  |  100+ downloads  |  v1.5.1  |  Windows 10/11
```

- [ ] **Step 2: Add demo GIF block after intro**

Insert after the macOS support callout and before `## Why SmoothScroll`:

```markdown
<p align="center">
  <img src="landing/public/assets/before.gif" alt="Before" width="320" />
  <img src="landing/public/assets/after.gif" alt="After" width="320" />
</p>

*Jerky native scroll → SmoothScroll eased scroll*
```

- [ ] **Step 3: Add comparison table before FAQ**

Insert before `## FAQ`:

```markdown
## Comparison

| | SmoothScroll | LibreScroll | Windows built-in |
|---|---|---|---|
| System-wide | ✅ | ✅ | ❌ |
| Per-app profiles | ✅ | ❌ | ❌ |
| Game mode | ✅ | ❌ | ❌ |
| Open source | FSL-1.1 | GPL-3.0 | Proprietary |
```

- [ ] **Step 4: Add star CTA before License**

Insert before `## License`:

```markdown
If this helps your workflow, star us on GitHub — it helps others find the project.
```

- [ ] **Step 5: Verify README renders**

Open `README.md` in GitHub preview or markdown viewer. Confirm:
- Badges render as images
- GIFs display side by side
- Table aligns correctly
- No broken links

---

### Task 2: Inject demo strip into landing Hero

**Files:**
- Modify: `landing/components/sections/Hero.tsx:38-51`

- [ ] **Step 1: Add demo strip JSX**

Insert between subtitle and CTA buttons:

```tsx
<div className="flex flex-col sm:flex-row items-center justify-center gap-6">
  <div className="text-center">
    <img src="/assets/before.gif" alt="Before" className="rounded-lg border border-border max-w-[320px] w-full" />
    <p className="text-xs text-muted-foreground mt-2">Before</p>
  </div>
  <div className="text-center">
    <img src="/assets/after.gif" alt="After" className="rounded-lg border border-border max-w-[320px] w-full" />
    <p className="text-xs text-muted-foreground mt-2">After</p>
  </div>
</div>
```

- [ ] **Step 2: Run build to verify**

Run: `cd landing && pnpm build`
Expected: Build succeeds with no errors related to missing assets

- [ ] **Step 3: Visual check**

Start dev server: `pnpm dev` in `landing/`
Open `http://localhost:3000` and confirm:
- Demo strip appears below subtitle
- GIFs load from `/assets/before.gif` and `/assets/after.gif`
- Mobile view stacks images vertically
- Desktop view shows side-by-side

---

### Task 3: Commit changes

- [ ] **Step 1: Stage files**

```bash
git add README.md landing/components/sections/Hero.tsx
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add demo GIFs and trust signals to README and landing hero"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ README demo GIF block
- ✅ Trust badge row
- ✅ Comparison table
- ✅ Star CTA
- ✅ Landing Hero demo strip
- ✅ Responsive behavior (desktop side-by-side, mobile stacked)
- ✅ No new i18n keys (minimal change)

**2. Placeholder scan:**
- No TBD/TODO placeholders
- All code blocks contain complete, copy-pasteable content
- No vague instructions

**3. Type consistency:**
- Hero component props unchanged
- No new types or interfaces introduced
- Existing `Dictionary['hero']` type still satisfied

---

Plan complete and saved to `docs/superpowers/plans/2026-06-12-readme-landing-trust-update.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
