# README & Landing Trust-Boost Update Design

**Date:** 2026-06-12  
**Author:** Agentic brainstorm  
**Status:** Approved

---

## Goal

Increase README and landing page conversion by adding visual proof (before/after GIFs) and minimal trust signals (badges, comparison table) aligned with the project's current 50-100 star milestone.

---

## Current State

- `README.md` has badges for license, platform, stack, release, and downloads. No demo visuals, no comparison, no direct star CTA.
- `landing/components/sections/Hero.tsx` shows title, subtitle, Download CTA, and brand marquee. No demo visuals.
- Demo assets exist: `landing/public/assets/before.gif` and `landing/public/assets/after.gif`.
- Landing already supports EN / VI / ZH via `landing/lib/i18n/*.json`.

---

## Proposed Changes

### 1. README (`README.md`)

Add three sections without restructuring existing content:

1. **Demo GIF block** — placed after the opening paragraph, before `## Why SmoothScroll`.
   - Side-by-side images: `before.gif` (left, label "Before") and `after.gif` (right, label "After").
   - Use relative paths so the README works from the repo root and from GitHub.
   - Caption: "Jerky native scroll → SmoothScroll eased scroll".

2. **Trust badge row** — placed after the existing Shields badges.
   - Inline text badges: `Stars ⭐ 15 | Downloads X | v1.5.0 | Windows 10/11`.
   - Keep it minimal; do not add dynamic badge fetching.

3. **Comparison table** — placed before the `## FAQ` section.
   - Three columns: SmoothScroll, LibreScroll, Windows built-in.
   - Rows: System-wide, Per-app profiles, Game mode, Open source.
   - Honest claims only; no fabricated benchmarks.

4. **Star CTA** — last paragraph before `## License`.
   - One line: "If this helps your workflow, star us on GitHub — it helps others find the project."

### 2. Landing Hero (`landing/components/sections/Hero.tsx`)

- Insert a **before/after demo strip** between the subtitle and the CTA buttons.
- Strip layout: two `<img>` tags side by side, max-width constrained, with small labels.
- Use the same GIF paths as the README so assets are shared.
- Keep existing responsive behavior; on mobile stack the images vertically.
- Do not introduce new i18n keys for the demo labels unless absolutely necessary. Default to English labels to keep the change minimal.

### 3. Landing i18n (`landing/lib/i18n/en.json`, `vi.json`, `zh.json`)

- If the demo labels need translation, add `demo.before` and `demo.after` keys under `hero`.
- Otherwise skip this change and use hardcoded English labels.

### 4. Build Verification

- Run `pnpm build` in `landing/` to confirm the new image references compile and the static export includes the GIFs.
- Run `pnpm lint` if available.

---

## Out of Scope

- Dynamic star/download counters.
- Screenshot or GIF generation.
- New sections like testimonials, benchmarks, or pricing.
- macOS landing page content changes.

---

## Success Criteria

1. README renders the demo GIFs and comparison table on GitHub without broken links.
2. Landing hero shows the demo strip on desktop and mobile.
3. No new linter or build errors in `landing/`.
4. All changes are additive; no existing copy or layout is removed.
