'use client'

import { Button } from '@/components/ui/button'
import { DownloadCTA } from '@/components/DownloadCTA'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dict'

interface InstallProps {
  dict: { install?: Dictionary['install'] }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}

export function Install({ dict }: InstallProps) {
  const i = dict?.install ?? {
    title: '',
    subtitle: '',
    tabs: { windows: { label: '', steps: [] } },
    filename: '',
    note: { windows: '' },
    cta: 'Download for Windows',
  }

  return (
    <section id="install" className="scroll-mt-20 px-4 py-[clamp(5rem,8vw,7.5rem)]">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{i.title}</h2>
          <p className="text-muted-foreground text-lg">{i.subtitle}</p>
        </div>

        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-muted/20 p-5 sm:p-8">
          <div className="space-y-6">
            <ol className="space-y-4">
              {(i.tabs?.windows?.steps ?? []).map((step, idx) => (
                <li key={idx} className="flex items-start gap-3.5 sm:gap-4">
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold tabular-nums text-primary-foreground">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            {(i.note?.windows) && (
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-yellow-500 shrink-0" aria-hidden="true">&#9888;</span>
                <span>{i.note.windows}</span>
              </p>
            )}
            <div className="rounded-md bg-muted px-3.5 py-3 sm:p-4 flex items-center justify-between gap-2 min-w-0">
              <code className="text-xs sm:text-sm font-mono text-muted-foreground break-all min-w-0">{`%LOCALAPPDATA%\\SmoothScroll\\${i.filename ?? ''}`}</code>
              <div className="shrink-0">
                <CopyButton text={`%LOCALAPPDATA%\\SmoothScroll\\${i.filename ?? ''}`} />
              </div>
            </div>
          </div>
          <div className="mt-6">
            <DownloadCTA
              label={i.cta ?? 'Download for Windows'}
              variant="brand"
              size="xl"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
