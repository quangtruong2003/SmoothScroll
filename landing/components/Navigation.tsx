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
    fetch('https://api.github.com/repos/grayscut/SmoothScroll')
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
              href="https://github.com/grayscut/SmoothScroll"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Star className="h-4 w-4" />
              <span>{stars}</span>
            </a>
          )}
          <a
            href="https://github.com/grayscut/SmoothScroll"
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
