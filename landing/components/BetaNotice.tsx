'use client'

import { useDownloadUrl } from '@/lib/useDownloadUrl'
import { AlertTriangle } from 'lucide-react'

interface BetaNoticeProps {
  notice: string
  reportPrefix: string
  reportLink: string
  className?: string
  align?: 'center' | 'left'
}

export function BetaNotice({
  notice,
  reportPrefix,
  reportLink,
  className = '',
  align = 'center',
}: BetaNoticeProps) {
  const { isBeta, isLinux } = useDownloadUrl()
  if (!isBeta && !isLinux) return null

  const justify = align === 'center' ? 'justify-center' : 'justify-start'

  return (
    <div
      role="status"
      className={`flex ${justify} ${className}`}
    >
      <div className="inline-flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>
          {notice}{' '}
          <a
            href="https://github.com/quangtruong2003/SmoothScroll/issues/new?labels=bug&template=bug_report.md"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-200"
          >
            {reportPrefix} {reportLink}
          </a>
        </span>
      </div>
    </div>
  )
}
