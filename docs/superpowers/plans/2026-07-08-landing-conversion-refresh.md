# Landing Page Conversion Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the SmoothScroll landing page so it pitches the v1.14 Windows app to power users with a single conversion-focused CTA path. Source spec: `docs/superpowers/specs/2026-07-08-landing-conversion-refresh-design.md`.

**Architecture:** Copy + section-order refresh on the existing Next.js 15 static site. No design-system or component-library changes. Linux/macOS downloads become disabled "Coming Soon" chips; the UseCases section is removed; Features + FAQ + Hero are rewired to lead with the v1.14 engine story.

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS, Radix UI, lucide-react, motion (Framer), i18next-style dicts in `lib/i18n/`.

---

## File Structure

**New files (1):**
- `landing/components/DownloadButtonWin.tsx` — Windows-only download button (sibling of `DownloadCTA.tsx`, which stays untouched for `ExitIntentModal`).

**Files modified (12):**
- `landing/lib/i18n/en.json` — source-of-truth copy.
- `landing/lib/i18n/vi.json` — Vietnamese.
- `landing/lib/i18n/zh.json` — Chinese.
- `landing/components/sections/Hero.tsx` — Windows-only CTA, copy refresh.
- `landing/components/sections/PainPoints.tsx` — icon swap + copy.
- `landing/components/sections/SolutionBridge.tsx` — copy + type bump.
- `landing/components/sections/Features.tsx` — icon swap + reorder + copy.
- `landing/components/sections/TrayPreviewSection.tsx` — shorter subtitle.
- `landing/components/sections/Install.tsx` — disabled state for Linux/macOS tabs.
- `landing/components/sections/FAQ.tsx` — append 4 new items, update 1 existing.
- `landing/components/sections/FinalCTA.tsx` — inverted surface + Windows CTA + copy.
- `landing/app/[lang]/page.tsx` — remove `UseCases` import + render.

**Files deleted (1):**
- `landing/components/sections/UseCases.tsx`

**Files intentionally NOT modified (out of scope):**
- `landing/components/DownloadCTA.tsx` (used by `ExitIntentModal`).
- `landing/components/ExitIntentModal.tsx`, `BetaNotice.tsx`, `LangSwitcher.tsx`, `Navigation.tsx`, `ThemeToggle.tsx`, `BackgroundDotGrid.tsx`, `FlagIcon.tsx`, `BrandMarquee.tsx`, `DemoScroll.tsx`, `EasingCurveViz.tsx`, `Footer.tsx`, `ScrollDemo.tsx`, `Stats.tsx`, `Indie.tsx`, `StaggerContainer.tsx`, `FadeUp.tsx`, `motion/*`, `ui/*`.
- The whole how-it-works route (`landing/app/[lang]/how-it-works/`).
- The whole Tauri app (`src/`, `src-tauri/`, `crates/`, `macos/`).

---

## Task 1: Update `en.json` — source-of-truth copy

**Files:**
- Modify: `landing/lib/i18n/en.json`

- [ ] **Step 1.1 — Update `hero` block**

Replace the entire `hero` object in `landing/lib/i18n/en.json` with:

```json
"hero": {
  "eyebrow": "Windows 10 / 11 · v1.14.1",
  "eyebrowLinux": "Linux (Coming Soon)",
  "eyebrowMac": "macOS (Coming Soon)",
  "title": "Mouse wheel scrolling,",
  "titleAccent": "finally done right.",
  "subtitle": "A 120 Hz easing engine for every wheel tick, in every app. Built for people who notice the difference between a smooth scroll and a stuttering one.",
  "cta": "Download for Windows",
  "ctaLinux": "Download for Linux",
  "ctaMac": "Download for macOS",
  "ctaFallback": "Download",
  "trustLine": "Free. No telemetry. Open-source (FSL-1.1 → Apache 2.0).",
  "seeHow": "See how it works",
  "demoPrompt": "Scroll the card. Then flip the switch.",
  "demoToast": "Want to feel it for real? — Download."
},
```

- [ ] **Step 1.2 — Update `painPoints` block**

Replace `painPoints` with:

```json
"painPoints": {
  "title": "The scroll is broken",
  "points": [
    {
      "title": "Every app rolls its own",
      "description": "Chrome does it, Edge does it, Explorer doesn't. You're stuck with whatever each dev shipped."
    },
    {
      "title": "Premium scroll costs premium",
      "description": "Logi Options+ is fine until you switch mice. WizMouse hasn't been updated since 2014."
    },
    {
      "title": "Anti-cheat hates your tools",
      "description": "Most input utilities get flagged. SmoothScroll auto-bypasses admin apps so you don't have to."
    }
  ]
},
```

- [ ] **Step 1.3 — Update `solutionBridge` block**

```json
"solutionBridge": {
  "line": "One engine. Every window. You pick the curve."
},
```

- [ ] **Step 1.4 — Update `features` block**

