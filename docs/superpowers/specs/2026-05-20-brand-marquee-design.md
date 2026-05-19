# Brand Marquee — Design Spec

**Date:** 2026-05-20
**Topic:** Hero brand-compatibility marquee
**Status:** Approved

## Goal

Add a horizontally scrolling row of brand logos (with brand text) directly under the Hero `trustLine`. The row shows OS / browser / IDE / office apps where SmoothScroll's core feature works well, providing visual social proof without dominating the hero composition.

## Non-Goals

- No tooltip / hover detail copy for individual logos
- No grouping headers (no "OS", "Browsers" labels)
- No click-through to brand sites
- No dynamic per-locale brand list (brand names are not translated)
- No claim of partnership / endorsement — purely "works with"

## Placement

`landing/components/sections/Hero.tsx`, immediately under the trust-line `<p>`. Marquee participates in the natural document flow; it is not absolutely positioned.

```
<div className="flex flex-col gap-6">
  ...
  <p className="text-sm text-muted-foreground">{h.trustLine}</p>
  <BrandMarquee />            ← NEW
</div>
```

## Component contract

```ts
// landing/components/BrandMarquee.tsx
'use client'
export function BrandMarquee(): JSX.Element
```

- No props.
- Marked `'use client'` because it relies on a CSS animation; SSR renders the static markup, animation kicks in on hydrate.
- Pure presentational. No data fetching, no i18n.

## Brand list (16 entries)

Hard-coded in the component module. Each entry is `{ name, slug, hex }`:

| # | Group | name | simple-icons slug | hex (fallback) |
|---|-------|------|-------------------|----------------|
| 1 | OS | Windows 11 | windows11 | #0078D4 |
| 2 | OS | macOS | apple | #999999 |
| 3 | Browser | Chrome | googlechrome | #4285F4 |
| 4 | Browser | Edge | microsoftedge | #0078D4 |
| 5 | Browser | Firefox | firefoxbrowser | #FF7139 |
| 6 | IDE | VS Code | visualstudiocode | #007ACC |
| 7 | IDE | Cursor | cursor | #000000 |
| 8 | IDE | IntelliJ IDEA | intellijidea | #000000 |
| 9 | IDE | WebStorm | webstorm | #000000 |
| 10 | IDE | PyCharm | pycharm | #21D789 |
| 11 | Office | Microsoft Word | microsoftword | #2B579A |
| 12 | Office | Microsoft Excel | microsoftexcel | #217346 |
| 13 | Office | Notion | notion | #FFFFFF |
| 14 | Office | Slack | slack | #4A154B |
| 15 | Office | Figma | figma | #F24E1E |
| 16 | Office | Discord | discord | #5865F2 |

If a slug is missing in `simple-icons`, the implementation falls back to inline SVG using the listed hex.

## Visual

Each item:

```
[ <svg 20×20 fill={hex}/> ] [ <span>{name}</span> ]
```

- Item: `inline-flex items-center gap-2 shrink-0`
- Logo: 20×20 SVG, fill = brand hex
- Text: `text-sm font-medium text-muted-foreground/85`
- Spacing between items: `gap-10` (40px)
- Container: `relative overflow-hidden py-6`
- The marquee wrapper itself: `flex items-center gap-10 w-max`

Color choice: brand-color logos sit on a theme-aware background. Most brand colors (Chrome, Firefox, Slack, Discord, Figma, Word, Excel, PyCharm) read fine on BOTH themes. Problem brands are those whose canonical color is near-black or near-white:

- **Cursor, IntelliJ IDEA, WebStorm**: canonical #000000 → invisible on dark theme.
- **Apple, Notion**: white logo lives on a black background officially → invisible on light theme.

Strategy: each brand entry carries TWO colors `{ hexLight, hexDark }`. Default to the canonical brand hex for both, override only for the problem brands above:

| Brand | hexLight | hexDark |
|-------|----------|---------|
| Apple (macOS) | #1D1D1F | #F5F5F7 |
| Cursor | #1D1D1F | #F5F5F7 |
| IntelliJ IDEA | #000000 | #FE2857 |
| WebStorm | #000000 | #07C3F2 |
| Notion | #1D1D1F | #FFFFFF |

The component picks the right hex via a CSS class toggled by `:root.dark`. Implementation uses inline `style={{ color: 'var(--brand-color)' }}` plus per-item CSS class binding `--brand-color: light` and `[data-theme="dark"] --brand-color: dark`. Simpler alternative: render two SVGs per item (one with light hex, one with dark) and toggle `display` via `:where(.dark) ...`. Implementation MUST pick one of these and not mix.

