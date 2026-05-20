'use client'

import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { Download } from 'lucide-react'

interface DownloadCTAProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
}

export function DownloadCTA({ label, variant = 'brand', size = 'xl', className }: DownloadCTAProps) {
  const { url, filename } = useDownloadUrl()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      asChild
      aria-label={label}
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
        {label}
      </a>
    </Button>
  )
}