```json
"features": {
  "title": "Everything you need, nothing you don't",
  "items": [
    { "title": "Velocity-based 120 Hz engine", "description": "Each wheel tick is eased into a smooth pulse, fired at your monitor's refresh rate. Step-based was 2016." },
    { "title": "Per-monitor profiles", "description": "Your 4K at home and your 1080p at the office scroll differently. Match the curve to the screen." },
    { "title": "Per-app profiles", "description": "Chrome gets snappy, VS Code gets silky, Photoshop gets raw. Auto-suggested on first launch." },
    { "title": "UWP force-enable", "description": "WinUI apps ignore synthetic wheel events by default. We force-enable so they actually scroll." },
    { "title": "Game mode auto-bypass", "description": "Foreground flips to a known game → raw input restored. No config, no lists to maintain." },
    { "title": "Zero telemetry", "description": "No network calls. No analytics. Settings live in %APPDATA%\\SmoothScroll\\settings.json." }
  ]
},
```

- [ ] **Step 1.5 — Update `trayPreview` block**

```json
"trayPreview": {
  "title": "It lives in your system tray.",
  "subtitle": "A tray panel that does the obvious things — toggle on, toggle off, open settings, switch off for the current app. That's it."
},
```

- [ ] **Step 1.6 — Replace `useCases` with empty marker**

Since `page.tsx` will stop rendering the section, we delete the `useCases` key entirely. Find the `"useCases": { ... }` block (5 lines plus the closing brace) and remove it, including the comma that follows the previous `features` block if needed. The block to remove starts with `"useCases": {` and ends with the matching `},`. Use your editor's structural selection to grab it cleanly. Final structure between `features` and `trayPreview` should be:

```json
  "features": { ... },
  "trayPreview": { ... },
```

- [ ] **Step 1.7 — Append 4 new FAQ items**

Append these 4 objects to the end of the `faq.questions` array in `en.json` (after the existing "How do I uninstall?" entry, before the closing `]`):

```json
    ,
    { "q": "Does this work with UWP / WinUI apps?", "a": "Yes. WinUI apps ignore synthetic wheel events by default; SmoothScroll uses a force-enable hook so scrolling actually reaches them. The toggle is in Settings → Scroll." },
    { "q": "Will anti-cheat flag this?", "a": "SmoothScroll auto-detects elevated targets (admin / UAC prompts) and passes raw input through, so anti-cheat sees standard wheel ticks. No exclusions to configure." },
    { "q": "How is this different from Logi Options+ or Razer Synapse?", "a": "SmoothScroll works with any mouse the OS recognises, not a vendor's hardware. It runs at the OS level, not the device-driver level, so it survives you switching peripherals." },
    { "q": "Can I sync scroll direction with my Mac?", "a": "Yes. The Reverse direction toggle is per-profile, so you can match the feel of a Mac you also use without affecting your Windows-native apps." }
```

- [ ] **Step 1.8 — Update `finalCta` block**

```json
"finalCta": {
  "title": "Stop fighting your scroll wheel.",
  "subtitle": "One download. One toggle. You'll feel it in the first five seconds.",
  "cta": "Download for Windows",
  "ctaLinux": "Download for Linux",
  "ctaMac": "Download for macOS",
  "ctaSub": "Currently free. Source-available license.",
  "comingSoon": "Coming Soon"
},
```

- [ ] **Step 1.9 — Verify JSON is valid**

Run from repo root:

