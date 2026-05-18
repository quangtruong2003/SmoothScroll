# Bug Report — Cursor Repulsion Dot Grid Vô Hình Sau 5 Lần Sửa

**Date:** 2026-05-18
**Repo:** quangtruong2003/SmoothScroll
**Folder:** `landing/`
**Branch:** `master` (24 file pending chưa commit, không liên quan)
**Severity:** Implementation hoàn chỉnh, build pass, JS run không lỗi, nhưng user nhìn vào trang KHÔNG THẤY GÌ.

## Bối cảnh dự án

- **Stack:** Next.js 15 App Router (`output: 'export'`), Tailwind CSS v3 (`darkMode: 'media'`), React 18.
- **Build mode:** Static export ONLY. `next dev` OOM máy user. Pipeline: `cd landing && npm run build && npx serve out -p 3001`.
- **basePath:** `NEXT_PUBLIC_BASE_PATH` (rỗng ở local, `/SmoothScroll` ở CI).
- **Test URL:** `http://localhost:3001/en/` (Chrome desktop, hover, no reduced-motion).
- **Theme đang test:** dark mode (OS = dark, `<html class="dark">`).

## Yêu cầu UX (final, đã chốt với user)

Hiệu ứng "antigravity" trên nền:
1. Toàn page có grid dots đều khoảng cách 22px, màu xám tĩnh.
2. Khi rê chuột, dots trong bán kính ~220px quanh cursor bị **đẩy ra xa cursor (repulsion)** tối đa 14px theo hướng ngược cursor.
3. Đồng thời các dots đó **lerp màu** từ xám sang brand-blue theo falloff bậc 2.
4. Dừng chuột → dots spring về vị trí grid cũ với LERP_FACTOR=0.18.
5. Tôn trọng `prefers-reduced-motion` và `hover: none`.

## Triệu chứng hiện tại

User mở `http://localhost:3001/en/` (light hoặc dark mode), rê chuột khắp viewport — **KHÔNG thấy bất kỳ dot nào, không thấy hiệu ứng cursor**. Trang chỉ hiển thị nền đặc + content (hero, install, etc.).

Console: clean. Không có JS error. Chỉ có 1 dòng intervention info:
```
[Intervention] Images loaded lazily and replaced with placeholders. Load events are deferred.
```

## Các approach đã thử và FAIL (5 lần)

### Lần 1-3 (CSS-based, đã loại bỏ hoàn toàn)
- Lần 1: Gradient cloud + `mix-blend-mode: screen/multiply` → vô hình
- Lần 2: Tăng alpha → vô hình
- Lần 3: Layer dots brand + `mask-image: radial-gradient(... at var(--mx) var(--my))` → vô hình. Nghi browser bug "CSS-var-in-mask không repaint".

### Lần 4 (CSS với mask static + transform wrapper)
- Wrapper `position: absolute; transform: translate3d()`
- Bên trong có 2 layer `.bg-dot-bloom` + `.bg-dot-grid-glow` với mask radial static `at center`
- Verify: cursorRef element thật sự update transform inline style đúng theo cursor, nhưng visual vẫn vô hình.

### Lần 5 (Canvas 2D — current implementation)
- Spec `docs/superpowers/specs/2026-05-19-cursor-repulsion-dot-grid-design.md`
- Plan `docs/superpowers/plans/2026-05-19-cursor-repulsion-dot-grid.md`
- Helpers (`landing/lib/dotGrid.ts`) + 11 unit test pass
- Component (`landing/components/BackgroundDotGrid.tsx`) viết lại từ đầu — single canvas, rAF loop, MutationObserver theme
- Mid-debug fix: chuyển `bg-background` từ `body` → `html` để canvas `z-index: -10` không bị body bg che
- **Build pass, tsc clean, vẫn không thấy gì**

## Bằng chứng quan trọng từ DevTools (sau lần 5, TRƯỚC khi fix bg → html)

User chạy snapshot script trên Chrome console khi page đang load:

```js
{
  pixelW: 1216, pixelH: 966,        // canvas backing store đúng
  cssW: "1216px", cssH: "966px",    // canvas CSS size đúng
  rect: { x: 0, y: 0, width: 1216, height: 966, top: 0 },
  zIndex: "-10",
  display: "block",
  visibility: "visible",
  bodyBg: "rgb(9, 9, 11)",          // body có bg opaque dark — che canvas
  htmlBg: "rgba(0, 0, 0, 0)",       // html transparent
  fg: "0 0% 98%",                   // CSS var đọc OK
  brand: "220 90% 65%",             // CSS var đọc OK
  isPainting: true                  // canvas.getContext('2d') trả non-null
}
```

**Kết luận từ snapshot:** Canvas tồn tại đúng vị trí, đúng size, JS có context, CSS variables resolve OK. Chỉ thiếu một thứ — body có bg opaque ở trên canvas (canvas `z-index: -10` nằm dưới body bg trong stacking order vì body không phải stacking context root).

Mình đã fix lần 5 bằng cách **chuyển `bg-background` từ `body` lên `html`** trong `landing/app/globals.css`:

```css
@layer base {
  * { @apply border-border; }

  html { @apply bg-background; }   /* MOVED HERE */

  body {
    @apply text-foreground antialiased;   /* bg-background removed */
    font-size: 16px;
    line-height: 1.6;
  }
  ...
}
```

Build lại + restart `npx serve out -p 3001`. User hard-refresh. **Vẫn không thấy gì.**

## Các giả thuyết đã loại trừ

