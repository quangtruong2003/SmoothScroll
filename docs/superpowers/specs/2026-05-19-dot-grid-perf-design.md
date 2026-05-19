# Dot Grid Performance Optimization — Design

**Date:** 2026-05-19
**Surface:** `landing/components/BackgroundDotGrid.tsx` (only)
**Goal:** Giảm CPU/GPU per frame 3-5x, giữ chất lượng visual đồng đẳng hoặc tốt hơn.

## Bối cảnh

Frame budget hiện tại:
- ~2500 dots ở 1280×800 (GAP=22).
- Per dot: position math (cheap) + một trong hai nhánh `arc + fill`:
  - **Static branch** (~95% dots khi idle): `beginPath + arc + fill` — JS→Canvas call overhead.
  - **Lit branch** (~5% gần cursor / trong ripple): set `shadowBlur + shadowColor`, `arc + fill` lần nữa với halo blur.
- Mousemove handler gọi `document.elementFromPoint(x, y)` mỗi mousemove event (~100Hz Chrome).
- rAF luôn chạy vì ambient.

Bottleneck đo qua review code:
1. **Canvas2D shadows** mỗi lit dot → composite + blur per draw call. Đây là cost lớn nhất.
2. **`elementFromPoint`** trong mousemove → forces layout recalc mỗi event.
3. **Per-dot `arc + fill`** cho static dots → 2500 JS→Canvas calls/frame.
4. **DPR=2 trên màn lớn** → backing store lên đến 33M pixels (4K).

## 4 Optimizations

### 1. Glow sprite (replaces shadowBlur)

Pre-render 1 offscreen canvas (~32×32 px) chứa dot có halo bằng radial gradient:

```
center: brand color, alpha=1
edge:   brand color, alpha=0
```

Khi vẽ lit dot: `ctx.globalAlpha = f; ctx.drawImage(sprite, dx, dy)`.

Bỏ hoàn toàn `shadowBlur`, `shadowColor`. Sprite được rebuild khi `theme` đổi (light↔dark).

Lợi ích:
- Loại bỏ shadow compositing (chậm hơn drawImage 5-10x).
- Halo gradient mượt hơn shadow box blur — tốt hơn về quality.
- DrawImage được GPU-accelerated trên hầu hết browser.

### 2. Path2D batch cho static dots

Tất cả dots ở "static branch" trong frame được gom vào 1 `Path2D`, fill 1 lần:

```
const staticPath = new Path2D()
for (...) staticPath.arc(x, y, DOT_RADIUS, 0, TAU)
ctx.fill(staticPath)
```

Lit dots vẫn vẽ riêng vì cần alpha + sprite riêng từng cái.

Lợi ích: 2500 calls → 1 fill call. JS overhead giảm rõ.

### 3. Throttle elementFromPoint vào rAF

Mousemove handler chỉ lưu `pendingX, pendingY, pendingDirty = true`.

Trong `tick()`, nếu `pendingDirty`:
```
if (pendingDirty) {
  const overContent = isOverContent(pendingX, pendingY)
  targetX = pendingX
  targetY = pendingY
  targetIntensity = overContent ? 0 : 1
  pendingDirty = false
}
```

`elementFromPoint` chạy max 60Hz thay vì 100Hz, đồng bộ với render → không gây layout thrash.

### 4. DPR floor cap

```ts
const rawDpr = window.devicePixelRatio || 1
const pixelBudget = 6_000_000  // ~6M pixels max
const naturalDpr = Math.min(rawDpr, 2)
const wouldBe = viewW * viewH * naturalDpr * naturalDpr
const dpr = wouldBe > pixelBudget
  ? Math.max(1, Math.sqrt(pixelBudget / (viewW * viewH)))
  : naturalDpr
```

Trên màn 1080p (2M pixels) DPR vẫn = 2 (8M > 6M → giảm xuống ~1.7). Trên màn 4K (8M) giảm DPR xuống ~0.87 → effective ~1.

Visual: ở mật độ dot 22px, dot radius 1-1.8px, không nhận ra khác biệt.

## Acceptance criteria

- E2E suite hiện tại (31 tests) phải vẫn pass.
- Trên 1280×800 monitor: average frame time idle < 4ms (target 240fps capable).
- Visual: side-by-side trước/sau không phân biệt được — hoặc sau đẹp hơn (gradient halo).

## Out of scope

- Không thay đổi effect math, magnet logic, theme handling.
- Không thêm WebGL / OffscreenCanvas Worker (overkill cho 2500 dots).
- Không thay đổi spec ambient (giữ 7 effects).

## Files

- Modify: `landing/components/BackgroundDotGrid.tsx` (single file, all 4 optimizations)
- No new files needed — sprite canvas là local variable trong useEffect.

## Testing

- Unit tests không liên quan (đã pass cho `dotGrid`, `ambientEffects`).
- E2E hiện có:
  - `dot-grid-overlay.spec.ts` — cursor on/off pixel diff (light + dark) → verify dots still light up.
  - `dot-grid-reduced-motion.spec.ts` → verify magnet works under reduced motion.
  - `dot-grid-ambient.spec.ts` (7 tests) → verify motion across time.
- Tất cả phải vẫn pass với assertions hiện có (5x lit pixels, brand-blue shift, frame fingerprint thay đổi).