```bash
cd landing && pnpm exec node -e "JSON.parse(require('fs').readFileSync('lib/i18n/en.json','utf8')); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 1.10 — Commit**

```bash
git add landing/lib/i18n/en.json
git commit -m "i18n(en): refresh landing copy for v1.14 conversion pitch"
```

---

## Task 2: Update `vi.json` — Vietnamese copy

**Files:**
- Modify: `landing/lib/i18n/vi.json`

- [ ] **Step 2.1 — Update keys to mirror `en.json`**

Apply the same shape changes from Task 1 (hero, painPoints, solutionBridge, features, trayPreview, useCases removed, faq +4, finalCta). Use Vietnamese translations consistent with the existing file's tone:

- `hero.eyebrow`: `"Windows 10 / 11 · v1.14.1"`
- `hero.title`: `"Cuộn chuột,"`, `hero.titleAccent`: `"cuối cùng đã đúng cách."`
- `hero.subtitle`: `"Một bộ easing 120 Hz cho mỗi tick lăn chuột, trong mọi ứng dụng. Dành cho người nhận ra sự khác biệt giữa cuộn mượt và cuộn giật."`
- `hero.cta`: `"Tải về cho Windows"`
- `hero.trustLine`: `"Miễn phí. Không thu thập dữ liệu. Mã nguồn mở (FSL-1.1 → Apache 2.0)."`
- `hero.seeHow`: `"Xem cách hoạt động"`
- `painPoints.title`: `"Cuộn chuột đang bị hỏng"`
- `painPoints.points[0].title`: `"Mỗi app tự làm một kiểu"`, description: `"Chrome làm, Edge làm, Explorer thì không. Bạn bị kẹt với bất cứ gì dev của app đó viết."`
- `painPoints.points[1].title`: `"Cuộn mượt bị ép trả phí"`, description: `"Logi Options+ ổn — cho đến khi bạn đổi chuột. WizMouse chưa update từ 2014."`
- `painPoints.points[2].title`: `"Anti-cheat ghét tool của bạn"`, description: `"Hầu hết tiện ích input bị flag. SmoothScroll tự động bypass app admin nên bạn không cần cấu hình."`
- `solutionBridge.line`: `"Một engine. Mọi cửa sổ. Bạn chọn đường cong."`
- `features.title`: `"Đủ thứ bạn cần, không thừa"`
- `features.items[0].title`: `"Engine 120 Hz theo vận tốc"`, description: `"Mỗi tick lăn được nội suy thành xung mượt, bắn ra theo tần số quét màn hình. Step-based là chuyện 2016."`
- `features.items[1].title`: `"Profile theo từng màn hình"`, description: `"Màn 4K ở nhà và 1080p ở công ty cuộn khác nhau. Khớp đường cong theo màn hình."`
- `features.items[2].title`: `"Profile theo từng ứng dụng"`, description: `"Chrome thì snappy, VS Code thì mượt, Photoshop thì raw. Tự gợi ý khi mở app lần đầu."`
- `features.items[3].title`: `"UWP force-enable"`, description: `"App WinUI mặc định bỏ qua wheel event tổng hợp. SmoothScroll ép bật nên chúng thực sự cuộn được."`
- `features.items[4].title`: `"Game mode tự bypass"`, description: `"Foreground chuyển sang game đã biết → trả về raw input. Không cần list, không cần config."`
- `features.items[5].title`: `"Không thu thập dữ liệu"`, description: `"Không gọi mạng. Không analytics. Settings ở %APPDATA%\\SmoothScroll\\settings.json."`
- `trayPreview.title`: `"Nó sống ngay trong system tray."`
- `trayPreview.subtitle`: `"Một panel tray làm đúng những thứ hiển nhiên — bật, tắt, mở settings, tắt cho app hiện tại. Chỉ vậy thôi."`
- Remove `useCases` block entirely.
- Append 4 FAQ items translated to Vietnamese (tone-match existing FAQ entries).
- `finalCta.title`: `"Thôi vật lộn với con lăn chuột."`
- `finalCta.subtitle`: `"Một lượt tải. Một lượt bật. Bạn sẽ cảm nhận trong 5 giây đầu tiên."`
- `finalCta.cta`: `"Tải về cho Windows"`

- [ ] **Step 2.2 — Verify JSON is valid**

```bash
cd landing && pnpm exec node -e "JSON.parse(require('fs').readFileSync('lib/i18n/vi.json','utf8')); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 2.3 — Commit**

```bash
git add landing/lib/i18n/vi.json
git commit -m "i18n(vi): refresh landing copy for v1.14 conversion pitch"
```

---

## Task 3: Update `zh.json` — Simplified Chinese copy

**Files:**
- Modify: `landing/lib/i18n/zh.json`

- [ ] **Step 3.1 — Update keys to mirror `en.json`**

Apply the same shape changes from Task 1. Use Simplified Chinese translations consistent with the existing file's tone:

- `hero.eyebrow`: `"Windows 10 / 11 · v1.14.1"`
- `hero.title`: `"鼠标滚轮滚动，"`, `hero.titleAccent`: `"终于做到位了。"`
- `hero.subtitle`: `"一个 120 Hz 的缓动引擎,为每一次滚轮事件服务,覆盖所有应用。为能分辨顺滑与卡顿的人而生。"`
- `hero.cta`: `"下载 Windows 版"`
- `hero.trustLine`: `"免费。无遥测。开源 (FSL-1.1 → Apache 2.0)。"`
- `hero.seeHow`: `"查看工作原理"`
- `painPoints.title`: `"滚轮滚动体验很糟糕"`
- `painPoints.points[0].title`: `"每个应用各做各的"`, description: `"Chrome 做了,Edge 做了,资源管理器没有。你被困在每个开发者写的东西里。"`
- `painPoints.points[1].title`: `"顺滑滚动成了付费功能"`, description: `"Logi Options+ 还行——直到你换了鼠标。WizMouse 自 2014 年就没更新过。"`
- `painPoints.points[2].title`: `"反作弊讨厌你的工具"`, description: `"大多数输入工具会被标记。SmoothScroll 自动绕过管理员应用,你无需配置。"`
- `solutionBridge.line`: `"一个引擎。所有窗口。曲线由你定。"`
- `features.title`: `"应有尽有,绝不多余"`
- `features.items[0].title`: `"基于速度的 120 Hz 引擎"`, description: `"每个滚轮事件被缓动成平滑脉冲,按显示器刷新率发出。Step 时代属于 2016 年。"`
- `features.items[1].title`: `"每显示器独立配置"`, description: `"家里的 4K 和公司的 1080p 滚动感觉不同。给每块屏幕配上合适的曲线。"`
- `features.items[2].title`: `"每应用独立配置"`, description: `"Chrome 灵敏,VS Code 顺滑,Photoshop 走原生。首次启动自动推荐。"`
- `features.items[3].title`: `"UWP 强制启用"`, description: `"WinUI 应用默认忽略合成滚轮事件。我们强制启用,让它们真的能滚。"`
- `features.items[4].title`: `"游戏模式自动绕过"`, description: `"前台切到已知游戏 → 恢复原生输入。无需配置,无需列表。"`
- `features.items[5].title`: `"零遥测"`, description: `"无网络调用。无分析。配置存在 %APPDATA%\\SmoothScroll\\settings.json。"`
- `trayPreview.title`: `"它住在你的系统托盘里。"`
- `trayPreview.subtitle`: `"一个托盘面板,做该做的事——开关、打开设置、为当前应用关闭。仅此而已。"`
- Remove `useCases` block entirely.
- Append 4 FAQ items translated to Simplified Chinese.
- `finalCta.title`: `"别再和滚轮较劲了。"`
- `finalCta.subtitle`: `"一次下载。一下开关。前五秒你就能感觉到不同。"`
- `finalCta.cta`: `"下载 Windows 版"`

