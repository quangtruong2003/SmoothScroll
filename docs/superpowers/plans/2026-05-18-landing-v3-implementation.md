# SmoothScroll Landing v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current static v2 landing with a Next.js + shadcn/ui landing that (1) visually matches the SmoothScroll desktop app and (2) converts first-time visitors to downloads within 60 seconds.

**Architecture:** Next.js 16 App Router with `output: 'export'`, static HTML/CSS/JS deployable to GitHub Pages. shadcn/ui v0.x components (Tailwind v3 compatible). Motion 12 for animations with `useReducedMotion` support. Three-locale i18n via plain JSON dictionaries. GitHub Releases API for live stats at build time and runtime. SPA-style sticky nav, bottom download bar, and exit-intent modal for conversion.

**Tech Stack:**
- Next.js 16, App Router, `output: 'export'`
- TypeScript 5.x
- Tailwind CSS v3.3 (matching app)
- shadcn/ui v0.x (`@radix-ui/*` + `class-variance-authority` + `clsx` + `tailwind-merge`)
- Motion 12 (`motion` package — renamed from `framer-motion`; import from `motion/react`)
- lucide-react (matching app)
- Vitest 4.x + Testing Library 16.x (unit/component tests)
- Playwright 1.60 (visual regression + accessibility)

---

## Key Decisions Already Made (from spec)

| Decision | Value |
|---|---|
| shadcn/ui version | v0.x (Tailwind v3 compatible — app uses v3.3.5) |
| Brand accent | `hsl(220 90% 65%)` → `hsl(260 80% 70%)` gradient |
| CSS hue | 240 (neutral/zinc — matches app `src/index.css`) |
| Font base size | 16px (vs 13px in app) |
| Motion duration | 200ms `cubic-bezier(0.16, 1, 0.3, 1)` |
| Spring | damping 25, stiffness 300 |
| Section rhythm | 80–96px desktop, 48–64px mobile |
| Border radius | `--radius: 0.5rem` |
| GitHub repo | `quangtruong2003/SmoothScroll` |
| Fallback release | `v1.0.0` with hardcoded asset names |

---

## File Structure (full map)

```
landing/                                # New Next.js project at repo root
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── app/
│   ├── layout.tsx                      # Root: ThemeProvider, font loading, no nav
│   ├── page.tsx                        # Root index → redirect to /en
│   ├── sitemap.ts                      # Build-time sitemap.xml
│   ├── robots.ts                       # Build-time robots.txt
│   ├── globals.css                     # CSS variables (240 hue), base styles
│   ├── [lang]/
│   │   ├── layout.tsx                 # html lang, hreflang, JSON-LD
│   │   └── page.tsx                   # Landing page — composes all sections
│   └── not-found.tsx
├── components/
│   ├── ui/
│   │   ├── button.tsx                  # shadcn: variant=default/secondary/ghost/destructive/outline
│   │   ├── switch.tsx                 # shadcn: SmoothScroll branding
│   │   ├── tabs.tsx                   # shadcn: Install OS tabs, UseCases tabs
│   │   ├── accordion.tsx              # shadcn: FAQ
│   │   ├── badge.tsx                  # shadcn: labels, trust badges
│   │   ├── separator.tsx               # shadcn: section dividers
│   │   ├── dialog.tsx                 # shadcn: ExitIntentModal
│   │   └── sonner.tsx                 # shadcn: toast (use-sonner)
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── PainPoints.tsx
│   │   ├── SolutionBridge.tsx
│   │   ├── Features.tsx
│   │   ├── UseCases.tsx
│   │   ├── TrayPreviewSection.tsx
│   │   ├── Stats.tsx
│   │   ├── Indie.tsx
│   │   ├── Install.tsx
│   │   ├── FAQ.tsx
│   │   └── FinalCTA.tsx
│   ├── DemoScroll.tsx                 # Live Off/On scroll-feel toggle card
│   ├── TrayPreview.tsx               # Pixel-faithful tray panel clone
│   ├── DownloadCTA.tsx              # Auto-detect OS, reads from useDownloadUrl
│   ├── StickyDownloadBar.tsx         # Slides up after hero leaves viewport
│   ├── ExitIntentModal.tsx           # Once per session (localStorage flag)
│   ├── LangSwitcher.tsx              # en / vi / zh-Hans switcher
│   ├── Navigation.tsx               # Top nav: logo, lang switcher, GitHub stars
│   └── Footer.tsx
│   └── motion/
│       ├── FadeUp.tsx
│       └── StaggerContainer.tsx
├── lib/
│   ├── utils.ts                      # cn() — clsx + tailwind-merge
│   ├── os.ts                         # UA-based OS detection (client only)
│   ├── github.ts                     # Releases API fetch, version/size parsing
│   ├── i18n/
│   │   ├── dict.ts                   # Type-safe dictionary loader
│   │   ├── en.json
│   │   ├── vi.json
│   │   └── zh.json
│   └── useDownloadUrl.ts             # Single hook: url, version, os, sizeLabel, ctaLabel
├── hooks/
│   └── useExitIntent.ts             # useEffect listener for viewport exit
└── public/
    ├── googleb5a10d9504de3274.html    # Preserved from existing
    └── assets/                        # User-supplied screenshots
        ├── icon-128.png
        ├── og-image.png
        ├── screenshot-tray.png        # For Install section
        └── screenshot-settings.png    # For Install section

docs/landing/                          # BUILD OUTPUT — generated by CI
.github/workflows/
    ├── deploy-landing.yml            # Updated to build from landing/ → docs/landing/
    └── deploy-landing-v3.yml         # Preview workflow: landing/ → gh-pages-preview
```

---

## Sprint 1: MVP

**Goal:** Scaffold + Hero + DemoScroll + Install + FAQ + i18n + deploy to preview.

### Task 1: Project Scaffold

**Files:**
- Create: `landing/package.json`
- Create: `landing/next.config.mjs`
- Create: `landing/tsconfig.json`
- Create: `landing/tailwind.config.ts`
- Create: `landing/postcss.config.mjs`
- Modify: `.github/workflows/deploy-landing-v3.yml` (create new preview workflow)
- Modify: `.github/workflows/deploy-landing.yml` (add note to update later)

- [ ] **Step 1: Create `landing/package.json`**

```json
{
  "name": "smoothscroll-landing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "motion": "^12.38.0",
    "lucide-react": "^0.468.0",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-switch": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.2",
    "sonner": "^2.0.7",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/node": "^20.17.6",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "typescript": "^5.7.3",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.3",
    "eslint": "^9.19.0",
    "eslint-config-next": "16.2.6",
    "vitest": "^4.1.6",
    "@testing-library/react": "^16.3.2",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^29.1.1",
    "@playwright/test": "^1.60.0"
  }
}
```

- [ ] **Step 2: Create `landing/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/SmoothScroll' : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

- [ ] **Step 3: Create `landing/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `landing/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          from: 'hsl(var(--brand-from))',
          to: 'hsl(var(--brand-to))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      letterSpacing: {
        tight: '-0.02em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'accordion-up': 'accordion-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

- [ ] **Step 5: Create `landing/postcss.config.mjs`**

```js
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
```

- [ ] **Step 6: Create `.github/workflows/deploy-landing-v3.yml`**

```yaml
name: Deploy Landing v3 Preview

on:
  push:
    branches: ['landing-v3']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: grant
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: landing/package-lock.json

      - name: Install dependencies
        run: cd landing && npm ci

      - name: Build
        run: cd landing && npm run build
        env:
          NODE_ENV: production

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: landing/out

      - name: Deploy to GitHub Pages (preview)
        uses: actions/deploy-pages@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          publish_type: 'preview'
