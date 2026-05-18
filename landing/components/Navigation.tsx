'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LangSwitcher } from './LangSwitcher'
import type { Locale } from '@/lib/i18n/dict'

interface NavigationProps {
  locale: Locale
  langSwitcherDict?: Record<string, string>
}

export function Navigation({ locale, langSwitcherDict = {} }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false)
  const [stars, setStars] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const cached = typeof window !== 'undefined' ? sessionStorage.getItem('gh-stars') : null
    if (cached) {
      setStars(cached)
      return
    }
    fetch('https://api.github.com/repos/quangtruong2003/SmoothScroll')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const value = d?.stargazers_count?.toLocaleString() ?? null
        if (value) {
          setStars(value)
          try { sessionStorage.setItem('gh-stars', value) } catch {}
        }
      })
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
          <Image
            src="/assets/icon-128.png"
            alt="SmoothScroll logo"
            width={28}
            height={28}
            priority
            className="rounded-md"
          />
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
