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
  const { url } = useDownloadUrl()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      aria-label={label}
    >
      <Download className="h-5 w-5 mr-2" />
      {label}
    </Button>
  )
}
