import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/i18n/dict'
import { localePath } from '@/lib/i18n/routing'

interface BackToHomeProps {
  locale: Locale
  label: string
  className?: string
}

export function BackToHome({ locale, label, className }: BackToHomeProps) {
  return (
    <Link
      href={localePath(locale, 'home')}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  )
}