The text label follows `text-muted-foreground/85`, which is theme-aware via existing CSS variables — no extra work needed.

### Edge fade mask

The container fades both edges so logos appear to glide in/out:

```css
mask-image: linear-gradient(
  to right,
  transparent 0,
  black 64px,
  black calc(100% - 64px),
  transparent 100%
);
-webkit-mask-image: same;
```

## Animation

CSS keyframe, no JS:

```css
@keyframes brand-marquee-slide {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
.brand-marquee-track {
  animation: brand-marquee-slide 40s linear infinite;
  will-change: transform;
}
```

- Duration: 40s for full pass (16 logos × 2 copies).
- Direction: leftward.
- The track contains the brand list rendered **twice in sequence**, so when it shifts by `-50%` the second copy seamlessly takes the first copy's place.
- `pointer-events: none` on the marquee track to keep the row from absorbing scroll.

### Reduced motion

Wrap the keyframe in:

```css
@media (prefers-reduced-motion: reduce) {
  .brand-marquee-track { animation: none; }
}
```

When animation is off, the track shows the first copy at offset 0 — naturally truncated by overflow + edge mask. We accept that some logos are not visible to motion-sensitive users; the row is decorative, not load-bearing.

## File structure

```
landing/
├── components/
│   └── BrandMarquee.tsx          ← new
├── lib/
│   └── brands.ts                 ← new (brand list constant + types)
└── app/
    └── globals.css               ← +keyframe + utility class
```

## Dependencies

Add `simple-icons` to `landing/package.json` dependencies.

- `simple-icons@^13` (or latest) — 3000+ brand SVGs, MIT-licensed metadata + CC0 SVG paths.
- Per-icon import path: `import siChrome from 'simple-icons/icons/googlechrome'`.
- Tree-shakeable: only the 16 imported icons land in the bundle. Estimated overhead < 10 KB gzipped.

If a slug doesn't resolve at build time, the implementation hard-codes a fallback inline SVG (sourced manually) for that brand.

## Bundle / performance budget

- Static markup: ~16 × 2 = 32 SVGs in DOM. Each SVG ~200 bytes serialized → ~6 KB DOM.
- Animation runs purely on the compositor (`transform`), no layout thrash.
- No `IntersectionObserver`; the row is small enough to always run.

## Testing

### Unit (vitest + @testing-library/react)

`landing/components/BrandMarquee.test.tsx`:

1. Renders 32 brand items (16 × 2 copies).
2. Each rendered item has `aria-label` or `title` matching brand `name`.
3. Each item contains an `<svg>` element.
4. The track wrapper has `aria-hidden="true"` on the duplicated copy (so screen readers announce only 16 brands, not 32).

### Visual / smoke

Manual: run `npm run dev`, hard-reload Hero. Verify:
- 16 logos visible in some position; second pass appears seamlessly.
- Animation runs ~40s per loop.
- Edge mask hides logos at left/right entries.
- Reduced motion toggle: row is static.

### Type / build

- `tsc --noEmit` clean.
- `next build` clean.

## Accessibility

- Marquee track wrapper: `aria-hidden="true"` on the **duplicate** copy only.
- The first copy is part of the document; logos use `role="img"` and `aria-label={name}` so SR users hear "Windows 11, macOS, Chrome..." once.
- Marquee container: `role="list"`, items: `role="listitem"`.
- Animation respects `prefers-reduced-motion`.
- No focusable elements inside (logos are not links).

## Risks / open questions

- **Brand-name trademark:** displaying logos for "compatibility" is generally fair use. Repo already shows third-party names in copy. If a brand later objects, removing one entry is a 1-line change to `lib/brands.ts`.
- **Slug drift in simple-icons:** package occasionally renames slugs. Specifically, `windows11`, `cursor`, `webstorm`, `microsoftedge` may not exist or may use different slug names. Implementation MUST verify each slug at build time. Fallback inline SVG covers missing slugs; CI build will fail loudly if a slug import breaks.
- **Theme contrast:** dual-theme handling is now in scope (see Visual section). Implementation MUST eye-test all 16 brands on both light and dark themes.

## Out of scope (parking lot)

- Tooltip on hover with version-compat detail
- Click-through to per-brand "how it feels with X" pages
- A/B testing speed (40s vs 60s)