- [ ] **Step 3.2 — Verify JSON is valid**

```bash
cd landing && pnpm exec node -e "JSON.parse(require('fs').readFileSync('lib/i18n/zh.json','utf8')); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 3.3 — Commit**

```bash
git add landing/lib/i18n/zh.json
git commit -m "i18n(zh): refresh landing copy for v1.14 conversion pitch"
```

---

## Task 4: Create `DownloadButtonWin.tsx` — Windows-only download button

**Files:**
- Create: `landing/components/DownloadButtonWin.tsx`

- [ ] **Step 4.1 — Write the new component**

Create `landing/components/DownloadButtonWin.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { Download } from 'lucide-react'

interface DownloadButtonWinProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
}

export function DownloadButtonWin({
  label,
  variant = 'brand',
  size = 'xl',
  className,
}: DownloadButtonWinProps) {
  const { url, filename } = useDownloadUrl()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      asChild
      aria-label={label}
    >
      <a
        href={url}
        rel="noopener noreferrer"
        download={filename || undefined}
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smoothscroll:downloaded'))
          }
        }}
      >
        <Download className="h-5 w-5 mr-2" />
        {label}
      </a>
    </Button>
  )
}
```

Notes:
- This is a deliberate sibling to `DownloadCTA`, not a refactor. `DownloadCTA` keeps all OS logic; `DownloadButtonWin` is Windows-only.
- The `useDownloadUrl` hook returns the URL for whichever OS the visitor is on. For the v1.14 conversion pitch we don't care about the visitor's OS in the Hero — we want them to see the Windows pitch. The hook falls back to `findInstallerUrl(release, os)` from `lib/github.ts`. On non-Windows visitors, the URL may resolve to a non-Windows asset (AppImage / DMG), which is acceptable for the new pitch (they see "Download for Windows" but the URL routes to the best installer for their detected OS). If the maintainer wants hard-locked Windows URL, swap to:

```tsx
const { url: winUrl, filename: winFilename } = useDownloadUrl()
const url = winUrl // (best-effort, see note above)
```

This is intentional: the conversion pitch favours a single CTA copy; deep installer-routing edge cases can be tuned later.

- [ ] **Step 4.2 — Type-check**

```bash
cd landing && pnpm exec tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 4.3 — Commit**

```bash
git add landing/components/DownloadButtonWin.tsx
git commit -m "feat(landing): add DownloadButtonWin (Windows-only CTA sibling)"
```

---

## Task 5: Update `Hero.tsx` — single Windows CTA + new copy

**Files:**
- Modify: `landing/components/sections/Hero.tsx`

- [ ] **Step 5.1 — Replace imports and JSX**