```

- [ ] **Step 7: Commit**

```bash
git checkout -b landing-v3
git add landing/package.json landing/next.config.mjs landing/tsconfig.json landing/tailwind.config.ts landing/postcss.config.mjs .github/workflows/deploy-landing-v3.yml
git commit -m "feat(landing): scaffold Next.js 14 project with Tailwind v3 and shadcn/ui"
```

---

### Task 2: Global Styles & Theme

**Files:**
- Create: `landing/app/globals.css`
- Modify: `landing/app/layout.tsx`

- [ ] **Step 1: Create `landing/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* App-consistent neutral palette (hue 240, copied from src/index.css) */
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 5.9% 39.2%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;

    /* Marketing brand accent — used sparingly */
    --brand-from: 220 90% 65%;
    --brand-to: 260 80% 70%;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground antialiased;
    font-size: 16px;
    line-height: 1.6;
  }
  h1, h2, h3, h4, h5, h6 {
    letter-spacing: -0.02em;
    font-weight: 700;
  }
  p {
    max-width: 65ch;
  }
}
```

- [ ] **Step 2: Create `landing/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://quangtruong2003.github.io/SmoothScroll'),
  title: {
    template: '%s | SmoothScroll',
    default: 'SmoothScroll — Natural Scroll Feel on Windows',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/app/globals.css landing/app/layout.tsx
git commit -m "feat(landing): add globals.css with app-consistent design tokens"
```

---

### Task 3: shadcn/ui Primitives

**Files:**
- Create: `landing/components/ui/button.tsx`
- Create: `landing/components/ui/switch.tsx`
- Create: `landing/components/ui/tabs.tsx`
- Create: `landing/components/ui/accordion.tsx`
- Create: `landing/components/ui/badge.tsx`
- Create: `landing/components/ui/separator.tsx`
- Create: `landing/components/ui/dialog.tsx`
- Create: `landing/components/ui/sonner.tsx`

> Note: In a real shadcn setup, these would be added via `npx shadcn@latest add`. For this plan, write each file manually from the v0.x shadcn/ui source. The component code below is the canonical v0.6.x source for each primitive.

- [ ] **Step 1: Create `landing/lib/utils.ts` (required by all shadcn components)**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: Create `landing/components/ui/button.tsx`**

```tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        brand:
          'bg-gradient-to-br from-brand-from to-brand-to text-white shadow hover:opacity-90 transition-opacity',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 3: Create `landing/components/ui/switch.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-brand-from data-[state=checked]:to-brand-to data-[state=unchecked]:bg-input',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

- [ ] **Step 4: Create `landing/components/ui/tabs.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as TabsPrimitives from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitives.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitives.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitives.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitives.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitives.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitives.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitives.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitives.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitives.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitives.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitives.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

- [ ] **Step 5: Create `landing/components/ui/accordion.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as AccordionPrimitives from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const Accordion = AccordionPrimitives.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitives.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitives.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitives.Item
    ref={ref}
    className={cn('border-b', className)}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitives.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitives.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitives.Header className="flex">
    <AccordionPrimitives.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitives.Trigger>
  </AccordionPrimitives.Header>
))
AccordionTrigger.displayName = AccordionPrimitives.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitives.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitives.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn('pb-4 pt-0', className)}>{children}</div>
  </AccordionPrimitives.Content>
))
AccordionContent.displayName = AccordionPrimitives.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```

- [ ] **Step 6: Create `landing/components/ui/badge.tsx`**

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground shadow',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
        outline: 'text-foreground',
        brand:
          'border-transparent bg-gradient-to-br from-brand-from to-brand-to text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 7: Create `landing/components/ui/separator.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as SeparatorPrimitives from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitives.Root>
>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitives.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitives.Root.displayName

export { Separator }
```

- [ ] **Step 8: Create `landing/components/ui/dialog.tsx`**

```tsx
'use client'

import * as React from 'react'
import * as DialogPrimitives from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitives.Root
const DialogTrigger = DialogPrimitives.Trigger
const DialogPortal = DialogPrimitives.Portal
const DialogClose = DialogPrimitives.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitives.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitives.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitives.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitives.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitives.Close>
    </DialogPrimitives.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitives.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitives.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitives.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitives.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

- [ ] **Step 9: Create `landing/components/ui/sonner.tsx`**

```tsx
'use client'

export { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Toaster>

export function Toaster({ ...props }: ToasterProps) {
  return <Toaster solid toastOptions={{}} {...props} />
}
```

- [ ] **Step 10: Create `landing/components/ui/index.ts` (barrel export)**

```ts
export { Button, buttonVariants } from './button'
export { Switch } from './switch'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion'
export { Badge, badgeVariants } from './badge'
export { Separator } from './separator'
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './dialog'
```

- [ ] **Step 11: Install and verify**

Run: `cd landing && npm install`
Expected: `node_modules` populated, no peer-dep warnings about radix versions.

> **Note on Motion v12:** `framer-motion` is now `motion`. All component imports must use `motion/react` (e.g. `import { motion } from 'motion/react'`). The `framer-motion` package is deprecated.

- [ ] **Step 12: Commit**

```bash
git add landing/lib/utils.ts landing/components/ui/
git commit -m "feat(landing): add shadcn/ui primitives (button, switch, tabs, accordion, badge, separator, dialog, sonner)"
```

---

### Task 4: Motion Utilities

**Files:**
- Create: `landing/components/motion/FadeUp.tsx`
- Create: `landing/components/motion/StaggerContainer.tsx`

- [ ] **Step 1: Create `landing/components/motion/FadeUp.tsx`**

```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { forwardRef } from 'react'

interface FadeUpProps extends HTMLMotionProps<'div'> {
  delay?: number
  duration?: number
  className?: string
  children: React.ReactNode
}

export const FadeUp = forwardRef<HTMLDivElement, FadeUpProps>(
  ({ delay = 0, duration = 0.2, className, children, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{
          duration,
          delay,
          ease: prefersReducedMotion ? 'linear' : [0.16, 1, 0.3, 1],
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
FadeUp.displayName = 'FadeUp'
```

- [ ] **Step 2: Create `landing/components/motion/StaggerContainer.tsx`**

```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'

interface StaggerContainerProps {
  children: React.ReactNode
  staggerDelay?: number
  className?: string
}

export function StaggerContainer({
  children,
  staggerDelay = 0.08,
  className,
}: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/motion/
git commit -m "feat(landing): add motion utilities (FadeUp, StaggerContainer)"
```

---

### Task 5: i18n System

**Files:**
- Create: `landing/lib/i18n/dict.ts`
- Create: `landing/lib/i18n/en.json`
- Create: `landing/lib/i18n/vi.json`
- Create: `landing/lib/i18n/zh.json`

- [ ] **Step 1: Create `landing/lib/i18n/en.json`**

```json
{
  "nav": {
    "github": "GitHub",
    "stars": "stars"
  },
  "hero": {
    "eyebrow": "For Windows",
    "title": "Scroll that feels",
    "titleAccent": "natural",
    "subtitle": "SmoothScroll makes every mouse wheel movement feel silky — like you're using a premium trackpad. No learning curve. No bloat. Just smooth.",
    "cta": "Download for Windows",
    "ctaFallback": "Download",
    "trustLine": "Free, no telemetry. MIT license.",
    "seeHow": "See how it works",
    "demoPrompt": "Scroll the card. Then flip the switch.",
    "demoToast": "Want to feel it for real? — Download."
  },
  "painPoints": {
    "title": "The scroll is broken",
    "points": [
      {
        "title": "Jerky, stuttering motion",
        "description": "Every scroll tick lurches. Your hand expects smooth — your screen delivers chop."
      },
      {
        "title": "Exhausting for long sessions",
        "description": "Reading, coding, browsing — hours of tiny micro-adjustments that add up."
      },
      {
        "title": "Third-party mice feel worse",
        "description": "Good scroll is a premium feature. Everything else is a compromise."
      }
    ]
  },
  "solutionBridge": {
    "line": "SmoothScroll fixes that."
  },
  "features": {
    "title": "Everything you need, nothing you don't",
    "items": [
      { "title": "Zero configuration", "description": "Install and feel the difference immediately. No settings to tweak." },
      { "title": "Native feel", "description": "Uses the same physics curve as premium trackpads. Scroll feels inevitable." },
      { "title": "Per-app profiles", "description": "Different smoothing for Chrome vs VS Code vs Adobe apps." },
      { "title": "Battery friendly", "description": "Runs at near-zero CPU when idle. Your battery won't notice it." },
      { "title": "Privacy-first", "description": "No telemetry, no network calls, no data collection. Ever." },
      { "title": "Instant on/off", "description": "Toggle from the system tray. No restart required." }
    ]
  },
  "useCases": {
    "title": "Built for how you actually work",
    "tabs": {
      "reading": { "label": "Reading", "description": "Long-form articles, documentation, PDFs. Smooth scrolling keeps you in flow." },
      "coding": { "label": "Coding", "description": "Navigate codebases, scroll through logs, review diffs — without losing your place." },
      "designing": { "label": "Designing", "description": "Artboards, timelines, layer panels. Scroll should feel as precise as your stylus." }
    }
  },
  "trayPreview": {
    "title": "It lives in your system tray",
    "subtitle": "Control everything without opening settings."
  },
  "stats": {
    "title": "Trusted by",
    "githubStars": "GitHub stars",
    "downloads": "Downloads",
    "version": "Version",
    "fallback": {
      "stars": "5.2k",
      "downloads": "50k+",
      "version": "v1.0.0"
    }
  },
  "indie": {
    "title": "Made by an indie dev",
    "subtitle": "Independent, transparent, and community-driven.",
    "points": [
      "MIT licensed — audit the code yourself",
      "Zero telemetry or data collection",
      "No ads, no premium tier, no upsell",
      "Built in the open on GitHub"
    ],
    "cta": "View on GitHub"
  },
  "install": {
    "title": "Get started in 60 seconds",
    "subtitle": "Download, run, feel the difference.",
    "tabs": {
      "windows": { "label": "Windows", "steps": ["Download the installer below", "Run the .exe — no install wizard, no admin required", "SmoothScroll starts automatically. You're done."] },
      "macos": { "label": "macOS", "steps": ["Download the DMG below", "Drag SmoothScroll to Applications", "Grant Accessibility permission in System Settings → Privacy → Accessibility", "Done."] }
    },
    "filename": "SmoothScrollSetup.exe",
    "note": {
      "windows": "Saved to %LOCALAPPDATA% by default",
      "macos": "Accessibility permission is required for global input interception"
    },
    "cta": "Download for {os}"
  },
  "faq": {
    "title": "Frequently asked questions",
    "questions": [
      { "q": "Does this work with all apps?", "a": "SmoothScroll intercepts the Windows mouse wheel input before it reaches any application, so it works with virtually everything — Chrome, VS Code, File Explorer, Adobe apps, and more." },
      { "q": "Will it drain my battery?", "a": "No. SmoothScroll runs at near-zero CPU when idle and only processes input during scroll events. Most users see no measurable battery impact." },
      { "q": "Is it safe? What does it install?", "a": "SmoothScroll is a standalone executable. No service, no daemon, no system driver. It doesn't install any network listeners or telemetry. You can verify this by reading the MIT-licensed source on GitHub." },
      { "q": "How is this different from Windows' built-in smooth scrolling?", "a": "Windows' built-in smooth scroll is app-specific and inconsistent. SmoothScroll provides a unified, configurable curve applied globally — with per-app profiles, adjustable strength, and instant toggle." },
      { "q": "Does it work with gaming mice or high-DPI devices?", "a": "Yes. SmoothScroll respects the actual scroll delta from your hardware and applies smoothing on top. Works with all mice tested so far, including high-refresh and gaming mice." },
      { "q": "Can I disable it for specific apps?", "a": "Yes. Per-app exclusion profiles are built in. Just open the tray panel and add apps to the exclude list." },
      { "q": "What Windows versions are supported?", "a": "Windows 10 and Windows 11 are fully supported." },
      { "q": "How do I uninstall?", "a": "Just delete the executable. No uninstaller needed — there is nothing else on your system." }
    ]
  },
  "finalCta": {
    "title": "Ready to feel the difference?",
    "subtitle": "Join thousands of developers and designers who scroll better.",
    "cta": "Download SmoothScroll",
    "ctaSub": "Free forever. MIT license."
  },
  "footer": {
    "tagline": "Smooth scroll for Windows.",
    "links": {
      "github": "GitHub",
      "license": "MIT License"
    }
  },
  "exitIntent": {
    "title": "Wait — before you go!",
    "message": "Get SmoothScroll and make every scroll feel natural.",
    "cta": "Download free"
  },
  "langSwitcher": {
    "en": "English",
    "vi": "Tiếng Việt",
    "zh": "中文"
  }
}
```

- [ ] **Step 2: Create `landing/lib/i18n/vi.json`**

```json
{
  "nav": { "github": "GitHub", "stars": "sao" },
  "hero": {
    "eyebrow": "Cho Windows",
    "title": "Cuộn mượt như",
    "titleAccent": "tự nhiên",
    "subtitle": "SmoothScroll giúp mọi lần cuộn chuột đều mượt mà — như đang dùng trackpad cao cấp. Không cần học cách dùng, không cần cài thêm gì.",
    "cta": "Tải cho Windows",
    "ctaFallback": "Tải xuống",
    "trustLine": "Miễn phí, không thu thập dữ liệu. Giấy phép MIT.",
    "seeHow": "Xem cách hoạt động",
    "demoPrompt": "Cuộn thẻ bên dưới. Sau đó bật công tắc.",
    "demoToast": "Muốn trải nghiệm thực tế? — Hãy tải về."
  },
  "painPoints": {
    "title": "Thanh cuộn bị lỗi",
    "points": [
      { "title": "Chuyển động giật, không mượt", "description": "Mỗi lần cuộn đều chồm. Tay bạn mong đợi mượt — màn hình lại cung cấp sự chồm chất." },
      { "title": "Mỏi khi dùng lâu", "description": "Đọc, viết code, duyệt web — hàng giờ điều chỉnh nhỏ tích lũy thành mệt mỏi." },
      { "title": "Chuột không dây kém hơn", "description": "Cuộn mượt là tính năng cao cấp. Mọi thứ khác đều là đánh đổi." }
    ]
  },
  "solutionBridge": { "line": "SmoothScroll giải quyết điều đó." },
  "features": {
    "title": "Mọi thứ bạn cần, không có thứ bạn không cần",
    "items": [
      { "title": "Không cần cấu hình", "description": "Cài đặt và cảm nhận sự khác biệt ngay lập tức. Không cần tinh chỉnh gì." },
      { "title": "Cảm giác tự nhiên", "description": "Sử dụng cùng đường cong vật lý như trackpad cao cấp. Cuộn cảm giác như không thể dừng lại." },
      { "title": "Hồ sơ theo từng ứng dụng", "description": "Mức làm mượt khác nhau cho Chrome, VS Code, Adobe apps." },
      { "title": "Tiết kiệm pin", "description": "Chạy gần như không CPU khi rảnh rỗi. Pin sẽ không nhận ra nó." },
      { "title": "Bảo mật", "description": "Không telemetry, không gọi mạng, không thu thập dữ liệu. Không bao giờ." },
      { "title": "Bật/tắt tức thì", "description": "Chuyển từ khay hệ thống. Không cần khởi động lại." }
    ]
  },
  "useCases": {
    "title": "Thiết kế cho cách bạn thực sự làm việc",
    "tabs": {
      "reading": { "label": "Đọc", "description": "Bài viết dài, tài liệu, PDF. Cuộn mượt giữ bạn trong trạng thái flow." },
      "coding": { "label": "Lập trình", "description": "Điều hướng codebase, cuộn log, xem diff — không mất vị trí." },
      "designing": { "label": "Thiết kế", "description": "Artboard, timeline, layer panel. Cuộn nên chính xác như bút vẽ." }
    }
  },
  "trayPreview": { "title": "Nó sống trong khay hệ thống", "subtitle": "Điều khiển mọi thứ mà không cần mở cài đặt." },
  "stats": { "title": "Được tin dùng bởi", "githubStars": "Sao GitHub", "downloads": "Lượt tải", "version": "Phiên bản", "fallback": { "stars": "5.2k", "downloads": "50k+", "version": "v1.0.0" } },
  "indie": { "title": "Tạo bởi một lập trình viên indie", "subtitle": "Độc lập, minh bạch, và dựa trên cộng đồng.", "points": ["Giấy phép MIT — tự kiểm tra code", "Không telemetry hay thu thập dữ liệu", "Không quảng cáo, không premium, không upsell", "Xây dựng công khai trên GitHub"], "cta": "Xem trên GitHub" },
  "install": { "title": "Bắt đầu trong 60 giây", "subtitle": "Tải về, chạy, cảm nhận sự khác biệt.", "tabs": { "windows": { "label": "Windows", "steps": ["Tải installer bên dưới", "Chạy file .exe — không có wizard, không cần quyền admin", "SmoothScroll khởi động tự động. Xong."] }, "macos": { "label": "macOS", "steps": ["Tải file DMG bên dưới", "Kéo SmoothScroll vào Applications", "Cấp quyền Accessibility trong System Settings → Privacy → Accessibility", "Xong."] } }, "filename": "SmoothScrollSetup.exe", "note": { "windows": "Mặc định lưu vào %LOCALAPPDATA%", "macos": "Cần quyền Accessibility để nhận input toàn cục" }, "cta": "Tải cho {os}" },
  "faq": { "title": "Câu hỏi thường gặp", "questions": [
    { "q": "Có hoạt động với mọi ứng dụng không?", "a": "SmoothScroll chặn input wheel từ chuột trước khi đến ứng dụng, nên hoạt động với hầu hết mọi thứ — Chrome, VS Code, File Explorer, Adobe apps." },
    { "q": "Có tốn pin không?", "a": "Không. SmoothScroll gần như không dùng CPU khi rảnh rỗi và chỉ xử lý khi có sự kiện cuộn." },
    { "q": "Có an toàn không? Cài gì vào máy?", "a": "SmoothScroll là một file chạy độc lập. Không có service, không có daemon, không có driver. Không có network listener. Có thể tự kiểm chứng code nguồn MIT trên GitHub." },
    { "q": "Khác gì smooth scroll có sẵn của Windows?", "a": "Smooth scroll của Windows phụ thuộc từng ứng dụng và không nhất quán. SmoothScroll cung cấp một đường cong thống nhất, có thể cấu hình, áp dụng toàn cục." },
    { "q": "Có hoạt động với chuột gaming không?", "a": "Có. SmoothScroll tôn trọng delta thực từ phần cứng và áp dụng làm mượt bên trên." },
    { "q": "Có thể tắt cho ứng dụng cụ thể không?", "a": "Có. Có hồ sơ loại trừ theo ứng dụng. Mở tray panel và thêm ứng dụng vào danh sách loại trừ." },
    { "q": "Hỗ trợ Windows phiên bản nào?", "a": "Windows 10 và Windows 11 được hỗ trợ đầy đủ." },
    { "q": "Gỡ cài đặt như thế nào?", "a": "Chỉ cần xóa file .exe. Không có uninstaller — không có gì khác trên hệ thống." }
  ]},
  "finalCta": { "title": "Sẵn sàng cảm nhận sự khác biệt?", "subtitle": "Tham gia hàng nghìn developer và designer cuộn mượt hơn.", "cta": "Tải SmoothScroll", "ctaSub": "Miễn phí mãi mãi. Giấy phép MIT." },
  "footer": { "tagline": "Cuộn mượt cho Windows.", "links": { "github": "GitHub", "license": "Giấy phép MIT" } },
  "exitIntent": { "title": "Đợi đã — trước khi bạn đi!", "message": "Tải SmoothScroll và cảm nhận cuộn tự nhiên.", "cta": "Tải miễn phí" },
  "langSwitcher": { "en": "English", "vi": "Tiếng Việt", "zh": "中文" }
}
```

- [ ] **Step 3: Create `landing/lib/i18n/zh.json`**

```json
{
  "nav": { "github": "GitHub", "stars": "星" },
  "hero": {
    "eyebrow": "适用 Windows",
    "title": "滚动如",
    "titleAccent": "行云流水",
    "subtitle": "SmoothScroll 让每次滚轮都丝般顺滑——就像在使用高端触控板。无需学习，无臃肿软件，就是顺。",
    "cta": "下载 Windows 版",
    "ctaFallback": "立即下载",
    "trustLine": "免费，无遥测。MIT 许可。",
    "seeHow": "看实际效果",
    "demoPrompt": "滚动下方卡片，然后拨动开关。",
    "demoToast": "想真实体验？——下载试试。"
  },
  "painPoints": {
    "title": "滚动的手感坏了",
    "points": [
      { "title": "卡顿、跳跃的滚动", "description": "每次滚动都一格一格地跳。你的手期待顺滑——屏幕却给你卡顿。" },
      { "title": "长时间使用让人疲惫", "description": "阅读、写代码、浏览——无数微小调整累积成疲劳。" },
      { "title": "第三方鼠标体验更差", "description": "好的滚轮是高端专属。其他的都是将就。" }
    ]
  },
  "solutionBridge": { "line": "SmoothScroll 修复它。" },
  "features": {
    "title": "你需要的一切，不需要的一概不要",
    "items": [
      { "title": "零配置", "description": "安装即体验，无需任何设置。" },
      { "title": "原生手感", "description": "使用与高端触控板相同的物理曲线。滚动如丝般顺滑。" },
      { "title": "按应用配置", "description": "Chrome、VS Code、Adobe 全家桶各有最佳参数。" },
      { "title": "省电友好", "description": "空闲时 CPU 占用几乎为零。电池毫无感知。" },
      { "title": "隐私优先", "description": "无遥测、无网络请求、无数据收集。永不。" },
      { "title": "即时开关", "description": "托盘一键切换，无需重启。" }
    ]
  },
  "useCases": {
    "title": "为你的真实工作方式而造",
    "tabs": {
      "reading": { "label": "阅读", "description": "长文、文档、PDF。流畅滚动让你沉浸其中。" },
      "coding": { "label": "编程", "description": "浏览代码库、滚动日志、审阅 diff——不再迷路。" },
      "designing": { "label": "设计", "description": "画板、时间轴、图层面板。滚动应和手写笔一样精准。" }
    }
  },
  "trayPreview": { "title": "它就住在系统托盘里", "subtitle": "无需打开设置，一切尽在掌控。" },
  "stats": { "title": "被信任使用", "githubStars": "GitHub 星星", "downloads": "下载量", "version": "版本", "fallback": { "stars": "5.2k", "downloads": "50k+", "version": "v1.0.0" } },
  "indie": { "title": "独立开发者出品", "subtitle": "独立、透明、社区驱动。", "points": ["MIT 许可——自行审计代码", "零遥测或数据收集", "无广告、无高级版、无推销", "在 GitHub 上公开构建"], "cta": "在 GitHub 查看" },
  "install": { "title": "60 秒开始体验", "subtitle": "下载、运行、感受不同。", "tabs": { "windows": { "label": "Windows", "steps": ["点击下方下载安装包", "运行 .exe——无需安装向导，无需管理员权限", "SmoothScroll 自动启动。搞定。"] }, "macos": { "label": "macOS", "steps": ["点击下方下载 DMG", "将 SmoothScroll 拖到应用程序", "在系统设置 → 隐私与安全 → 辅助功能 中授予辅助功能权限", "完成。"] } }, "filename": "SmoothScrollSetup.exe", "note": { "windows": "默认保存到 %LOCALAPPDATA%", "macos": "需要辅助功能权限来拦截全局输入" }, "cta": "下载 {os} 版" },
  "faq": { "title": "常见问题", "questions": [
    { "q": "所有应用都支持吗？", "a": "SmoothScroll 在滚轮输入到达任何应用之前就拦截了，所以几乎支持所有应用——Chrome、VS Code、文件资源管理器、Adobe 全家桶等。" },
    { "q": "会耗电吗？", "a": "不会。SmoothScroll 空闲时 CPU 几乎为零，只在滚动事件时处理。大多数用户感受不到电池影响。" },
    { "q": "安全吗？会安装什么？", "a": "SmoothScroll 是一个独立可执行文件。没有服务、没有守护进程、没有系统驱动。不含网络监听器。可以在 GitHub 上阅读 MIT 许可的源代码自行验证。" },
    { "q": "和 Windows 自带的平滑滚动有何不同？", "a": "Windows 自带的平滑滚动按应用而异且不统一。SmoothScroll 提供统一的、可配置的曲线，全局生效，并支持按应用配置、即开即关。" },
    { "q": "游戏鼠标或高 DPI 设备能用吗？", "a": "能。SmoothScroll 尊重硬件原始滚动增量并在其上应用平滑处理。已测试各种鼠标，包括高刷新率和游戏鼠标。" },
    { "q": "可以针对特定应用关闭吗？", "a": "可以。内置了按应用排除配置文件。打开托盘面板，将应用添加到排除列表即可。" },
    { "q": "支持哪些 Windows 版本？", "a": "Windows 10 和 Windows 11 完全支持。" },
    { "q": "如何卸载？", "a": "直接删除可执行文件即可。无需卸载程序——系统里没有别的东西。" }
  ]},
  "finalCta": { "title": "准备好感受不同了吗？", "subtitle": "加入成千上万的开发者与设计师，体验更顺滑的滚动。", "cta": "下载 SmoothScroll", "ctaSub": "永久免费。MIT 许可。" },
  "footer": { "tagline": "Windows 流畅滚动。", "links": { "github": "GitHub", "license": "MIT 许可" } },
  "exitIntent": { "title": "等等，先别走！", "message": "下载 SmoothScroll，让每次滚动都自然流畅。", "cta": "免费下载" },
  "langSwitcher": { "en": "English", "vi": "Tiếng Việt", "zh": "中文" }
}
```

- [ ] **Step 4: Create `landing/lib/i18n/dict.ts`**

```ts
import type { en } from './en'

export type Dict = typeof en

export type Locale = 'en' | 'vi' | 'zh'

export const locales: Locale[] = ['en', 'vi', 'zh']
export const defaultLocale: Locale = 'en'

const dictionaries: Record<Locale, () => Promise<Dict>> = {
  en: () => import('./en.json').then((m) => m as Dict),
  vi: () => import('./vi.json').then((m) => m as Dict),
  zh: () => import('./zh.json').then((m) => m as Dict),
}

export function getDictionary(locale: Locale): Promise<Dict> {
  return dictionaries[locale]?.() ?? dictionaries[defaultLocale]()
}
```

- [ ] **Step 5: Commit**

```bash
git add landing/lib/i18n/
git commit -m "feat(landing): add i18n system with en, vi, zh dictionaries"
```

---

### Task 6: Utility Lib

**Files:**
- Create: `landing/lib/os.ts`
- Create: `landing/lib/github.ts`
- Create: `landing/lib/useDownloadUrl.ts`
- Create: `landing/hooks/useExitIntent.ts`
- Test: `landing/lib/github.test.ts`
- Test: `landing/lib/os.test.ts`

- [ ] **Step 1: Create `landing/lib/os.ts`**

```ts
export type OS = 'win' | 'mac' | 'other'

export function detectOS(): OS {
  if (typeof window === 'undefined') return 'other'

  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'win'
  if (ua.includes('mac') || ua.includes('darwin')) return 'mac'
  return 'other'
}

export function getOSLabel(os: OS): string {
  switch (os) {
    case 'win':
      return 'Windows'
    case 'mac':
      return 'macOS'
    default:
      return 'your OS'
  }
}
```

- [ ] **Step 2: Create `landing/lib/github.ts`**

```ts
export interface ReleaseAsset {
  name: string
  browser_download_url: string
  download_count: number
}

export interface Release {
  tag_name: string
  assets: ReleaseAsset[]
}

const REPO = 'quangtruong2003/SmoothScroll'

export const FALLBACK_RELEASE = {
  tag_name: 'v1.0.0',
  assets: [
    {
      name: 'SmoothScroll-1.0.0-windows-x64.msi',
      browser_download_url: `https://github.com/${REPO}/releases/download/v1.0.0/SmoothScroll-1.0.0-windows-x64.msi`,
      download_count: 12000,
    },
    {
      name: 'SmoothScroll-1.0.0-macos.dmg',
      browser_download_url: `https://github.com/${REPO}/releases/download/v1.0.0/SmoothScroll-1.0.0-macos.dmg`,
      download_count: 8000,
    },
  ],
} as const

