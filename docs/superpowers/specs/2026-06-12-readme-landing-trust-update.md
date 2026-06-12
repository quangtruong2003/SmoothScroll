# README & Landing Trust-Boost Update Spec

**Goal:** Increase landing conversion with minimal trust signals and visual proof.

**Architecture:** Additive changes to existing README and Hero. Reuses existing GIF assets. No new i18n keys.

## Changes

- `README.md` — restore Shields badges, add trust row, demo GIF block, comparison table, star CTA
- `landing/components/sections/Hero.tsx` — insert before/after demo strip before CTAs
