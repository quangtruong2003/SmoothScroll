'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/provider'
import { localePath, type PageKind } from '@/lib/i18n/routing'
import type { Dictionary } from '@/lib/i18n/dict'
import { intentLinks, intentPath } from '@/lib/seo/intent-links'
import { LangSwitcher } from './LangSwitcher'
import { ThemeToggle } from './ThemeToggle'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const GITHUB_REPO = 'https://github.com/quangtruong2003/SmoothScroll'

const linkClass = 'transition-colors hover:text-foreground'

interface FooterProps {
  pageKind?: PageKind
}

export function Footer({ pageKind = 'home' }: FooterProps) {
  const { dict, locale } = useLanguage()
  const d = dict as Dictionary | null
  const { footer: f } = d ?? {}

  // Windows-only product: every visitor sees the Windows tagline so crawlers
  // and mobile users never get a macOS/Linux promise we cannot keep.
  const tagline = f?.taglineWindows ?? f?.tagline ?? ''

  return (
    <footer className="mt-16 border-t">
      <div className="container py-0">
        <h2 className="sr-only">Site links</h2>
        <div className="grid grid-cols-2 border-l sm:grid-cols-3">
          <div className="border-b border-r p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground">{f?.headings?.product ?? 'Product'}</h3>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <li>
                <Link href={localePath(locale, 'how-it-works')} className={linkClass}>
                  {f?.product?.howItWorks ?? 'How it works'}
                </Link>
              </li>
              <li>
                <Link href={`${localePath(locale, 'home')}#install`} className={linkClass}>
                  {f?.product?.install ?? 'Download'}
                </Link>
              </li>
              <li>
                <Link href={localePath(locale, 'faq')} className={linkClass}>
                  {f?.product?.faq ?? 'FAQ'}
                </Link>
              </li>
              <li>
                <Link href={localePath(locale, 'privacy')} className={linkClass}>
                  {f?.links?.privacy ?? 'Privacy'}
                </Link>
              </li>
            </ul>
          </div>
          <div className="border-b border-r p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground">{f?.headings?.guides ?? 'Guides'}</h3>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
              {intentLinks.map((guide) => (
                <li key={guide.slug}>
                  <Link href={intentPath(guide.slug)} className={linkClass}>
                    {guide.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-2 border-b border-r p-5 sm:col-span-1 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground">{f?.headings?.project ?? 'Project'}</h3>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <li>
                <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="SmoothScroll repository on GitHub (opens new tab)">
                  {f?.links?.github ?? 'GitHub'}
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/issues`} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label="Report an issue on GitHub (opens new tab)">
                  {f?.project?.issues ?? 'Report an issue'}
                </a>
              </li>
              <li>
                <a href={`${GITHUB_REPO}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {f?.links?.license ?? 'License'}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm text-muted-foreground">
            <Image src={`${BASE_PATH}/assets/icon-128.png`} alt="" width={20} height={20} className="mt-px h-5 w-5 shrink-0 rounded-md" />
            <span>{f?.copyright ?? '© 2026 SmoothScroll.'} {tagline} {f?.madeBy ?? 'Made by Nguyễn Quang Trường in Ho Chi Minh City.'}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <LangSwitcher pageKind={pageKind} openUp />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}