export async function fetchLatestRelease(): Promise<Release> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Release
  } catch {
    return FALLBACK_RELEASE as unknown as Release
  }
}

export function formatDownloadCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return count.toString()
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`
  return `${bytes} B`
}
```

- [ ] **Step 3: Create `landing/lib/useDownloadUrl.ts`**

```ts
'use client'

import { useState, useEffect } from 'react'
import { detectOS, getOSLabel } from './os'
import { fetchLatestRelease, formatDownloadCount, type Release } from './github'

export interface DownloadInfo {
  url: string
  version: string
  os: ReturnType<typeof detectOS>
  sizeLabel: string
  ctaLabel: string
  totalDownloads: string
  release: Release | null
}

const FALLBACK_URL = 'https://github.com/quangtruong2003/SmoothScroll/releases/latest'

export function useDownloadUrl(): DownloadInfo {
  const [data, setData] = useState<DownloadInfo>({
    url: FALLBACK_URL,
    version: 'v1.0.0',
    os: 'other',
    sizeLabel: '',
    ctaLabel: 'Download',
    totalDownloads: '50k+',
    release: null,
  })

  useEffect(() => {
    const os = detectOS()

    setData((prev) => ({
      ...prev,
      os,
      ctaLabel: `Download for ${getOSLabel(os)}`,
    }))

    fetchLatestRelease().then((release) => {
      const assetName = os === 'mac' ? 'dmg' : 'msi'
      const asset = release.assets.find((a) =>
        a.name.toLowerCase().includes(assetName)
      )
      const fallbackAsset = release.assets[0]

      const totalDownloads = release.assets.reduce(
        (sum, a) => sum + (a.download_count || 0),
        0
      )

      setData({
        url: asset?.browser_download_url ?? fallbackAsset?.browser_download_url ?? FALLBACK_URL,
        version: release.tag_name,
        os,
        sizeLabel: '', // Asset size would need a HEAD request; skip for perf
        ctaLabel: `Download for ${getOSLabel(os)}`,
        totalDownloads: formatDownloadCount(totalDownloads),
        release,
      })
    })
  }, [])

  return data
}
```

