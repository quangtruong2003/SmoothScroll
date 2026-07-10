'use client'

import { Button } from '@/components/ui/button'
import { DownloadCTA } from '@/components/DownloadCTA'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import type { Dictionary } from '@/lib/i18n/dict'

interface InstallProps {
  dict: { install?: Dictionary['install'] }
}

interface InstallStepsProps {
  steps: readonly string[]
  note: string
  codePath?: string
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

function InstallSteps({ steps, note, codePath }: InstallStepsProps) {
  return (
    <div className="space-y-6">
      <ol className="space-y-4">
        {steps.map((step, idx) => (
          <li key={idx} className="flex gap-4">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="pt-1 text-foreground">{step}</span>
          </li>
        ))}
      </ol>
      {codePath && (
        <div className="rounded-md bg-muted p-4 flex items-center justify-between gap-2 min-w-0">
          <code className="text-sm font-mono text-muted-foreground break-all min-w-0">{codePath}</code>
          <CopyButton text={codePath} />
        </div>
      )}
      {note && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <span className="text-yellow-500">&#9888;</span>
          {note}
        </p>
      )}
    </div>
  )
}

export function Install({ dict }: InstallProps) {
  const i = dict?.install ?? {
    title: '',
    subtitle: '',
    tabs: { windows: { label: '', steps: [] }, macos: { label: '', steps: [] }, linux: { label: '', steps: [] } },
    filename: '',
    note: { windows: '', macos: '', linux: '' },
    cta: 'Download for Windows',
    ctaLinux: '',
    ctaMac: '',
  }

  const { os } = useDownloadUrl()

  const block = (() => {
    if (os === 'mac') {
      return <InstallSteps steps={i.tabs?.macos?.steps ?? []} note={i.note?.macos ?? ''} />
    }
    if (os === 'linux') {
      return (
        <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Linux support is coming soon.
        </div>
      )
    }
    if (os === 'other') {
      return (
        <div className="rounded-md border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          SmoothScroll currently supports Windows. macOS and Linux support is coming soon.
        </div>
      )
    }
    return (
      <InstallSteps
        steps={i.tabs?.windows?.steps ?? []}
        note={i.note?.windows ?? ''}
        codePath={`%LOCALAPPDATA%\\SmoothScroll\\${i.filename ?? ''}`}
      />
    )
  })()

  return (
    <section id="install" className="py-20 px-4 scroll-mt-20">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{i.title}</h2>
          <p className="text-muted-foreground text-lg">{i.subtitle}</p>
        </div>

        <div className="max-w-2xl mx-auto">{block}</div>

        <div className="text-center mt-8 space-y-4">
          <DownloadCTA
            label={i.cta ?? 'Download for Windows'}
            labelLinux={i.ctaLinux}
            labelMac={i.ctaMac}
            variant="brand"
            size="xl"
            className="w-full max-w-md"
          />
        </div>
      </div>
    </section>
  )
}

