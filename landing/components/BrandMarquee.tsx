'use client'

import { BRANDS, type Brand } from '@/lib/brands'

function BrandItem({ brand }: { brand: Brand }) {
  return (
    <li
      data-brand-item
      role="listitem"
      aria-label={brand.name}
      className="inline-flex items-center gap-2 shrink-0"
    >
      <img
        src={brand.src}
        alt=""
        width={24}
        height={24}
        decoding="async"
        loading="lazy"
        className={
          'h-6 w-6 ' + (brand.invertOnDark ? 'dark:invert' : '')
        }
      />
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
