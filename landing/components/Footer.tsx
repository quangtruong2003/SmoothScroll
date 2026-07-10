import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/provider'
import type { Dictionary } from '@/lib/i18n/dict'

export function Footer() {
  const { dict } = useLanguage()
  const d = dict as Dictionary | null
  const { footer: f = { tagline: '', links: { github: '', license: '' } } } = d ?? {}

  return (
    <footer className="border-t py-8 pb-8 sm:pb-8 mt-16">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{f.tagline ?? ''}</p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            href="https://github.com/quangtruong2003/SmoothScroll"
            className="hover:text-foreground transition-colors"
            aria-label="SmoothScroll repository on GitHub (opens new tab)"
          >
            {f.links?.github ?? ''}
          </Link>
          <Link href="https://github.com/quangtruong2003/SmoothScroll/blob/main/LICENSE" className="hover:text-foreground transition-colors">
            {f.links?.license ?? ''}
          </Link>
        </div>
      </div>
    </footer>
  )
}
