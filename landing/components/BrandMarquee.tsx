'use client'

import type { CSSProperties } from 'react'
import { BRANDS, type Brand } from '@/lib/brands'

import {
  siApple,
  siGooglechrome,
  siFirefoxbrowser,
  siCursor,
  siIntellijidea,
  siWebstorm,
  siPycharm,
  siNotion,
  siFigma,
  siDiscord,
} from 'simple-icons'

interface SimpleIcon {
  title: string
  slug: string
  path: string
  hex: string
}

const ICON_BY_SLUG: Record<string, SimpleIcon> = {
  apple: siApple,
  googlechrome: siGooglechrome,
  firefoxbrowser: siFirefoxbrowser,
  cursor: siCursor,
  intellijidea: siIntellijidea,
  webstorm: siWebstorm,
  pycharm: siPycharm,
  notion: siNotion,
  figma: siFigma,
  discord: siDiscord,
}

function pathFor(brand: Brand): string | null {
  if (brand.customPath) return brand.customPath
  const icon = ICON_BY_SLUG[brand.slug]
  return icon ? icon.path : null
}

function BrandItem({ brand }: { brand: Brand }) {
  const path = pathFor(brand)
  const style = {
    '--brand-light': brand.hexLight,
    '--brand-dark': brand.hexDark,
  } as CSSProperties

  return (
    <li
      data-brand-item
      role="listitem"
      aria-label={brand.name}
      style={style}
      className="inline-flex items-center gap-2 shrink-0"
    >
      <span className="inline-flex items-center justify-center brand-marquee-glyph">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          aria-hidden="true"
        >
          {path ? <path d={path} /> : <rect width="24" height="24" rx="4" />}
        </svg>
      </span>
      <span className="text-sm font-medium text-muted-foreground/85">
        {brand.name}
      </span>
    </li>
  )
}

function BrandRow({ ariaHidden }: { ariaHidden: boolean }) {
  return (
    <ul
      data-brand-copy
      {...(ariaHidden ? { 'aria-hidden': true } : {})}
      role="list"
      className="flex items-center gap-10 shrink-0 px-5"
    >
      {BRANDS.map((b) => (
        <BrandItem key={b.slug} brand={b} />
      ))}
    </ul>
  )
}

export function BrandMarquee() {
  return (
    <div
      className="relative overflow-hidden py-6 brand-marquee-mask pointer-events-none select-none"
      role="region"
      aria-label="Compatible apps and operating systems"
    >
      <div className="brand-marquee-track flex w-max items-center">
        <BrandRow ariaHidden={false} />
        <BrandRow ariaHidden />
      </div>
    </div>
  )
}