| # | Hypothesis | Bằng chứng loại trừ |
|---|---|---|
| 1 | Canvas không mount | DevTools snapshot xác nhận canvas có trong DOM, kích thước đúng |
| 2 | useEffect không chạy | `pixelW = 1216` (≠ default 300) → resize() đã chạy |
| 3 | JS error | Console clean |
| 4 | reduced-motion / hover:none block | `window.matchMedia(...).matches` cả 2 đều false |
| 5 | CSS var không resolve | `fg = "0 0% 98%"`, `brand = "220 90% 65%"` |
| 6 | Hydration error | Console không có React #418 |
| 7 | Tailwind purge | Canvas không phụ thuộc Tailwind class — chỉ inline render qua canvas API |
| 8 | Body bg che (lần 5 trước fix) | Đã xác nhận, đã fix bằng cách chuyển bg lên html |

## Các giả thuyết CÒN LẠI (cần kiểm tra)

1. **Section nào đó có bg phủ toàn viewport** (Hero, Install, TrayPreviewSection — tất cả đã modified). Một component con có `min-h-screen bg-background` hoặc `<main>` có opaque bg sẽ che canvas dù canvas ở `z: -10`.

2. **Service Worker cache** — Next.js export có thể có service worker từ build cũ phục vụ HTML/JS cũ. Cần check Application tab → Service Workers + Storage → Clear site data.

3. **Browser cache JS** — User có thể chưa thực sự hard-refresh (Ctrl+Shift+R). Cần verify ở Network tab xem `_next/static/chunks/...` có hash mới hay không.

4. **`<canvas>` chính xác KHÔNG có pixel data dù `isPainting: true`** — Có thể canvas đã `clearRect()` trong `drawStatic()` nhưng `arc()` với radius 1.0 ở DPR 1 vẽ ra subpixel quá nhỏ Chrome không render. Hoặc `staticColor.a = 0.14 * 1` trong dark mode = trắng 14% alpha trên nền tối — có thể quá mờ trên màn hình.

5. **DPR setting sai** — Chrome có thể trả `devicePixelRatio = 1` nhưng canvas internal coords lệch.

6. **`drawStatic()` chỉ vẽ 1 lần lúc mount, sau đó CSS variables thay đổi (do hydration script chạy sau và set `.dark` class) khiến color stale**, nhưng theme MutationObserver chỉ trigger redraw khi `rafId === 0` — có thể có race condition.

7. **Section nào đó có position fixed/absolute với bg cover full screen** đè lên canvas.

## Files cần đọc

### Spec & plan (đầy đủ context):
- `docs/superpowers/specs/2026-05-19-cursor-repulsion-dot-grid-design.md`
- `docs/superpowers/plans/2026-05-19-cursor-repulsion-dot-grid.md`

### Implementation hiện tại (lần 5):
- `landing/components/BackgroundDotGrid.tsx` — full canvas implementation
- `landing/lib/dotGrid.ts` — pure helpers (parseHslVar, lerpRgba, falloff, buildGrid)
- `landing/lib/dotGrid.test.ts` — 11 unit tests pass
- `landing/app/globals.css` — đã chuyển bg-background từ body lên html
- `landing/app/layout.tsx` — mount `<BackgroundDotGrid />` ở root, có script hydration set `.dark` class trước paint

### Sections có thể che canvas:
- `landing/app/[lang]/page.tsx`
- `landing/components/sections/Hero.tsx`
- `landing/components/sections/Install.tsx`
- `landing/components/sections/TrayPreviewSection.tsx`
- `landing/components/Navigation.tsx`

## Test environment

- OS: Windows 11 Enterprise
- Browser: Chrome desktop, hover device, không reduced-motion
- Server: `npx serve out -p 3001` (background task ID `bapm00ig6`)
- URL: `http://localhost:3001/en/`
- Theme đang test: dark (OS dark)
- Background task chạy tại: `C:\Users\nguye\AppData\Local\Temp\claude\d--SmoothScroll\b78b24b2-99f6-4968-a0f8-77711b2b226f\tasks\bapm00ig6.output`

## Yêu cầu cho Debug Agent

1. **Tìm root cause THỰC SỰ.** 5 lần đã thử guess + patch + build + nhờ user verify, đều fail. Cần một full pass:
   - Mở `http://localhost:3001/en/` bằng Playwright headful hoặc browser MCP
   - Inject debug script: count dots vẽ ra (drawFrame `for...of grid` đếm), log mỗi 60 frame
   - Check Layers panel: canvas có ở compositing layer riêng không? Có element nào đè lên không?
   - Paint flashing: bật trong DevTools Rendering, di chuột — vùng quanh cursor có repaint không?
   - `getComputedStyle(canvas).backgroundColor`, `getComputedStyle(canvas.parentElement).backgroundColor`, walk all ancestors xem element nào opaque
   - Inspect mọi `<section>`, `<main>` xem có bg cover không
   - Check service worker: `navigator.serviceWorker.getRegistrations()`

2. **Verify bằng VISUAL evidence**, không chỉ bằng "code looks correct". DOM update không đảm bảo paint. Console no-error không đảm bảo render.

3. **Implement fix đúng tận gốc.** Không patch/workaround. Nếu cần đổi approach (canvas → SVG → WebGL → Houdini Paint Worklet), nói rõ lý do.

4. **Constraint vẫn giữ:**
   - Tôn trọng `prefers-reduced-motion` và `hover: none`
   - Subtle, không lag
   - Toàn page scope
   - Cảm giác "antigravity" repulsion + lerp màu brand
   - INFLUENCE_RADIUS=220, MAX_PUSH=14, GAP=22

5. **Đừng push.** User chưa cho push. Verify ở local trước, đợi user confirm visual.
