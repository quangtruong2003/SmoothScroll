'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, Github } from 'lucide-react'
import { ScrollToTop } from './ScrollToTop'
import { DotGridToggle } from './DotGridToggle'
import { Button } from '@/components/ui/button'
import { LangSwitcher } from './LangSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { useGitHubStars } from '@/lib/useGitHubStars'
import type { Locale } from '@/lib/i18n/dict'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface NavigationProps {
  locale: Locale
  langSwitcherDict?: Record<string, string>
}

export function Navigation({ locale, langSwitcherDict = {} }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false)
  const stars = useGitHubStars()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:shadow-lg"
      >
        Skip to content
      </a>
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-200 ${
          scrolled
            ? 'bg-background/80 backdrop-blur-md border-b shadow-sm py-2'
            : 'bg-transparent py-4'
        }`}
      >
        <nav className="container flex items-center justify-between gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-2 font-bold text-lg">
            <Image
              src={`${BASE_PATH}/assets/icon-128.png`}
              alt="SmoothScroll logo"
              width={28}
              height={28}
              className="rounded-md"
            />
            SmoothScroll
          </Link>

          <div className="flex items-center gap-2">
            {stars !== null && (
              <a
                href="https://github.com/quangtruong2003/SmoothScroll"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden xl:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Star className="h-4 w-4" />
                <span>{stars.toLocaleString()}</span>
              </a>
            )}
            <a
              href="https://github.com/quangtruong2003/SmoothScroll"
              target="_blank"
              rel="noopener noreferrer"
              className="flex"
              aria-label="SmoothScroll on GitHub (opens new tab)"
            >
              <Button variant="ghost" size="sm">
                <Github className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">GitHub</span>
              </Button>
            </a>
            <LangSwitcher locale={locale} dict={{ langSwitcher: langSwitcherDict }} />
            <DotGridToggle />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <ScrollToTop />
    </>
  )
}
