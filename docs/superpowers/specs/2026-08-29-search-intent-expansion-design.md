# Search Intent Expansion Design

**Date:** 2026-08-29

## Goal

Increase qualified organic traffic and Windows downloads from Google by expanding SmoothScroll's English landing-site coverage into five distinct search intents while preserving the existing homepage as the primary category page for “smooth scrolling software for Windows.”

## Current state

- The English homepage already targets the broad product/category intent and should remain the canonical category page.
- Localized home/guide routes already publish raw HTML, canonical URLs, hreflang, Open Graph/Twitter metadata, JSON-LD, sitemap entries, robots directives, and crawl regression tests.
- The site is a Next.js 15 static export hosted at `https://smoothscroll.top`.
- Download CTAs resolve release assets client-side and currently emit a local `smoothscroll:downloaded` browser event without network analytics.

## Search architecture

Create five English-only intent pages. They intentionally do not receive Vietnamese/Chinese hreflang alternates until translated equivalents exist.

| Route | Primary intent | Page role |
| --- | --- | --- |
| `/mac-like-scrolling-windows/` | mac-like scrolling on Windows | Experience/feel comparison without claiming exact macOS behavior |
| `/smooth-mouse-wheel-windows/` | smooth mouse wheel scrolling on Windows | External-mouse / wheel-specific problem and solution |
| `/fix-choppy-scrolling-windows-11/` | fix choppy mouse-wheel scrolling on Windows 11 | Troubleshooting/problem-solution intent |
| `/smooth-scrolling-chrome-windows/` | smooth scrolling in Chrome on Windows | Browser workflow intent; position SmoothScroll as system-wide rather than a browser-only feature |
| `/smooth-scrolling-vscode-windows/` | smooth scrolling in VS Code on Windows | Developer workflow intent; emphasize per-app profile and modifier passthrough |

The homepage remains the broad “smooth scrolling software for Windows” target. `/how-it-works/` remains the product/settings guide. New pages link back to both and cross-link only to genuinely related intent pages.

## Content model

Add one typed English intent-content registry containing, per page:

- slug
- title and meta description
- eyebrow, H1, lead and concise answer-first summary
- problem explanation grounded in existing product behavior
- benefits/capabilities relevant to the intent
- practical setup steps
- visible FAQ entries
- related-intent slugs
- download attribution source

Use one reusable intent-page renderer so the five pages share semantic structure, visual styling and accessibility while keeping copy distinct enough to avoid thin/duplicate pages.

## Metadata and structured data

Each intent page emits:

- absolute self-canonical URL
- unique title and meta description
- Open Graph and Twitter metadata using the existing social image
- no locale alternates/hreflang until translated equivalents exist
- JSON-LD graph with `Organization`, `WebSite`, `WebPage`, `SoftwareApplication`, `BreadcrumbList`, and `FAQPage`
- FAQ schema only for questions whose answers are visible in raw server-rendered HTML

Existing homepage/guide schema behavior remains unchanged.

## Internal linking

Add a compact “Windows scrolling guides” block to the English homepage and English how-it-works page. Each intent page includes breadcrumb-style navigation to Home and How it works plus a small related-guides section. Do not add the English-only intent links to Vietnamese/Chinese pages.

## Sitemap and discovery

Keep the existing six localized canonical URLs. Add the five English intent URLs with their own content update date (`2026-08-29`) instead of changing the historical `lastModified` date for unrelated existing pages. Extend `llms.txt` with the new official English guides as optional discovery documentation.

## Download attribution and privacy

Do not add remote analytics or telemetry because the public product promise explicitly says no telemetry. Extend the existing local `smoothscroll:downloaded` CustomEvent to include privacy-preserving event detail such as `source` and `path`, and expose a deterministic `data-download-source` attribute for QA/regression tests. New intent CTAs pass their route-specific source. No network request is added.

## Testing

Add regression coverage that verifies:

- all five intent URLs return 200 and server-render their unique H1/copy
- each has its own canonical, title, description and social metadata
- intent pages do not publish fake localized hreflang alternates
- structured data parses and includes WebPage, SoftwareApplication, BreadcrumbList and visible FAQ entries
- homepage and English guide contain links to all five intent pages
- sitemap contains all eleven public canonical URLs and excludes debug routes
- download CTA exposes its source and emits source/path detail when clicked
- existing locale SEO tests continue to pass unchanged
- production `pnpm build` succeeds and generated static HTML contains the five routes

## Boundaries

- No keyword stuffing, fake reviews, ratings, backlinks, fabricated benchmark numbers or unsupported compatibility claims.
- No remote tracking/analytics dependency.
- No desktop-app behavior changes.
- No translated intent pages in this pass.
- No change to GitHub Pages/static-export architecture.

## Success criteria

- Five distinct crawlable English intent pages are statically exported and discoverable through sitemap/internal links.
- Broad category intent stays concentrated on the homepage; new pages target narrower intents without duplicating its exact role.
- Every new page has unique metadata, visible answer-first copy, valid schema and a download CTA.
- Download interactions carry local source context without introducing telemetry.
- Relevant tests and production build pass.