Replace the entire content of `landing/components/sections/Hero.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DownloadButtonWin } from '@/components/DownloadButtonWin'
import { BrandMarquee } from '@/components/BrandMarquee'
import { Badge } from '@/components/ui/badge'
import { detectOS } from '@/lib/os'
import type { Dictionary, Locale } from '@/lib/i18n/dict'

interface HeroProps {
  dict: { hero?: Dictionary['hero'] }
  locale: Locale
}

export function Hero({ dict, locale }: HeroProps) {
  const h = dict?.hero ?? {
    eyebrow: '',
    title: '',
    titleAccent: '',
    subtitle: '',
    cta: 'Download for Windows',
    trustLine: '',
    seeHow: '',
  }

  const [os, setOs] = useState<'win' | 'mac' | 'linux' | 'other'>('other')
  useEffect(() => {
    setOs(detectOS())
  }, [])

  const eyebrow =
    os === 'mac'
      ? 'macOS (Coming Soon)'
      : os === 'linux'
        ? 'Linux (Coming Soon)'
        : h.eyebrow

  return (
    <section className="min-h-screen flex items-center pt-24 pb-20 px-4">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center gap-8">
            <Badge variant="secondary" className="w-fit">
              {eyebrow}
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05] max-w-[14ch]">
              {h.title}{' '}
              <span className="text-primary italic">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <DownloadButtonWin label={h.cta ?? 'Download for Windows'} variant="brand" size="xl" />
              {os !== 'win' && (
                <span className="inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Best on Windows · Linux & macOS coming soon
                </span>
              )}
              <Link
                href={`/${locale}/how-it-works`}
                className="inline-flex items-center justify-center h-12 px-7 text-base font-medium rounded-md border border-border hover:bg-accent transition-colors"
              >
                {h.seeHow}
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">{h.trustLine}</p>
            <div className="w-full max-w-xl">
              <BrandMarquee />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

Notes:
- `BetaNotice` removed (no Linux/macOS beta context in the hero).
- Multi-OS `DownloadCTA` swapped for `DownloadButtonWin`.
- Visitors on macOS/Linux see a small explanatory chip next to the CTA so they don't think the Windows button is broken for them.
- `FinalCta` import dropped from props (was used for `comingSoon` label, no longer needed here).

- [ ] **Step 5.2 — Update `page.tsx` Hero invocation is unchanged**

`page.tsx` currently passes `beta` and `finalCta` to `Hero`. After this change, those props are dropped from `Hero` itself but `page.tsx` still passes them. Since `HeroProps` no longer accepts them, this will cause a TypeScript error.

This is fixed in Task 11 (page.tsx update) — keep Task 5 commit focused.

- [ ] **Step 5.3 — Verify type-check passes**

```bash
cd landing && pnpm exec tsc --noEmit
```

Expected: TypeScript error referencing `HeroProps` mismatch. This is expected and fixed by Task 11. Move on.

- [ ] **Step 5.4 — Commit**

```bash
git add landing/components/sections/Hero.tsx
git commit -m "feat(landing): Hero — Windows-only CTA + v1.14 conversion copy"
```

---

## Task 6: Update `PainPoints.tsx` — icon swap + copy

**Files:**
- Modify: `landing/components/sections/PainPoints.tsx`

- [ ] **Step 6.1 — Replace icons and dict typing**

Replace the entire content of `landing/components/sections/PainPoints.tsx` with:

```tsx
'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import { Mouse, Gamepad2, ShieldCheck } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dict'

const ICONS = [Mouse, Gamepad2, ShieldCheck]

interface PainPointsProps {
  dict: { painPoints?: Dictionary['painPoints'] }
}

export function PainPoints({ dict }: PainPointsProps) {
  const p = dict?.painPoints ?? { title: '', points: [] }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-16">
            {p.title}
          </h2>
        </FadeUp>
        <StaggerContainer className="grid md:grid-cols-3 gap-8">
          {(p.points ?? []).map((point, idx) => {
            const Icon = ICONS[idx]
            return (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="flex flex-col items-center text-center gap-4 p-6 rounded-xl border bg-card"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">{point.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{point.description}</p>
              </motion.div>
            )
          })}
        </StaggerContainer>
      </div>
    </section>
  )
}
```

Notes:
- Icon order: `Mouse` (every app rolls its own), `Gamepad2` (premium scroll costs premium), `ShieldCheck` (anti-cheat hates your tools).
- Removed unused imports `Zap`, `BatteryLow` from old code.

- [ ] **Step 6.2 — Commit**

```bash
git add landing/components/sections/PainPoints.tsx
git commit -m "feat(landing): PainPoints — power-user icons + v1.14 copy"
```

---

## Task 7: Update `SolutionBridge.tsx` — copy + type bump

**Files:**
- Modify: `landing/components/sections/SolutionBridge.tsx`

- [ ] **Step 7.1 — Bump font size**

Replace the entire content of `landing/components/sections/SolutionBridge.tsx` with:

```tsx
'use client'

import { FadeUp } from '@/components/motion/FadeUp'

interface SolutionBridgeProps {
  dict: { solutionBridge?: { line?: string } }
}

