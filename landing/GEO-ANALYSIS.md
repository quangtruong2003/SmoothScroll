# GEO Analysis — SmoothScroll

Audit target: `http://localhost:3000/`
Audit date: 2026-07-19

## GEO Readiness Score: 82/100

## Verified post-change evidence

- Static export generates `/`, `/vi/`, `/zh/`, `/how-it-works/`, `/vi/how-it-works/`, and `/zh/how-it-works/`.
- Each route emits localized raw HTML, `lang`, title, description, self-canonical URL, reciprocal hreflang, OpenGraph, Twitter metadata, and JSON-LD.
- Home pages render localized answer-first content with contributor/update evidence and official GitHub source and release links.
- JSON-LD links `Organization`, `WebSite`, `WebPage`, and `SoftwareApplication` through stable `@id` values. It includes localized `inLanguage`, `WebPage.author`, `dateModified`, license, GitHub `sameAs`, and homepage-only evidence-bounded FAQ data.
- `sitemap.xml` lists six canonical URLs. `/llms.txt` is present and links official locale pages. `/marquee-debug/` is `noindex` and absent from sitemap.
- Verification: `pnpm exec playwright test e2e/seo.spec.ts` and `pnpm build` pass.

## Current gaps

1. Publish reproducible performance, battery, and compatibility methodology before making performance or broad-device claims citable.
2. Add a permanent `downloadUrl` to `SoftwareApplication` only when a stable official release URL exists.
3. Earn external corroboration; do not create fake profiles, reviews, ratings, or mentions.
4. Keep static route HTML, localized metadata/schema, language links, and sitemap coverage in production crawl tests.

## Previous 61/100 baseline — pre-change

Before this delivery, only English crawlable URLs existed, locale selection was browser state, canonical and schema data were English-only, sitemap listed two pages, `/llms.txt` was absent, and entity links lacked stable references. Those baseline findings are retained only as historical context; they are not current deficiencies.

## Score rationale

| Dimension | Weight | Current evidence |
| --- | ---: | --- |
| Passage citability | 25 | Localized answer-first sections, evidence line, official-source links, bounded FAQ schema. |
| Structural readability | 20 | Six static locale routes, direct heading hierarchy, guide and FAQ content. |
| Multi-modal content | 15 | Existing before/after media, posters, screenshots, and OG image. |
| Authority and brand signals | 20 | GitHub identity, license, contributors/update evidence, linked entity graph. |
| Technical accessibility | 20 | Static raw HTML, locale metadata, hreflang, sitemap, robots, `llms.txt`, crawl tests. |

`llms.txt` remains optional discovery material, not a ranking signal. Score does not assume unverified performance, battery, anti-cheat, device-coverage, or Linux-release claims.
