'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DownloadButtonWin } from '@/components/DownloadButtonWin'
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
    tabs: { windows: { label: '', steps: [] }, macos: { label: '', steps: [] }, linux: { label: '', steps: [] } },
    filename: '',
    note: { windows: '', macos: '', linux: '' },
    cta: 'Download for Windows',
    ctaLinux: '',
    ctaMac: '',
  }

  return (
    <section id="install" className="py-20 px-4 scroll-mt-20">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{i.title}</h2>
          <p className="text-muted-foreground text-lg">{i.subtitle}</p>
        </div>

        <Tabs defaultValue="windows" className="max-w-2xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="windows">{i.tabs?.windows?.label ?? 'Windows'}</TabsTrigger>
            <TabsTrigger
              value="linux"
              disabled
              descriptionId="linux-coming-soon-desc"
            >
              {i.tabs?.linux?.label ?? 'Linux'}
            </TabsTrigger>
            <TabsTrigger
              value="macos"
              disabled
              descriptionId="mac-coming-soon-desc"
            >
              {i.tabs?.macos?.label ?? 'macOS'}
            </TabsTrigger>
          </TabsList>
          <span id="linux-coming-soon-desc" className="sr-only">
            Linux support is coming soon
          </span>
          <span id="mac-coming-soon-desc" className="sr-only">
            macOS support is coming soon
          </span>

          <TabsContent value="windows" className="space-y-6">
            <ol className="space-y-4">
              {(i.tabs?.windows?.steps ?? []).map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="pt-1 text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-md bg-muted p-4 flex items-center justify-between gap-2">
              <code className="text-sm font-mono text-muted-foreground overflow-x-auto">
                %LOCALAPPDATA%\SmoothScroll\{i.filename ?? ''}
              </code>
              <CopyButton text={`%LOCALAPPDATA%\\SmoothScroll\\${i.filename ?? ''}`} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="text-yellow-500">&#9888;</span>
              {i.note?.windows ?? ''}
            </p>
          </TabsContent>

          <TabsContent value="linux" className="space-y-6">
            <ol className="space-y-4">
              {(i.tabs?.linux?.steps ?? []).map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="pt-1 text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="text-yellow-500">&#9888;</span>
              {i.note?.linux ?? ''}
            </p>
          </TabsContent>

          <TabsContent value="macos" className="space-y-6">
            <ol className="space-y-4">
              {(i.tabs?.macos?.steps ?? []).map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="pt-1 text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="text-yellow-500">&#9888;</span>
              {i.note?.macos ?? ''}
            </p>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-8 space-y-4">
          <DownloadButtonWin label={i.cta ?? 'Download for Windows'} variant="brand" size="xl" className="w-full max-w-md" />
        </div>
      </div>
    </section>
  )
}

