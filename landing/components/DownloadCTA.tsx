'use client'

import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { Download } from 'lucide-react'

interface DownloadCTAProps {
  label: string
  labelLinux?: string
  labelMac?: string
  betaBadge?: string
  comingSoonLabel?: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
}

export function DownloadCTA({
  label,
  labelLinux,
  labelMac,
  betaBadge = 'BETA',
  comingSoonLabel = 'Coming Soon',
  variant = 'brand',
  size = 'xl',
  className,
}: DownloadCTAProps) {
  const { url, filename, isBeta, isMac, isLinux } = useDownloadUrl()
  const displayLabel = isLinux && labelLinux ? labelLinux : isBeta && labelMac ? labelMac : label

  if (isMac) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled
        aria-label="macOS support coming soon"
      >
        <Download className="h-5 w-5 mr-2" />
        {displayLabel}
        <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          {comingSoonLabel}
        </span>
      </Button>
    )
  }

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
        {isLinux && (
          <span className="ml-2 inline-flex items-center rounded-md bg-green-500/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-green-500 ring-1 ring-inset ring-green-500/40">
            NEW
          </span>
        )}
        {isBeta && !isLinux && (
          <span className="ml-2 inline-flex items-center rounded-md bg-orange-500/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-orange-500 ring-1 ring-inset ring-orange-500/40">
            {betaBadge}
          </span>
        )}
      </a>
    </Button>
  )
}
