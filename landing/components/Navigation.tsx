'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, Github } from 'lucide-react'
import dynamic from 'next/dynamic'

const ScrollToTop = dynamic(() => import('./ScrollToTop').then(m => m.ScrollToTop), { ssr: false })
import { Button } from '@/components/ui/button'
import { LangSwitcher } from './LangSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { useGitHubStars } from '@/lib/useGitHubStars'
import { useLanguage } from '@/lib/i18n/provider'
import type { Dictionary } from '@/lib/i18n/dict'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

interface NavigationProps {
  locale: string
  dict?: Dictionary | null
}

export function Navigation({ locale, dict }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false)
  const stars = useGitHubStars()
  const { locale: contextLocale } = useLanguage()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-200 ${
          scrolled
            ? 'bg-background/80 backdrop-blur-md border-b shadow-sm py-2'
            : 'bg-transparent py-4'
        }`}
      >
        <nav className="container flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <Image
              src={`${BASE_PATH}/assets/icon-128.png`}
              alt="SmoothScroll logo"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="hidden sm:inline">SmoothScroll</span>
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
            <LangSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <ScrollToTop />
    </>
  )
}