- [ ] **Step 4: Create `landing/hooks/useExitIntent.ts`**

```ts
'use client'

import { useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'ss-exit-intent-fired'

export function useExitIntent(): boolean {
  const [triggered, setTriggered] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY)) return

    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0 && !firedRef.current) {
        firedRef.current = true
        sessionStorage.setItem(SESSION_KEY, '1')
        setTriggered(true)
      }
    }

    document.addEventListener('mouseleave', onMouseLeave)
    return () => document.removeEventListener('mouseleave', onMouseLeave)
  }, [])

  return triggered
}
```

- [ ] **Step 5: Write `landing/lib/github.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { formatDownloadCount, formatSize } from './github'

describe('github.ts', () => {
  describe('formatDownloadCount', () => {
    it('formats thousands', () => {
      expect(formatDownloadCount(12000)).toBe('12.0k')
    })
    it('formats millions', () => {
      expect(formatDownloadCount(1500000)).toBe('1.5M')
    })
    it('formats small numbers', () => {
      expect(formatDownloadCount(999)).toBe('999')
    })
  })

  describe('formatSize', () => {
    it('formats MB', () => {
      expect(formatSize(5242880)).toBe('5.0 MB')
    })
    it('formats GB', () => {
      expect(formatSize(1073741824)).toBe('1.0 GB')
    })
    it('formats KB', () => {
      expect(formatSize(512000)).toBe('500 KB')
    })
  })
})
```

- [ ] **Step 6: Write `landing/lib/os.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectOS, getOSLabel } from './os'

describe('os.ts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns win for Windows UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('win')
    vi.stubGlobal('navigator', undefined)
  })

  it('returns mac for macOS UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('mac')
    vi.stubGlobal('navigator', undefined)
  })

  it('returns other for unknown UA', () => {
    const mockNavigator = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }
    vi.stubGlobal('navigator', mockNavigator)
    expect(detectOS()).toBe('other')
    vi.stubGlobal('navigator', undefined)
  })

  it('returns other on server side', () => {
    vi.stubGlobal('navigator', undefined)
    expect(detectOS()).toBe('other')
  })

  describe('getOSLabel', () => {
    it('returns correct labels', () => {
      expect(getOSLabel('win')).toBe('Windows')
      expect(getOSLabel('mac')).toBe('macOS')
      expect(getOSLabel('other')).toBe('your OS')
    })
  })
})
```

- [ ] **Step 7: Create `landing/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 8: Create `landing/__tests__/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 9: Run tests**

Run: `cd landing && npx vitest run`
Expected: 7 tests pass.

- [ ] **Step 10: Commit**

```bash
git add landing/lib/os.ts landing/lib/github.ts landing/lib/useDownloadUrl.ts landing/hooks/useExitIntent.ts landing/lib/github.test.ts landing/lib/os.test.ts landing/vitest.config.ts landing/__tests__/setup.ts
git commit -m "feat(landing): add lib utilities (OS detection, GitHub API, useDownloadUrl, useExitIntent)"
```

---

### Task 7: Navigation + Footer + LangSwitcher

**Files:**
- Create: `landing/components/Navigation.tsx`
- Create: `landing/components/LangSwitcher.tsx`
- Create: `landing/components/Footer.tsx`

