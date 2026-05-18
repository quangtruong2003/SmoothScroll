'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, Github } from 'lucide-react'
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
            src={`${BASE_PATH}/assets/icon-128.png`}
            alt="SmoothScroll logo"
            width={28}
            height={28}
            priority
            className="rounded-md"
          />
          SmoothScroll
        </Link>

        <div className="flex items-center gap-4">
          {stars !== null && (
            <a
              href="https://github.com/quangtruong2003/SmoothScroll"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Star className="h-4 w-4" />
              <span>{stars.toLocaleString()}</span>
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
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
