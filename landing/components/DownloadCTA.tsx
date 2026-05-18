'use client'

import { Button } from '@/components/ui/button'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { Download } from 'lucide-react'

interface DownloadCTAProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg'
  className?: string
}

export function DownloadCTA({ label, variant = 'brand', size = 'default', className }: DownloadCTAProps) {
  const { url } = useDownloadUrl()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      aria-label={label}
    >
      <Download className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}
