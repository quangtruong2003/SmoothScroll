'use client'

import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { Download } from 'lucide-react'

interface DownloadCTAProps {
  label: string
  labelMac?: string
  betaBadge?: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
}

export function DownloadCTA({
  label,
  labelMac,
  betaBadge = 'BETA',
  variant = 'brand',
  size = 'xl',
  className,
}: DownloadCTAProps) {
  const { url, filename, isBeta } = useDownloadUrl()
  const displayLabel = isBeta && labelMac ? labelMac : label

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      asChild
      aria-label={displayLabel}
    >
      <a
        href={url}
        rel="noopener noreferrer"
        download={filename || undefined}
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smoothscroll:downloaded'))
          }
        }}
      >
        <Download className="h-5 w-5 mr-2" />
        {displayLabel}
        {isBeta && (
          <span className="ml-2 inline-flex items-center rounded-md bg-orange-500/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-orange-500 ring-1 ring-inset ring-orange-500/40">
            {betaBadge}
          </span>
        )}
      </a>
    </Button>
  )
}
