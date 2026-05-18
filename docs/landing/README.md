# SmoothScroll Landing Page

Source for the landing site at https://quangtruong2003.github.io/SmoothScroll/

## Deploy flow

`master` is the source of truth. The `gh-pages` branch is a deploy target produced by CI — do not edit it directly.

1. Edit files under `docs/landing/`
2. Commit and push to `master`
3. `.github/workflows/deploy-landing.yml` mirrors `docs/landing/` to `gh-pages`
4. GitHub Pages rebuilds (~1-2 min)

## Structure

```
docs/landing/
├── index.html                # Root language redirector
├── en/index.html              # English
├── vi/index.html              # Vietnamese
├── zh/index.html              # Simplified Chinese
├── styles.css                 # Shared styles, light/dark via CSS vars
├── scripts/
│   ├── download.js            # OS detect + GitHub Releases API
│   └── ui.js                  # FAQ, install tabs, scroll spy, etc.
├── assets/                    # Icon + screenshot SVG placeholders + OG image
├── sitemap.xml                # 3 URLs with hreflang
├── robots.txt
├── .nojekyll                  # Disable Jekyll on gh-pages
└── googleb5a10d9504de3274.html # Google Search Console verification
```

## Local preview

```sh
cd docs/landing
python -m http.server 8080
# http://localhost:8080/en/
```

## Replacing screenshot placeholders

Drop real PNG/WebP screenshots into `assets/` and update the `<img src>` paths in `en/index.html`, `vi/index.html`, `zh/index.html`. Current placeholders are SVG.

## Versioning

- `softwareVersion` in JSON-LD and the trust line default to `0.1.15`
- `scripts/download.js` always tries the GitHub Releases API first; static fallbacks live in the same file
- Bump `FALLBACK_VERSION` in `scripts/download.js` after each release for offline-first accuracy