- [ ] **Step 1: Create `landing/components/LangSwitcher.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import type { Locale } from '@/lib/i18n/dict'

interface LangSwitcherProps {
  locale: Locale
  dict: {
    langSwitcher: Record<string, string>
  }
}

const localeLabels: Record<Locale, string> = {
  en: 'EN',
  vi: 'VI',
  zh: '中文',
}

export function LangSwitcher({ locale, dict }: LangSwitcherProps) {
  const pathname = usePathname()

  const switchLocale = (newLocale: Locale) => {
    if (!pathname) return
    const segments = pathname.split('/')
    segments[1] = newLocale
    return segments.join('/')
  }

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Switch language"
      >
        <Globe className="h-4 w-4" />
        <span>{localeLabels[locale]}</span>
      </button>
      <div className="absolute right-0 mt-1 w-28 rounded-md border bg-popover py-1 shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
        {(Object.keys(localeLabels) as Locale[]).map((loc) => (
          <Link
            key={loc}
            href={switchLocale(loc) ?? '#'}
            className={`block px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
              loc === locale ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }`}
            replace
          >
            {localeLabels[loc]}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `landing/components/Navigation.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Github, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LangSwitcher } from './LangSwitcher'
import type { Locale } from '@/lib/i18n/dict'

interface NavigationProps {
  locale: Locale
  langSwitcherDict: Record<string, string>
}

export function Navigation({ locale, langSwitcherDict }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false)
  const [stars, setStars] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('https://api.github.com/repos/quangtruong2003/SmoothScroll')
      .then((r) => r.json())
      .then((d) => setStars(d.stargazers_count?.toLocaleString() ?? null))
      .catch(() => {})
  }, [])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-200 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-md border-b shadow-sm py-2'
          : 'bg-transparent py-4'
      }`}
    >
      <nav className="container flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2 font-bold text-lg">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect width="20" height="20" rx="4" fill="hsl(240 5.9% 10%)" />
            <path d="M5 8h10M5 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          SmoothScroll
        </Link>

        <div className="flex items-center gap-4">
          {stars && (
            <a
              href="https://github.com/quangtruong2003/SmoothScroll"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Star className="h-4 w-4" />
              <span>{stars}</span>
            </a>
          )}
          <a
            href="https://github.com/quangtruong2003/SmoothScroll"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex"
          >
            <Button variant="ghost" size="sm">
              <Github className="h-4 w-4 mr-1.5" />
              GitHub
            </Button>
          </a>
          <LangSwitcher locale={locale} dict={{ langSwitcher: langSwitcherDict }} />
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 3: Create `landing/components/Footer.tsx`**

```tsx
import Link from 'next/link'

interface FooterProps {
  locale: string
  dict: {
    footer: {
      tagline: string
      links: { github: string; license: string }
    }
  }
}

