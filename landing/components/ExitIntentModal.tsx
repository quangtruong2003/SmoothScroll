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
  }
}

export function ExitIntentModal({ dict }: ExitIntentModalProps) {
  const triggered = useExitIntent()
  const { url } = useDownloadUrl()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (triggered) setOpen(true)
  }, [triggered])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>{dict.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
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
            {dict.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