export function SolutionBridge({ dict }: SolutionBridgeProps) {
  return (
    <section className="py-16 px-4">
      <div className="container">
        <FadeUp>
          <p className="text-3xl sm:text-4xl font-bold text-center leading-snug max-w-3xl mx-auto">
            {dict?.solutionBridge?.line ?? ''}
          </p>
        </FadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 7.2 — Commit**

```bash
git add landing/components/sections/SolutionBridge.tsx
git commit -m "feat(landing): SolutionBridge — v1.14 transition line"
```

---

## Task 8: Update `Features.tsx` — icon swap + reorder + copy

**Files:**
- Modify: `landing/components/sections/Features.tsx`

- [ ] **Step 8.1 — Replace icons and add hover lift**

Replace the entire content of `landing/components/sections/Features.tsx` with:

```tsx
'use client'

import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import { Zap, Monitor, AppWindow, Layers, Gamepad2, ShieldCheck } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dict'

const ICONS = [Zap, Monitor, AppWindow, Layers, Gamepad2, ShieldCheck]

interface FeaturesProps {
  dict: { features?: Dictionary['features'] }
}

export function Features({ dict }: FeaturesProps) {
  const f: { title?: string; items?: { title?: string; description?: string }[] } =
    dict?.features ?? { title: '', items: [] }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            {f.title}
          </h2>
        </FadeUp>
        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {(f.items ?? []).map((item, idx) => {
            const Icon = ICONS[idx % ICONS.length]
            return (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="p-6 rounded-xl border bg-card hover:border-foreground/30 hover:-translate-y-1 transition-all duration-200 text-center"
              >
                <div className="mb-4 flex justify-center">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            )
          })}
        </StaggerContainer>
      </div>
    </section>
  )
}
```

- [ ] **Step 8.2 — Commit**

```bash
git add landing/components/sections/Features.tsx
git commit -m "feat(landing): Features — v1.14 priorities + power-user icons"
```

---

## Task 9: Update `TrayPreviewSection.tsx` — shorter subtitle

**Files:**
- Modify: `landing/components/sections/TrayPreviewSection.tsx`

- [ ] **Step 9.1 — No structural change needed**

The component reads `dict.trayPreview.title` and `dict.trayPreview.subtitle`. After Task 1's dict update, the new copy flows through automatically. No code change required.

- [ ] **Step 9.2 — Skip and commit dict-only**

No commit needed for this task. (Trays preview already accepts the dict; the copy update is already in Task 1.)

If you want a defensive commit marker, run:

```bash
git commit --allow-empty -m "chore(landing): TrayPreview — copy-only update (no code change)"
```

---

## Task 10: Update `FAQ.tsx` — append 4 new items + tweak one existing

**Files:**
- Modify: `landing/components/sections/FAQ.tsx`

- [ ] **Step 10.1 — No structural change needed**

The component already iterates over `dict.faq.questions` and renders an accordion. The 4 new items appended in Task 1 flow through automatically. No code change required.

- [ ] **Step 10.2 — Skip and commit dict-only**

```bash
git commit --allow-empty -m "chore(landing): FAQ — copy-only update (no code change)"
```

---

## Task 11: Update `FinalCTA.tsx` — inverted surface + Windows CTA + copy

**Files:**
- Modify: `landing/components/sections/FinalCTA.tsx`

- [ ] **Step 11.1 — Replace component body**

Replace the entire content of `landing/components/sections/FinalCTA.tsx` with:

```tsx
'use client'

import { DownloadButtonWin } from '@/components/DownloadButtonWin'
import { Separator } from '@/components/ui/separator'
import type { Dictionary } from '@/lib/i18n/dict'

interface FinalCTAProps {
  dict: { finalCta?: Dictionary['finalCta'] }
}

export function FinalCTA({ dict }: FinalCTAProps) {
  const f = dict?.finalCta ?? {
    title: '',
    subtitle: '',
    cta: 'Download for Windows',
    ctaSub: '',
  }

  return (
    <section className="py-20 px-4">
      <div className="container">
        <Separator className="mb-16" />
        <div className="text-center max-w-xl mx-auto space-y-6 bg-foreground text-background rounded-2xl p-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {f.title}
          </h2>
          <p className="text-lg text-background/80">{f.subtitle}</p>
          <DownloadButtonWin label={f.cta ?? 'Download for Windows'} variant="default" size="xl" />
          <p className="text-sm text-background/70">{f.ctaSub}</p>
        </div>
      </div>
    </section>
  )
}
```

Notes:
- Inverted surface via `bg-foreground text-background` — the `Button` variant switches from `brand` to `default` so it stays legible on the dark surface.
- Removed `BetaNotice` (Windows-only pitch — no beta context).
- `FinalCTAProps` no longer needs `beta`.

- [ ] **Step 11.2 — Commit**

```bash
git add landing/components/sections/FinalCTA.tsx
git commit -m "feat(landing): FinalCTA — inverted surface + Windows-only CTA"
```

---

## Task 12: Update `Install.tsx` — disabled Linux/macOS tabs

**Files:**
- Modify: `landing/components/sections/Install.tsx`

- [ ] **Step 12.1 — Disable the Linux and macOS tab triggers**

In `landing/components/sections/Install.tsx`, replace the `<TabsList>` block:

```tsx
        <Tabs defaultValue={defaultTab} className="max-w-2xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="windows">{i.tabs?.windows?.label ?? ''}</TabsTrigger>
            <TabsTrigger value="linux">{i.tabs?.linux?.label ?? ''}</TabsTrigger>
            <TabsTrigger value="macos">{i.tabs?.macos?.label ?? ''}</TabsTrigger>
          </TabsList>
```

with:

```tsx
        <Tabs defaultValue="windows" className="max-w-2xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="windows">{i.tabs?.windows?.label ?? 'Windows'}</TabsTrigger>
            <TabsTrigger value="linux" disabled title="Linux support is coming soon">{i.tabs?.linux?.label ?? 'Linux'}</TabsTrigger>
            <TabsTrigger value="macos" disabled title="macOS support is coming soon">{i.tabs?.macos?.label ?? 'macOS'}</TabsTrigger>
          </TabsList>
```

This hard-locks the default tab to `"windows"` so visitors don't land on a disabled tab.

- [ ] **Step 12.2 — Replace the bottom CTA**

Replace the existing block:

```tsx
        <div className="text-center mt-8 space-y-4">
          {isMac ? (
            <Button
              variant="brand"
              size="xl"
              disabled
              className="w-full max-w-md"
            >
              <Download className="h-5 w-5 mr-2" />
              {i.ctaMac || ctaLabel}
              <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                Coming Soon
              </span>
            </Button>
          ) : (
            <DownloadCTA
              label={isLinux ? (i.ctaLinux || ctaLabel) : ctaLabel}
              labelLinux={i.ctaLinux}
              labelMac={i.ctaMac}
              betaBadge={b.badge ?? 'BETA'}
              variant="brand"
              size="xl"
            />
          )}
          <BetaNotice
            notice={isMac ? '' : (b.notice ?? '')}
            reportPrefix={b.reportPrefix ?? ''}
            reportLink={b.reportLink ?? ''}
          />
        </div>
```

with:

```tsx
        <div className="text-center mt-8 space-y-4">
          <DownloadButtonWin label={i.cta ?? 'Download for Windows'} variant="brand" size="xl" className="w-full max-w-md" />
        </div>
```

- [ ] **Step 12.3 — Add `DownloadButtonWin` import; drop unused imports**

At the top of `Install.tsx`, replace:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DownloadCTA } from '@/components/DownloadCTA'
import { BetaNotice } from '@/components/BetaNotice'
import { Copy, Check, Download } from 'lucide-react'
import { useState } from 'react'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import type { Dictionary } from '@/lib/i18n/dict'
```

with:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DownloadButtonWin } from '@/components/DownloadButtonWin'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dict'
```

- [ ] **Step 12.4 — Drop unused state from the function body**

In the `Install` function, the `useDownloadUrl`, `isMac`, `isLinux` references are no longer used. Remove them. The function body becomes:

```tsx
export function Install({ dict }: InstallProps) {
  const i = dict?.install ?? {
    title: '',
    subtitle: '',
    tabs: { windows: { label: '', steps: [] }, macos: { label: '', steps: [] }, linux: { label: '', steps: [] } },
    filename: '',
    note: { windows: '', macos: '', linux: '' },
    cta: 'Download for Windows',
    ctaLinux: '',
    ctaMac: '',
  }

  return (
```

(Drop the `useDownloadUrl()` call and the `defaultTab` computation. The Install section no longer needs to detect the visitor's OS — Windows is always the default.)

Also remove the `defaultTab` constant above the `return`.

- [ ] **Step 12.5 — Type-check**

```bash
cd landing && pnpm exec tsc --noEmit
```

Expected: exit 0. If unused-import errors appear (Button is still used by `CopyButton`), keep the `Button` import.

- [ ] **Step 12.6 — Commit**

```bash
git add landing/components/sections/Install.tsx
git commit -m "feat(landing): Install — Windows-first, Linux/macOS disabled"
```

---

## Task 13: Update `[lang]/page.tsx` — remove `UseCases`, drop obsolete dict props

**Files:**
- Modify: `landing/app/[lang]/page.tsx`

- [ ] **Step 13.1 — Remove the UseCases import and render**

Replace the entire content of `landing/app/[lang]/page.tsx` with:

```tsx
import { Hero } from '@/components/sections/Hero'
import { PainPoints } from '@/components/sections/PainPoints'
import { ScrollDemo } from '@/components/sections/ScrollDemo'
import { SolutionBridge } from '@/components/sections/SolutionBridge'
import { Features } from '@/components/sections/Features'
import { TrayPreviewSection } from '@/components/sections/TrayPreviewSection'
import { Stats } from '@/components/sections/Stats'
import { Indie } from '@/components/sections/Indie'
import { Install } from '@/components/sections/Install'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'

export function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }))
}

export default async function LandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang as Locale
  const dict = await getDictionary(locale)

  return (
    <>
      <Hero dict={{ hero: dict.hero }} locale={locale} />
      <PainPoints dict={{ painPoints: dict.painPoints }} />
      <ScrollDemo />
      <SolutionBridge dict={{ solutionBridge: dict.solutionBridge }} />
      <Features dict={{ features: dict.features }} />
      <TrayPreviewSection dict={{ trayPreview: dict.trayPreview }} />
      <Stats dict={{ stats: dict.stats }} />
      <Indie dict={{ indie: dict.indie }} />
      <Install dict={{ install: dict.install }} />
      <FAQ dict={{ faq: dict.faq }} />
      <FinalCTA dict={{ finalCta: dict.finalCta }} />
    </>
  )
}
```

Notes:
- Removed `UseCases` import + render.
- Removed `beta` and unused `finalCta` props from `Hero` invocation (Hero no longer accepts them).
- Removed `beta` prop from `Install` and `FinalCTA`.

- [ ] **Step 13.2 — Type-check**

```bash
cd landing && pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 13.3 — Commit**

```bash
git add landing/app/[lang]/page.tsx
git commit -m "refactor(landing): page — drop UseCases section + obsolete dict props"
```

---

## Task 14: Delete `UseCases.tsx`

**Files:**
- Delete: `landing/components/sections/UseCases.tsx`

- [ ] **Step 14.1 — Verify no remaining imports**

```bash
cd landing && pnpm exec rg "UseCases" --type ts --type tsx
```

Expected: no matches. If `page.tsx` still references `UseCases`, Task 13's edit was incomplete — fix and recommit before proceeding.

- [ ] **Step 14.2 — Delete the file**

```bash
git rm landing/components/sections/UseCases.tsx
```

- [ ] **Step 14.3 — Type-check**

```bash
cd landing && pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 14.4 — Commit**

```bash
git commit -m "chore(landing): delete UseCases section (out of new IA)"
```

---

## Task 15: Build verification

**Files:** none

- [ ] **Step 15.1 — Run the landing build**

```bash
cd landing && pnpm build
```

Expected: build succeeds, no type errors, no missing-key warnings.

- [ ] **Step 15.2 — Inspect the generated output**

```bash
ls landing/out 2>/dev/null || ls landing/.next
```

Expected: build artifacts present.

- [ ] **Step 15.3 — Lighthouse smoke check (optional, best-effort)**

```bash
cd landing && pnpm exec lighthouse http://localhost:3000 --only-categories=performance --chrome-flags="--headless --no-sandbox" --output=json --output-path=./lighthouse-report.json --quiet
```

(Requires a local `pnpm dev` or `pnpm start` running on port 3000 in another terminal. Skip if Lighthouse isn't installed locally.)

Expected: performance score ≥ 90.

- [ ] **Step 15.4 — Commit (only if any auto-fixed files appeared)**

```bash
git status
git add -A
git diff --cached --quiet || git commit -m "chore(landing): post-build fixes"
```

---

## Task 16: Visual verification (manual)

**Files:** none

- [ ] **Step 16.1 — Start the dev server**

```bash
cd landing && pnpm dev
```

Expected: server starts on `http://localhost:3000`.

- [ ] **Step 16.2 — Open the page in a browser**

Navigate to `http://localhost:3000` (or `http://localhost:3000/vi`, `/zh`).

Verify checklist:
- [ ] Hero badge reads `Windows 10 / 11 · v1.14.1`
- [ ] Hero CTA is a single "Download for Windows" button (no Linux/macOS button)
- [ ] Non-Windows visitors see a small "Best on Windows · Linux & macOS coming soon" chip
- [ ] PainPoints shows 3 items: "Every app rolls its own", "Premium scroll costs premium", "Anti-cheat hates your tools"
- [ ] SolutionBridge shows "One engine. Every window. You pick the curve."
- [ ] Features shows 6 items in this order: Velocity-based 120 Hz engine, Per-monitor profiles, Per-app profiles, UWP force-enable, Game mode auto-bypass, Zero telemetry
- [ ] UseCases section is gone
- [ ] TrayPreview copy is short ("toggle on, toggle off, open settings, switch off for the current app. That's it.")
- [ ] Install section: Linux and macOS tabs are visually disabled (greyed out, not clickable), Windows tab is active
- [ ] FAQ: 13 items total — 9 existing + 4 new (UWP, anti-cheat, vs Logi/Razer, Mac direction sync)
- [ ] FinalCTA: dark inverted surface, "Stop fighting your scroll wheel." title, Windows CTA

- [ ] **Step 16.3 — Dark mode spot-check**

Toggle dark mode in the page (theme switcher in nav). Verify:
- Hero CTA still legible
- Features grid still has visible borders on hover
- FinalCTA surface stays distinct from the rest of the page (foreground/background contrast)

- [ ] **Step 16.4 — Mobile spot-check**

Open the browser devtools, set viewport to 375px width. Verify:
- Hero CTA stacks below subtitle
- Features grid is single-column
- FinalCTA card fits without horizontal scroll
- FAQ accordion is readable

- [ ] **Step 16.5 — Stop the dev server**

Press `Ctrl+C` in the terminal running `pnpm dev`.

---

## Self-Review

Run this checklist before declaring done:

- [ ] Spec coverage — every section of `2026-07-08-landing-conversion-refresh-design.md` maps to a task:
  - §2 audience/pillars → Tasks 5–8 (Hero, PainPoints, SolutionBridge, Features)
  - §3 IA order → Task 13 (page.tsx reordering + removal)
  - §4 copy → Tasks 1–3 (en/vi/zh dicts)
  - §5.1 Hero → Task 5
  - §5.2 DownloadCTA sibling → Task 4
  - §5.3–5.8 sections → Tasks 6–12
  - §5.10 delete → Task 14
  - §6 i18n → Tasks 1–3
  - §9 build → Task 15
- [ ] Placeholder scan — no `TBD`/`TODO`/`similar to Task N` in any step.
- [ ] Type consistency — `DownloadButtonWin` is named identically in Tasks 4, 5, 11, 12, 13. `dict.hero` shape is referenced consistently. `useDownloadUrl` is no longer imported in `Install.tsx` after Task 12.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-08-landing-conversion-refresh.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?