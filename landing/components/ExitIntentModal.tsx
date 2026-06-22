'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useExitIntent } from '@/hooks/useExitIntent'
import { Download } from 'lucide-react'
import { useDownloadUrl } from '@/lib/useDownloadUrl'

interface ExitIntentModalProps {
  dict: {
    title: string
    message: string
    cta: string
    ctaLinux?: string
    ctaMac?: string
  }
  betaBadge?: string
}

export function ExitIntentModal({ dict, betaBadge = 'BETA' }: ExitIntentModalProps) {
  const triggered = useExitIntent()
  const { url, isBeta, isMac, isLinux } = useDownloadUrl()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (triggered) setOpen(true)
  }, [triggered])

  const displayLabel = isBeta && dict.ctaMac ? dict.ctaMac : isLinux && dict.ctaLinux ? dict.ctaLinux : dict.cta

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>{dict.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          {isMac ? (
            <Button
              variant="brand"
              size="lg"
              className="w-full sm:w-auto"
              disabled
            >
              {displayLabel}
              <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                Coming Soon
              </span>
            </Button>
          ) : (
            <Button
              variant="brand"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                window.open(url, '_blank', 'noopener,noreferrer')
                setOpen(false)
              }}
            >
              <Download className="h-4 w-4 mr-2" />
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
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

