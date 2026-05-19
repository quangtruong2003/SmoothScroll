# Ambient Dot Grid Effects — Design

**Date:** 2026-05-19
**Surface:** `landing/components/BackgroundDotGrid.tsx`
**Goal:** thêm 10 hiệu ứng ambient luôn chạy ở background, mỗi visit chọn ngẫu nhiên 1, đè magnet effect cursor lên trên.

## Constraints (chốt với user)

- Ambient **luôn chạy**, không phụ thuộc cursor idle.
- Cursor magnet effect (push/pull + glow) **cộng hưởng** lên trên ambient — không thay thế.
- Dots vẫn tắt khi cursor trên `CONTENT_TAGS` (hành vi hiện tại giữ nguyên).
- Tôn trọng `prefers-reduced-motion` cho phần dao động lớn (giảm biên độ, không tắt hẳn).
- 60 FPS budget: tổng work mỗi frame phải nằm trong ~5ms cho 1500-2500 dots ở 1280×800.

## Architecture

```
draw(t):
  for each dot i with grid position p:
    a = ambientFn(t, p, i)                  // direct math, no inertia
    target = magnetTarget(p, cursor, I)     // I = global magnet intensity
    dotState[i].lerp(target, DOT_LERP)      // per-dot inertia (magnet only)
    drawX = p.x + a.ox + dotState[i].ox
    drawY = p.y + a.oy + dotState[i].oy
    drawF = clamp01(a.f + dotState[i].f)
    drawDot(drawX, drawY, sizeFor(drawF), colorFor(drawF))
```

- `ambientFn` không cần inertia (function tự liên tục theo thời gian).
- Magnet vẫn lerp per-dot như hiện tại để tránh snap.
- rAF luôn chạy (ambient always-on).

## Effect Interface

```ts
type Effect = {
  name: string
  // Trả về offset tuyệt đối (px) và độ sáng phụ (0..1).
  // p: vị trí grid của dot
  // i: chỉ số dot (cho hash riêng nếu cần)
  // t: elapsed seconds since mount
  // ctx: viewport + reduced flag
  update(p: Point, i: number, t: number, ctx: Ctx): { ox: number; oy: number; f: number }
}
type Ctx = { vw: number; vh: number; reduced: boolean }
```

Mỗi effect là 1 pure function — đơn giản, test được.

## Selection

- Lúc mount: `Math.floor(Math.random() * effects.length)` → chọn 1 trong 10.
- Override để debug/QA: `?fx=<index>` query string (0..9).

## 10 Hiệu ứng

Tham số ở đây là khởi điểm — fine-tune sau khi visual.

| # | Tên | Math summary | Ampl. | F-boost |
|---|---|---|---|---|
| 1 | Ripple Pulse | Sóng tròn từ tâm, age cycle 3s, `pulse = sin(k(d-r))·exp(-((d-r)/σ)²)` | radial 8px | 0.5 |
| 2 | Wave LR | `oy = sin((p.x − v·t)/λ)` | y-axis 6px | 0.4 |
| 3 | Wave TB | `ox = sin((p.y − v·t)/λ)` | x-axis 6px | 0.4 |
| 4 | Diagonal Wave | `phase = (p.x + p.y − v·t)/λ` → cả ox và oy | both 5px | 0.4 |
| 5 | Twinkle Stars | per-dot phase từ hash(i); `f = max(0, sin(2t + φᵢ))^4 · 0.6` | 0 | 0.6 |
| 6 | Heartbeat | Global double-pulse "lub-dub" cycle 1s | 0 | 0.5 |
| 7 | Slow Breathing | `f = (sin(2π·t/6) + 1)/2 · 0.4` toàn cục | 0 | 0.4 |
| 8 | Floating Drift | `ox = sin(p.x·0.01 + 0.3t)·4`, `oy = cos(p.y·0.01 + 0.4t)·4` | both 4px | 0.15 |
| 9 | Wandering Comet | Comet path Lissajous; mỗi dot: hút yếu về comet + glow theo d/COMET_R | radial 3px | 0.7 ở gần comet |
| 10 | Galaxy Spin | Mỗi dot xoay quanh tâm với ω(r) = BASE/(r+50); offset = pos quay − pos gốc | tangential ~6px | 0.2 |

### Reduced motion behavior

- Effect #1, #2, #3, #4, #8, #9, #10 (có displacement): nhân biên độ với 0.25.
- Effect #5, #6, #7 (chỉ glow): giữ nguyên.

## Files

- `landing/lib/ambientEffects.ts` — 10 effect functions + `EFFECTS` array + `pickEffect()` helper.
- `landing/lib/ambientEffects.test.ts` — smoke tests: mỗi effect trả về số hữu hạn, biên độ trong giới hạn, không NaN.
- `landing/components/BackgroundDotGrid.tsx` — wire ambient vào drawFrame.

## Testing

- Unit: mỗi effect run với grid mock (5×5), 100 frame, assert `|ox| ≤ MAX`, `|oy| ≤ MAX`, `0 ≤ f ≤ 1`, không NaN.
- E2E: render với `?fx=0` đến `?fx=9`, smoke screenshot mỗi mode để regression visual; chỉ assert canvas có pixels khác 0 (không pixel-diff strict vì noise vẫn deterministic-enough nhờ seed `t=0`).
- Manual: rê chuột verify magnet vẫn hoạt động trên ambient.

## Out of scope

- Không thêm UI cho user chọn effect (ngoài query string debug).
- Không persist effect đã chọn giữa các visit.
- Không sound, không reactive với scroll.
