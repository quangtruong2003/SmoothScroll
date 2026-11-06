'use client'

import { Button } from '@/components/ui/button'
import { recordDownloadIntent } from '@/lib/downloadAttribution'
import { formatDownloadCount } from '@/lib/github'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { useGitHubDownloads } from '@/lib/useGitHubDownloads'
import { Download } from 'lucide-react'

interface DownloadCTAProps {
  label: string
  variant?: 'brand' | 'default' | 'outline'
  size?: 'default' | 'lg' | 'xl'
  className?: string
}

export function DownloadCTA({
  label,
  variant = 'brand',
  size = 'xl',
  className,
}: DownloadCTAProps) {
  const { url, filename } = useDownloadUrl()
  const downloads = useGitHubDownloads()
  const downloadCount = !downloads.loading && downloads.value !== null ? formatDownloadCount(downloads.value) : null

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
        onClick={() => recordDownloadIntent(url)}
      >
        <Download className="h-5 w-5 mr-2" />
        {label}
        {downloadCount && (
          <span data-testid="download-cta-count" className="ml-2 inline-flex items-center rounded-md bg-primary-foreground/15 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider">
            {downloadCount}
          </span>
        )}
      </a>
    </Button>
  )
}
