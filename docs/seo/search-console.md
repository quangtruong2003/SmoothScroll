# Google Search Console submission

Google indexes GitHub fast (1-3 days), but indexing the new landing page is faster if you submit it explicitly.

## Step 1 — verify the landing page

1. Go to https://search.google.com/search-console
2. Click **Add property** → **URL prefix**
3. Enter: `https://smoothscroll.top/`
4. Verification method: **HTML file** (Search Console gives a file like `googleXXXXXXXX.html`).
5. Add the file to the `gh-pages` branch:

       git worktree add /tmp/ssc-pages-verify gh-pages
       cp ~/Downloads/googleXXXXXXXX.html /tmp/ssc-pages-verify/
       cd /tmp/ssc-pages-verify
       git add googleXXXXXXXX.html
       git commit -m "chore(site): Search Console verification"
       git push
       cd /d/SmoothScroll
       git worktree remove /tmp/ssc-pages-verify

6. Wait ~30 seconds for Pages to redeploy. Click **Verify** in Search Console.

## Step 2 — submit sitemap

1. In Search Console, go to **Sitemaps** (left sidebar)
2. Add sitemap URL: `sitemap.xml`
3. Click **Submit**. Status should turn green within minutes.

## Step 3 — request indexing for the landing page

1. **URL Inspection** (top search bar): paste `https://smoothscroll.top/`
2. Click **Request Indexing**.
3. Repeat for `https://github.com/quangtruong2003/SmoothScroll` (you don't own github.com, but the URL Inspection tool still nudges Googlebot).

## Step 4 — Bing (optional, 5 min for ~3% extra traffic)

1. https://www.bing.com/webmasters → sign in
2. Import from Google Search Console (one click) — Bing pulls verification + sitemap automatically.

## Expected timeline

- 1-3 days: landing page appears in `site:quangtruong2003.github.io` search.
- 1-2 weeks: starts ranking for long-tail keywords like "tauri smooth scroll" or "windows mouse wheel inertia rust".
- 1-2 months: starts ranking for high-competition keywords like "smooth scrolling windows" if backlinks land (awesome-tauri PR + 1-2 social posts).
