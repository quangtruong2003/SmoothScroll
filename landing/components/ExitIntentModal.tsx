'use client'

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

  return (
    <Dialog open={triggered}>
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
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <Download className="h-4 w-4 mr-2" />
            {dict.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
