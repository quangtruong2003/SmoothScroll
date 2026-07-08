'use client'

import { useEffect, useState } from 'react'
import { DotsHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'noDotGrid'

export function DotGridToggle() {
  const [enabled, setEnabled] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial = stored !== 'true' // default enabled
    setEnabled(initial)
    document.documentElement.dataset.noDotGrid = stored === 'true' ? 'true' : 'false'
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    document.documentElement.dataset.noDotGrid = next ? 'true' : 'false'
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={enabled ? 'Disable background dot pattern' : 'Enable background dot pattern'}
      aria-pressed={!enabled}
      suppressHydrationWarning
    >
      {mounted && (
        <DotsHorizontal className={`h-4 w-4 ${enabled ? '' : 'opacity-40'}`} />
      )}
    </Button>
  )
}
