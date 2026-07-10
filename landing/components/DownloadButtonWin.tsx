'use client'

import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { Download } from 'lucide-react'

interface DownloadButtonWinProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
  disabled?: boolean
  comingSoonLabel?: string
}

export function DownloadButtonWin({
  label,
  variant = 'brand',
  size = 'xl',
  className,
  disabled = false,
  comingSoonLabel,
}: DownloadButtonWinProps) {
  const { url, filename } = useDownloadUrl()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      asChild={!disabled}
      disabled={disabled}
      aria-label={label}
    >
      {disabled ? (
        <span className="flex items-center gap-2 cursor-not-allowed whitespace-nowrap">
          <Download className="h-5 w-5 shrink-0" />
          <span>{label}</span>
          {comingSoonLabel && (
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
              {comingSoonLabel}
            </span>
          )}
        </span>
      ) : (
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
          {label}
        </a>
      )}
    </Button>
  )
}