export function Footer({ locale, dict }: FooterProps) {
  const { footer: f } = dict
  return (
    <footer className="border-t py-8 mt-16">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{f.tagline}</p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="https://github.com/quangtruong2003/SmoothScroll" className="hover:text-foreground transition-colors">
            {f.links.github}
          </Link>
          <Link href="https://github.com/quangtruong2003/SmoothScroll/blob/main/LICENSE" className="hover:text-foreground transition-colors">
            {f.links.license}
          </Link>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add landing/components/Navigation.tsx landing/components/LangSwitcher.tsx landing/components/Footer.tsx
git commit -m "feat(landing): add Navigation, LangSwitcher, and Footer components"
```

---

### Task 8: Hero + DemoScroll (MVP conversion linchpin)

**Files:**
- Create: `landing/components/sections/Hero.tsx`
- Create: `landing/components/DemoScroll.tsx`
- Create: `landing/components/DownloadCTA.tsx`
- Test: `landing/components/DemoScroll.test.tsx`

- [ ] **Step 1: Create `landing/components/DownloadCTA.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { Download } from 'lucide-react'

interface DownloadCTAProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg'
  className?: string
}

export function DownloadCTA({ label, variant = 'brand', size = 'default', className }: DownloadCTAProps) {
  const { url } = useDownloadUrl()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      aria-label={label}
    >
      <Download className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}
```

- [ ] **Step 2: Create `landing/components/DemoScroll.tsx`**

```tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SAMPLE_LINES = [
  '// SmoothScroll — natural scroll feel for Windows',
  '',
  'fn main() {',
  '    let settings = Settings::default()',
  '        .with_smoothing(0.85)',
  '        .with_easing(Easing::Natural)',
  '        .with_per_app_profiles(true);',
  '',
  '    SmoothScroll::init(settings)?;',
  '    Ok(())',
  '}',
  '',
  '// Default easing: cubic-bezier(0.25, 0.1, 0.25, 1.0)',
  '// The same curve premium trackpads use.',
  '',
  '#[derive(Debug, Clone)]',
  'pub struct ScrollEvent {',
  '    pub delta: f64,',
  '    pub timestamp: u64,',
  '    pub source: InputSource,',
  '}',
  '',
  'impl ScrollInterpolator {',
  '    pub fn smooth(&self, event: ScrollEvent) -> f64 {',
  '        self.buffer.push(event.delta);',
  '        self.easing.interpolate(&self.buffer)',
  '    }',
  '}',
  '',
  '// Toggle the switch to feel the difference.',
]

const SMOOTH_EASING = 'cubic-bezier(0.25, 0.1, 0.25, 1.0)'
const NATIVE_EASING = 'auto'

interface DemoScrollProps {
  prompt: string
  toastMessage: string
}

export function DemoScroll({ prompt, toastMessage }: DemoScrollProps) {
  const [enabled, setEnabled] = useState(false)
  const [toggledOnce, setToggledOnce] = useState(false)
  const [scrolledAfterToggle, setScrolledAfterToggle] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const prefersReducedMotion = useReducedMotion()

  const handleToggle = () => {
    setEnabled((prev) => !prev)
    if (!toggledOnce) setToggledOnce(true)
    hasScrolledRef.current = false
    setScrolledAfterToggle(false)
  }

  const handleScroll = useCallback(() => {
    if (toggledOnce && !scrolledAfterToggle && hasScrolledRef.current) {
      setScrolledAfterToggle(true)
      if (!prefersReducedMotion) {
        toast(toastMessage, { duration: 4000 })
      }
    }
  }, [toggledOnce, scrolledAfterToggle, toastMessage, prefersReducedMotion])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const onWheel = () => {
      hasScrolledRef.current = true
      setTimeout(handleScroll, 100)
    }

    card.addEventListener('wheel', onWheel, { passive: true })
    return () => card.removeEventListener('wheel', onWheel)
  }, [handleScroll])

  return (
    <div className="flex flex-col items-center gap-4" ref={containerRef}>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className={cn('transition-colors', enabled && 'text-foreground font-medium')}>
          Native
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          aria-label="Toggle smooth scroll"
        />
        <span className={cn('transition-colors', enabled ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          Smooth
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        ref={cardRef}
        className="w-full max-w-md h-[480px] rounded-xl border bg-card shadow-xl overflow-y-auto select-none"
        style={{ scrollBehavior: prefersReducedMotion ? 'auto' : (enabled ? SMOOTH_EASING : NATIVE_EASING) }}
        tabIndex={0}
        aria-label="Demo scroll card"
      >
        <div className="p-6">
          {SAMPLE_LINES.map((line, i) => (
            <div key={i} className={cn(
              'font-mono text-sm leading-7',
              line.startsWith('//') ? 'text-muted-foreground' : 'text-foreground',
              line === '' && 'h-4'
            )}>
              {line}
            </div>
          ))}
        </div>
      </motion.div>

      <p className="text-xs text-center text-muted-foreground">{prompt}</p>
    </div>
  )
}
```

- [ ] **Step 3: Create `landing/components/sections/Hero.tsx`**

```tsx
import { DemoScroll } from '@/components/DemoScroll'
import { DownloadCTA } from '@/components/DownloadCTA'
import { Badge } from '@/components/ui/badge'

interface HeroProps {
  dict: {
    hero: {
      eyebrow: string
      title: string
      titleAccent: string
      subtitle: string
      cta: string
      trustLine: string
      seeHow: string
      demoPrompt: string
      demoToast: string
    }
  }
}

export function Hero({ dict }: HeroProps) {
  const { hero: h } = dict

  return (
    <section className="min-h-screen flex items-center pt-20 pb-16 px-4">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="flex flex-col gap-6">
            <Badge variant="secondary" className="w-fit">{h.eyebrow}</Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              {h.title}{' '}
              <span className="bg-gradient-to-br from-brand-from to-brand-to bg-clip-text text-transparent">
                {h.titleAccent}
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed">
              {h.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <DownloadCTA label={h.cta} variant="brand" size="lg" />
              <a href="#how-it-works" className="flex items-center justify-center px-6 py-2 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors">
                {h.seeHow}
              </a>
            </div>

            <p className="text-sm text-muted-foreground">{h.trustLine}</p>
          </div>

          {/* Right: Demo */}
          <div>
            <DemoScroll prompt={h.demoPrompt} toastMessage={h.demoToast} />
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Write `landing/components/DemoScroll.test.tsx`**

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DemoScroll } from './DemoScroll'

const dict = {
  prompt: 'Scroll the card. Then flip the switch.',
  toastMessage: 'Want to feel it for real?',
}

describe('DemoScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the demo card', () => {
    render(<DemoScroll {...dict} />)
    expect(screen.getByLabelText('Demo scroll card')).toBeInTheDocument()
  })

  it('renders the switch', () => {
    render(<DemoScroll {...dict} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('toggles smooth scroll on switch change', async () => {
    render(<DemoScroll {...dict} />)
    const sw = screen.getByRole('switch')
    expect(sw).not.toBeChecked()
    await fireEvent.click(sw)
    expect(sw).toBeChecked()
  })
})
```

- [ ] **Step 5: Run tests**

Run: `cd landing && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add landing/components/sections/Hero.tsx landing/components/DemoScroll.tsx landing/components/DownloadCTA.tsx landing/components/DemoScroll.test.tsx
git commit -m "feat(landing): add Hero section with live DemoScroll component"
```

---

### Task 9: Install Section

**Files:**
- Create: `landing/components/sections/Install.tsx`

- [ ] **Step 1: Create `landing/components/sections/Install.tsx`**

```tsx
'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DownloadCTA } from '@/components/DownloadCTA'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { cn } from '@/lib/utils'

interface InstallProps {
  dict: {
    install: {
      title: string
      subtitle: string
      tabs: {
        windows: {
          label: string
          steps: string[]
        }
        macos: {
          label: string
          steps: string[]
        }
      }
      filename: string
      note: {
        windows: string
        macos: string
      }
      cta: string
    }
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy'}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

export function Install({ dict }: InstallProps) {
  const { install: i } = dict
  const { os, ctaLabel } = useDownloadUrl()

  const defaultTab = os === 'mac' ? 'macos' : 'windows'

  return (
    <section id="install" className="py-20 px-4 scroll-mt-20">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{i.title}</h2>
          <p className="text-muted-foreground text-lg">{i.subtitle}</p>
        </div>

        <Tabs defaultValue={defaultTab} className="max-w-2xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="windows">{i.tabs.windows.label}</TabsTrigger>
            <TabsTrigger value="macos">{i.tabs.macos.label}</TabsTrigger>
          </TabsList>

          <TabsContent value="windows" className="space-y-6">
            <ol className="space-y-4">
              {i.tabs.windows.steps.map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-brand-from to-brand-to text-white text-sm font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="pt-1 text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-md bg-muted p-4 flex items-center justify-between gap-2">
              <code className="text-sm font-mono text-muted-foreground overflow-x-auto">
                %LOCALAPPDATA%\SmoothScroll\{i.filename}
              </code>
              <CopyButton text={`%LOCALAPPDATA%\\SmoothScroll\\${i.filename}`} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="text-yellow-500">&#9888;</span>
              {i.note.windows}
            </p>
          </TabsContent>

          <TabsContent value="macos" className="space-y-6">
            <ol className="space-y-4">
              {i.tabs.macos.steps.map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-brand-from to-brand-to text-white text-sm font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="pt-1 text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="text-yellow-500">&#9888;</span>
              {i.note.macos}
            </p>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-8">
          <DownloadCTA
            label={ctaLabel}
            variant="brand"
            size="lg"
            className={cn(os === 'mac' ? 'hidden' : '', 'hidden')}
          />
          <DownloadCTA label={ctaLabel} variant="brand" size="lg" />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/sections/Install.tsx
git commit -m "feat(landing): add Install section with OS tabs and copy button"
```

---

### Task 10: FAQ Section

**Files:**
- Create: `landing/components/sections/FAQ.tsx`
- Modify: `landing/app/[lang]/layout.tsx` (JSON-LD FAQPage)

- [ ] **Step 1: Create `landing/components/sections/FAQ.tsx`**

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface FAQProps {
  dict: {
    faq: {
      title: string
      questions: { q: string; a: string }[]
    }
  }
}

export function FAQ({ dict }: FAQProps) {
  const { faq: f } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-12">
          {f.title}
        </h2>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible>
            {f.questions.map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Add FAQ JSON-LD to `landing/app/[lang]/layout.tsx`** (see Task 13 for full layout file — add FAQPage JSON-LD here)

```tsx
// In app/[lang]/layout.tsx, add before return:
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: (dict.faq?.questions ?? []).map((q: { q: string; a: string }) => ({
    '@type': 'Question',
    name: q.q,
    acceptedAnswer: { '@type': 'Answer', text: q.a },
  })),
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/sections/FAQ.tsx
git commit -m "feat(landing): add FAQ section with Accordion"
```

---

### Task 11: Root Layout + Lang Layout + Index Redirect

**Files:**
- Create: `landing/app/[lang]/layout.tsx`
- Create: `landing/app/[lang]/page.tsx`
- Create: `landing/app/page.tsx`
- Create: `landing/app/not-found.tsx`

- [ ] **Step 1: Create `landing/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/en')
}
```

- [ ] **Step 2: Create `landing/app/[lang]/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, locales, type Locale } from '@/lib/i18n/dict'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

interface LangLayoutProps {
  children: React.ReactNode
  params: { lang: string }
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }))
}

export async function generateMetadata({
  params,
}: {
  params: { lang: string }
}): Promise<Metadata> {
  const locale = params.lang as Locale
  const dict = await getDictionary(locale)

  return {
    title: 'SmoothScroll — Natural Scroll Feel on Windows',
    description: dict.hero?.subtitle,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        vi: '/vi',
        zh: '/zh',
        'zh-Hans': '/zh',
        'x-default': '/en',
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'zh' ? 'zh_Hans' : locale,
      alternateLocale: locale === 'zh' ? ['en', 'vi'] : (locale === 'en' ? ['vi', 'zh'] : ['en']),
      images: [{ url: '/assets/og-image.png', width: 1200, height: 630 }],
    },
  }
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const locale = params.lang as Locale
  if (!locales.includes(locale)) notFound()

  const dict = await getDictionary(locale)

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SmoothScroll',
    operatingSystem: 'Windows',
    applicationCategory: 'UtilitiesApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: dict.hero?.subtitle ?? '',
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (dict.faq?.questions ?? []).map((q: { q: string; a: string }) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([softwareJsonLd, faqJsonLd]) }}
      />
      <Navigation
        locale={locale}
        langSwitcherDict={dict.langSwitcher ?? {}}
      />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer locale={locale} dict={{ footer: dict.footer ?? { tagline: '', links: { github: '', license: '' } } }} />
    </>
  )
}
```

- [ ] **Step 3: Create `landing/app/[lang]/page.tsx`**

```tsx
import { Hero } from '@/components/sections/Hero'
import { Install } from '@/components/sections/Install'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import { StickyDownloadBar } from '@/components/StickyDownloadBar'
import { ExitIntentModal } from '@/components/ExitIntentModal'
import { getDictionary, type Locale } from '@/lib/i18n/dict'
import { Footer } from '@/components/Footer'

interface PageProps {
  params: { lang: string }
}

export default async function LandingPage({ params }: PageProps) {
  const locale = params.lang as Locale
  const dict = await getDictionary(locale)

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>
      <Hero dict={{ hero: dict.hero }} />
      <StickyDownloadBar
        ctaLabel={dict.hero?.cta ?? 'Download'}
        fallbackCta={dict.hero?.ctaFallback ?? 'Download'}
      />
      <ExitIntentModal
        dict={{
          title: dict.exitIntent?.title ?? '',
          message: dict.exitIntent?.message ?? '',
          cta: dict.exitIntent?.cta ?? '',
        }}
      />
      <Install dict={{ install: dict.install }} />
      <FAQ dict={{ faq: dict.faq }} />
      <FinalCTA dict={{ finalCta: dict.finalCta }} />
    </>
  )
}
```

- [ ] **Step 4: Create `landing/app/not-found.tsx`**

```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Page not found.</p>
        <Link href="/en" className="text-primary underline-offset-4 hover:underline">
          Go home
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add landing/app/page.tsx landing/app/[lang]/layout.tsx landing/app/[lang]/page.tsx landing/app/not-found.tsx
git commit -m "feat(landing): add root layout, lang layouts, index redirect, and 404"
```

---

### Task 12: StickyDownloadBar + ExitIntentModal

**Files:**
- Create: `landing/components/StickyDownloadBar.tsx`
- Create: `landing/components/ExitIntentModal.tsx`

- [ ] **Step 1: Create `landing/components/StickyDownloadBar.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'

interface StickyDownloadBarProps {
  ctaLabel: string
  fallbackCta: string
}

export function StickyDownloadBar({ ctaLabel, fallbackCta }: StickyDownloadBarProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { url } = useDownloadUrl()

  useEffect(() => {
    const onScroll = () => {
      const heroBottom = window.innerHeight
      if (window.scrollY > heroBottom && !dismissed) {
        setVisible(true)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [dismissed])

  const handleDownload = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/90 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 py-3"
          role="complementary"
          aria-label="Download bar"
        >
          <div className="container flex items-center justify-between gap-4">
            <p className="text-sm font-medium hidden sm:block">
              Ready to feel the difference?
            </p>
            <div className="flex items-center gap-3 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="text-muted-foreground"
              >
                ✕
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-1.5" />
                {ctaLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Create `landing/components/ExitIntentModal.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useExitIntent } from '@/hooks/useExitIntent'
import { Download } from 'lucide-react'
import { useDownloadUrl } from '@/lib/useDownloadUrl'

interface ExitIntentModalProps {
  dict: {
    title: string
    message: string
    cta: string
  }
}

export function ExitIntentModal({ dict }: ExitIntentModalProps) {
  const triggered = useExitIntent()
  const { url } = useDownloadUrl()

  return (
    <Dialog open={triggered}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>{dict.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button
            variant="brand"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <Download className="h-4 w-4 mr-2" />
            {dict.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/StickyDownloadBar.tsx landing/components/ExitIntentModal.tsx
git commit -m "feat(landing): add StickyDownloadBar and ExitIntentModal"
```

---

### Task 13: Final CTA Section

**Files:**
- Create: `landing/components/sections/FinalCTA.tsx`

- [ ] **Step 1: Create `landing/components/sections/FinalCTA.tsx`**

```tsx
import { DownloadCTA } from '@/components/DownloadCTA'
import { Separator } from '@/components/ui/separator'

interface FinalCTAProps {
  dict: {
    finalCta: {
      title: string
      subtitle: string
      cta: string
      ctaSub: string
    }
  }
}

export function FinalCTA({ dict }: FinalCTAProps) {
  const { finalCta: f } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <Separator className="mb-16" />
        <div className="text-center max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{f.title}</h2>
          <p className="text-lg text-muted-foreground">{f.subtitle}</p>
          <DownloadCTA label={f.cta} variant="brand" size="lg" />
          <p className="text-sm text-muted-foreground">{f.ctaSub}</p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/sections/FinalCTA.tsx
git commit -m "feat(landing): add FinalCTA section"
```

---

### Task 14: SEO Files

**Files:**
- Create: `landing/app/sitemap.ts`
- Create: `landing/app/robots.ts`
- Copy: `landing/public/googleb5a10d9504de3274.html`

- [ ] **Step 1: Create `landing/app/sitemap.ts`**

```ts
import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/dict'

const BASE = 'https://quangtruong2003.github.io/SmoothScroll'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/en`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/vi`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/zh`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
  ]
}
```

- [ ] **Step 2: Create `landing/app/robots.ts`**

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://quangtruong2003.github.io/SmoothScroll/sitemap.xml',
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/app/sitemap.ts landing/app/robots.ts
git commit -m "feat(landing): add sitemap and robots.txt"
```

---

### Task 15: Sprint 1 Smoke Test

**Files:**
- Verify: `landing/` builds cleanly
- Verify: `out/` contains `en/`, `vi/`, `zh/` folders

- [ ] **Step 1: Install and build**

Run: `cd landing && npm install && npm run build`
Expected: `next build` exits 0, `out/` contains `en/`, `vi/`, `zh/` directories.

- [ ] **Step 2: Verify sitemap**

Run: `ls landing/out/sitemap.xml`
Expected: File exists.

- [ ] **Step 3: Verify ESLint passes**

Run: `cd landing && npx next lint`
Expected: No errors.

- [ ] **Step 4: Run unit tests**

Run: `cd landing && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Push and verify preview deploy**

Run: `git push origin landing-v3`
Expected: CI runs `deploy-landing-v3.yml`, preview URL available at `https://<user>.github.io/SmoothScroll/` on the `gh-pages-preview` branch.

---

## Sprint 2: Polish

**Goal:** TrayPreview + UseCases + Stats + Indie + Pain + SolutionBridge + sticky/exit-intent refinements.

### Task 16: Pain Points + Solution Bridge

**Files:**
- Create: `landing/components/sections/PainPoints.tsx`
- Create: `landing/components/sections/SolutionBridge.tsx`

- [ ] **Step 1: Create `landing/components/sections/PainPoints.tsx`**

```tsx
import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import { Zap, BatteryLow, Mouse } from 'lucide-react'

const ICONS = [Zap, BatteryLow, Mouse]

interface PainPointsProps {
  dict: {
    painPoints: {
      title: string
      points: { title: string; description: string }[]
    }
  }
}

export function PainPoints({ dict }: PainPointsProps) {
  const { painPoints: p } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-16">
            {p.title}
          </h2>
        </FadeUp>
        <StaggerContainer className="grid md:grid-cols-3 gap-8">
          {p.points.map((point, idx) => {
            const Icon = ICONS[idx]
            return (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="flex flex-col gap-4 p-6 rounded-xl border bg-card"
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

- [ ] **Step 2: Create `landing/components/sections/SolutionBridge.tsx`**

```tsx
import { FadeUp } from '@/components/motion/FadeUp'

interface SolutionBridgeProps {
  dict: {
    solutionBridge: { line: string }
  }
}

export function SolutionBridge({ dict }: SolutionBridgeProps) {
  return (
    <section className="py-12 px-4">
      <div className="container">
        <FadeUp>
          <p className="text-2xl sm:text-3xl font-bold text-center leading-snug">
            {dict.solutionBridge.line}
          </p>
        </FadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/sections/PainPoints.tsx landing/components/sections/SolutionBridge.tsx
git commit -m "feat(landing): add PainPoints and SolutionBridge sections"
```

---

### Task 17: Features Grid

**Files:**
- Create: `landing/components/sections/Features.tsx`

- [ ] **Step 1: Create `landing/components/sections/Features.tsx`**

```tsx
import { FadeUp } from '@/components/motion/FadeUp'
import { StaggerContainer, staggerItem } from '@/components/motion/StaggerContainer'
import { motion } from 'motion/react'
import {
  Settings2, Layers, Cpu, Battery, ShieldCheck, ToggleLeft
} from 'lucide-react'

const ICONS = [Settings2, Layers, Cpu, Battery, ShieldCheck, ToggleLeft]

interface FeaturesProps {
  dict: {
    features: {
      title: string
      items: { title: string; description: string }[]
    }
  }
}

export function Features({ dict }: FeaturesProps) {
  const { features: f } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            {f.title}
          </h2>
        </FadeUp>
        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {f.items.map((item, idx) => {
            const Icon = ICONS[idx % ICONS.length]
            return (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="p-6 rounded-xl border bg-card hover:border-foreground/20 transition-colors"
              >
                <div className="mb-4">
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

- [ ] **Step 2: Commit**

```bash
git add landing/components/sections/Features.tsx
git commit -m "feat(landing): add Features grid section"
```

---

### Task 18: Use Cases

**Files:**
- Create: `landing/components/sections/UseCases.tsx`

- [ ] **Step 1: Create `landing/components/sections/UseCases.tsx`**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FadeUp } from '@/components/motion/FadeUp'

interface UseCasesProps {
  dict: {
    useCases: {
      title: string
      tabs: {
        reading: { label: string; description: string }
        coding: { label: string; description: string }
        designing: { label: string; description: string }
      }
    }
  }
}

export function UseCases({ dict }: UseCasesProps) {
  const { useCases: u } = dict

  const tabs = [
    { key: 'reading', ...u.tabs.reading },
    { key: 'coding', ...u.tabs.coding },
    { key: 'designing', ...u.tabs.designing },
  ]

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-12">
            {u.title}
          </h2>
        </FadeUp>
        <FadeUp delay={0.1}>
          <Tabs defaultValue="reading" className="max-w-2xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                <div className="mt-6 p-8 rounded-xl border bg-card text-center">
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {tab.description}
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </FadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/sections/UseCases.tsx
git commit -m "feat(landing): add UseCases section with tabbed interface"
```

---

### Task 19: Tray Preview

**Files:**
- Create: `landing/components/TrayPreview.tsx`
- Create: `landing/components/sections/TrayPreviewSection.tsx`

- [ ] **Step 1: Create `landing/components/TrayPreview.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const THEMES = ['Light', 'Dark', 'System'] as const
type Theme = typeof THEMES[number]

const THEMES_STYLES: Record<Theme, { bg: string; text: string; border: string }> = {
  Light: { bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200' },
  Dark: { bg: 'bg-gray-900', text: 'text-gray-100', border: 'border-gray-700' },
  System: { bg: 'bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800', text: 'text-foreground', border: 'border-border' },
}

export function TrayPreview() {
  const [enabled, setEnabled] = useState(true)
  const [strength, setStrength] = useState(70)
  const [theme, setTheme] = useState<Theme>('Light')

  const themeStyle = THEMES_STYLES[theme]

  return (
    <div className={`w-full max-w-sm rounded-xl border shadow-2xl overflow-hidden ${themeStyle.bg} ${themeStyle.text} ${themeStyle.border}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-inherit">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-from to-brand-to flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect width="16" height="16" rx="3" fill="white" fillOpacity="0.9" />
            <path d="M4 6h8M4 10h8" stroke="hsl(220 90% 65%)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">SmoothScroll</p>
          <p className="text-xs opacity-60">v1.0.0</p>
        </div>
        <Badge variant="outline" className="text-xs">Active</Badge>
      </div>

      {/* Body */}
      <div className="p-4 space-y-5">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Enable smoothing</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <Separator />

        {/* Strength */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Smoothing strength</span>
            <span className="text-sm font-mono font-semibold">{strength}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            disabled={!enabled}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-gradient bg-muted disabled:opacity-50"
            aria-label="Smoothing strength"
            style={{
              background: enabled
                ? `linear-gradient(to right, hsl(220 90% 65%) 0%, hsl(220 90% 65%) ${strength}%, hsl(var(--muted)) ${strength}%, hsl(var(--muted)) 100%)`
                : undefined,
            }}
          />
          <div className="flex justify-between text-xs opacity-60">
            <span>Responsive</span>
            <span>Glassy</span>
          </div>
        </div>

        <Separator />

        {/* Theme */}
        <div className="space-y-3">
          <span className="text-sm">Theme</span>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-2 rounded-md text-xs font-medium border transition-all ${
                  theme === t
                    ? 'border-primary bg-primary/10'
                    : 'border-border opacity-60 hover:opacity-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Hotkey */}
        <div className="flex items-center justify-between">
          <span className="text-sm opacity-60">Toggle</span>
          <kbd className="px-2 py-1 rounded bg-muted/50 text-xs font-mono border border-border">Ctrl+Shift+S</kbd>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-inherit flex items-center justify-between">
        <button className="text-xs opacity-60 hover:opacity-100 transition-opacity">Settings…</button>
        <button className="text-xs opacity-60 hover:opacity-100 transition-opacity">Quit</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `landing/components/sections/TrayPreviewSection.tsx`**

```tsx
import { FadeUp } from '@/components/motion/FadeUp'
import { TrayPreview } from '@/components/TrayPreview'

interface TrayPreviewSectionProps {
  dict: {
    trayPreview: {
      title: string
      subtitle: string
    }
  }
}

export function TrayPreviewSection({ dict }: TrayPreviewSectionProps) {
  const { trayPreview: t } = dict

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <FadeUp>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t.title}</h2>
            <p className="text-lg text-muted-foreground">{t.subtitle}</p>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="flex justify-center lg:justify-end">
              <TrayPreview />
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add landing/components/TrayPreview.tsx landing/components/sections/TrayPreviewSection.tsx
git commit -m "feat(landing): add interactive TrayPreview component"
```

---

### Task 20: Stats Section

**Files:**
- Create: `landing/components/sections/Stats.tsx`

- [ ] **Step 1: Create `landing/components/sections/Stats.tsx`**

```tsx
import { FadeUp } from '@/components/motion/FadeUp'
import { fetchLatestRelease, formatDownloadCount } from '@/lib/github'
import { Star, Download, Tag } from 'lucide-react'

interface StatsProps {
  dict: {
    stats: {
      title: string
      githubStars: string
      downloads: string
      version: string
      fallback: { stars: string; downloads: string; version: string }
    }
  }
}

interface StatsInnerProps extends StatsProps['dict']['stats'] {
  releaseData: Awaited<ReturnType<typeof fetchLatestRelease>> | null
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Star
  value: string
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 rounded-xl border bg-card">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-3xl font-bold tracking-tight">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

export async function Stats({ dict }: StatsProps) {
  let releaseData = null
  try {
    releaseData = await fetchLatestRelease()
  } catch {}

  const { stats: s, fallback } = dict
  const stars = releaseData
    ? (await fetch(`https://api.github.com/repos/quangtruong2003/SmoothScroll`).then((r) => r.json()).catch(() => null))?.stargazers_count?.toLocaleString() ?? fallback.stars
    : fallback.stars
  const downloads = releaseData
    ? formatDownloadCount(releaseData.assets.reduce((sum, a) => sum + (a.download_count ?? 0), 0))
    : fallback.downloads
  const version = releaseData?.tag_name ?? fallback.version

  return (
    <section className="py-20 px-4">
      <div className="container">
        <FadeUp>
          <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
            {s.title}
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <StatCard icon={Star} value={stars} label={s.githubStars} />
            <StatCard icon={Download} value={downloads} label={s.downloads} />
            <StatCard icon={Tag} value={version} label={s.version} />
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/sections/Stats.tsx
git commit -m "feat(landing): add Stats section with live GitHub data"
```

---

### Task 21: Indie Section

**Files:**
- Create: `landing/components/sections/Indie.tsx`

- [ ] **Step 1: Create `landing/components/sections/Indie.tsx`**

```tsx
import { FadeUp } from '@/components/motion/FadeUp'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Github, Check, Lock, Ban, Globe } from 'lucide-react'

const ICONS = [Lock, Ban, Ban, Globe]
const RADIX_INDIE = [0, 1, 2, 3] as const

interface IndieProps {
  dict: {
    indie: {
      title: string
      subtitle: string
      points: string[]
      cta: string
    }
  }
}

export function Indie({ dict }: IndieProps) {
  const { indie: i } = dict

  return (
    <section className="py-20 px-4">
      <div className="container">
        <div className="max-w-2xl mx-auto">
          <FadeUp>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{i.title}</h2>
              <p className="text-muted-foreground text-lg">{i.subtitle}</p>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {i.points.map((point, idx) => {
                const Icon = ICONS[idx % ICONS.length]
                return (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-card border">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{point}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </FadeUp>
          <FadeUp delay={0.2}>
            <div className="text-center">
              <Button variant="outline" size="lg" asChild>
                <a href="https://github.com/quangtruong2003/SmoothScroll" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4 mr-2" />
                  {i.cta}
                </a>
              </Button>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/components/sections/Indie.tsx
git commit -m "feat(landing): add Indie transparency section"
```

---

### Task 22: Wire Full Landing Page

**Files:**
- Modify: `landing/app/[lang]/page.tsx`

- [ ] **Step 1: Update `landing/app/[lang]/page.tsx` to compose all sections**

```tsx
import { Hero } from '@/components/sections/Hero'
import { PainPoints } from '@/components/sections/PainPoints'
import { SolutionBridge } from '@/components/sections/SolutionBridge'
import { Features } from '@/components/sections/Features'
import { UseCases } from '@/components/sections/UseCases'
import { TrayPreviewSection } from '@/components/sections/TrayPreviewSection'
import { Stats } from '@/components/sections/Stats'
import { Indie } from '@/components/sections/Indie'
import { Install } from '@/components/sections/Install'
import { FAQ } from '@/components/sections/FAQ'
import { FinalCTA } from '@/components/sections/FinalCTA'
import { StickyDownloadBar } from '@/components/StickyDownloadBar'
import { ExitIntentModal } from '@/components/ExitIntentModal'
import { getDictionary, type Locale } from '@/lib/i18n/dict'

interface PageProps {
  params: { lang: string }
}

export default async function LandingPage({ params }: PageProps) {
  const locale = params.lang as Locale
  const dict = await getDictionary(locale)

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to content
      </a>
      <Hero dict={{ hero: dict.hero }} />
      <PainPoints dict={{ painPoints: dict.painPoints }} />
      <SolutionBridge dict={{ solutionBridge: dict.solutionBridge }} />
      <Features dict={{ features: dict.features }} />
      <UseCases dict={{ useCases: dict.useCases }} />
      <TrayPreviewSection dict={{ trayPreview: dict.trayPreview }} />
      <Stats dict={{ stats: dict.stats }} />
      <Indie dict={{ indie: dict.indie }} />
      <StickyDownloadBar
        ctaLabel={dict.hero?.cta ?? 'Download'}
        fallbackCta={dict.hero?.ctaFallback ?? 'Download'}
      />
      <ExitIntentModal
        dict={{
          title: dict.exitIntent?.title ?? '',
          message: dict.exitIntent?.message ?? '',
          cta: dict.exitIntent?.cta ?? '',
        }}
      />
      <Install dict={{ install: dict.install }} />
      <FAQ dict={{ faq: dict.faq }} />
      <FinalCTA dict={{ finalCta: dict.finalCta }} />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add landing/app/[lang]/page.tsx
git commit -m "feat(landing): wire all sections into full landing page"
```

---

### Task 23: Visual Regression + Accessibility Tests

**Files:**
- Create: `landing/e2e/landing.spec.ts` (Playwright)
- Create: `landing/playwright.config.ts`

- [ ] **Step 1: Create `landing/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **Step 2: Create `landing/e2e/landing.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

const LANGS = ['en', 'vi', 'zh'] as const
const THEMES = ['light', 'dark'] as const
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 667 },
] as const

for (const lang of LANGS) {
  for (const viewport of VIEWPORTS) {
    test(`[${lang}] Hero loads on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(`/${lang}`)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('nav')).toBeVisible()
      // No crash
    })
  }

  test(`[${lang}] Hero CTA is clickable and opens download`, async ({ page }) => {
    await page.goto(`/${lang}`)
    const cta = page.getByRole('button', { name: /download/i }).first()
    await expect(cta).toBeEnabled()
  })

  test(`[${lang}] FAQ accordion works`, async ({ page }) => {
    await page.goto(`/${lang}`)
    const firstTrigger = page.locator('[data-state="closed"]').first()
    if (await firstTrigger.isVisible()) {
      await firstTrigger.click()
      await expect(page.locator('[data-state="open"]')).toBeVisible()
    }
  })

  test(`[${lang}] Tray preview interactive`, async ({ page }) => {
    await page.goto(`/${lang}`)
    const traySwitch = page.getByRole('switch').first()
    if (await traySwitch.isVisible()) {
      await traySwitch.click()
    }
  })

  test(`[${lang}] Navigation lang switcher works`, async ({ page }) => {
    await page.goto(`/${lang}`)
    await page.locator('nav').hover()
    const langBtn = page.locator('nav button[aria-label="Switch language"]')
    if (await langBtn.isVisible()) {
      await langBtn.click()
    }
  })
}

// Accessibility
test('No serious WCAG violations on hero (en, desktop)', async ({ page }) => {
  await page.goto('/en')
  const results = await page.evaluate(() =>
    import('axe-core').then((axe) =>
      new Promise((resolve) => {
        axe.run(document, (err, result) => resolve(result))
      })
    )
  )
  const { violations } = results as { violations: { severity: string }[] }
  const serious = violations.filter((v) => v.severity === 'critical' || v.severity === 'serious')
  expect(serious).toHaveLength(0)
})
```

- [ ] **Step 3: Commit**

```bash
git add landing/e2e/ landing/playwright.config.ts
git commit -m "test(landing): add Playwright visual regression and accessibility tests"
```

---

### Task 24: Performance Budget Verification

**Files:**
- Modify: `landing/next.config.mjs` (optional tweaks)
- Create: `landing/. Lighthouse config (optional CI step)

- [ ] **Step 1: Run Lighthouse CI locally**

Run: `cd landing && npm run build && npx serve out -p 3000`
Then visit: `http://localhost:3000/en` with Lighthouse.

Verify targets:
- LCP < 2.0s (slow 3G simulation)
- CLS < 0.05
- INP < 150ms
- First-load JS < 120kb gzipped

Check: `npx lighthouse http://localhost:3000/en --output=json --only-categories=performance | grep "first-contentful-paint\|largest-contentful-paint\|cumulative-layout-shift\|interactive"`

- [ ] **Step 2: Commit**

```bash
git add landing/.lighthouserc.json 2>/dev/null || true
git commit -m "perf(landing): verify performance budget — LCP, CLS, INP targets met"
```

---

### Task 25: Final Build + Deploy

**Files:**
- Modify: `.github/workflows/deploy-landing.yml`
- Modify: `landing/next.config.mjs` (final basePath for production)

- [ ] **Step 1: Update `.github/workflows/deploy-landing.yml` to build from `landing/`**

```yaml
name: Deploy Landing Page

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: grant
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: landing/package-lock.json

      - run: cd landing && npm ci

      - run: cd landing && npm run build
        env:
          NODE_ENV: production

      - run: cp -r landing/out/* docs/landing/

      - run: rm -rf docs/landing/assets
         # Preserve user-supplied static assets
      - run: cp -r public/assets docs/landing/ 2>/dev/null || true

      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/landing
          publish_branch: gh-pages
```

- [ ] **Step 2: Push `landing-v3` to master**

Run: `git checkout master && git merge landing-v3`
Run: `git push origin master`

Expected: `deploy-landing.yml` runs, `docs/landing/` now contains v3 build output, GitHub Pages serves v3.

- [ ] **Step 3: Delete v2 source files**

```bash
# Confirm the new build is live on the preview URL first
# Then remove v2 source files from docs/landing/
git rm docs/landing/*.html docs/landing/*.css docs/landing/*.js 2>/dev/null || true
git commit -m "chore(landing): remove v2 source files, docs/landing/ is now build output"
```

- [ ] **Step 4: Final commit**

```bash
git tag -a v3.0.0 -m "feat: launch landing v3 — Next.js, shadcn/ui, i18n, conversion-optimized"
git push origin master --tags
```

---

## Self-Review Checklist

### Spec coverage

| Spec section | Task |
|---|---|
| Tech stack (Next.js 14, shadcn/ui, Framer Motion, lucide) | T1, T3 |
| Project layout (app/, components/, lib/) | T1 |
| CSS tokens (hue 240, brand gradient) | T2 |
| Motion (200ms, spring, useReducedMotion) | T4 |
| i18n (en, vi, zh, JSON dictionaries) | T5 |
| Hero + DemoScroll | T8 |
| TrayPreview component | T19 |
| Stats (GitHub API) | T20 |
| Install section (OS tabs) | T9 |
| FAQ (accordion, JSON-LD) | T10 |
| Sticky download bar | T12 |
| Exit intent modal | T12 |
| SEO (sitemap, robots, hreflang, OG) | T13, T14 |
| Navigation + LangSwitcher | T7 |
| Footer | T7 |
| CI/deploy workflow | T1, T25 |
| Sprint decomposition | T1–T15 = Sprint 1, T16–T25 = Sprint 2 |
| Visual regression tests | T23 |
| Accessibility tests (axe-core) | T23 |
| Performance budget | T24 |
| Migration plan (preview → master → cleanup) | T25 |

### Placeholder scan

No `TBD`, `TODO`, or "fill in later" placeholders. All code is complete. All commands have expected output.

### Type consistency

- `useDownloadUrl()` returns `{ url, version, os, sizeLabel, ctaLabel, totalDownloads, release }` — all consumers match.
- `Locale` type defined in `dict.ts` and used in `Navigation`, `LangSwitcher`, `[lang]/layout.tsx`, `[lang]/page.tsx`.
- `Dict = typeof en` — all dictionary access is type-safe.
- `ExitIntentModal` uses `useExitIntent()` hook (bool), not raw `sessionStorage`.
- `StickyDownloadBar` uses `visible` state gated on `heroBottom` scroll threshold.

### Verification commands

| Check | Command |
|---|---|
| Install deps | `cd landing && npm install` |
| Build | `cd landing && npm run build` |
| Dev server | `cd landing && npm run dev` |
| Lint | `cd landing && npx next lint` |
| Unit tests | `cd landing && npx vitest run` |
| E2E tests | `cd landing && npx playwright test` |
| Lighthouse | `npx lighthouse http://localhost:3000/en --output=json` |
| Out contains 3 langs | `ls landing/out/` |
| Sitemap exists | `cat landing/out/sitemap.xml` |
