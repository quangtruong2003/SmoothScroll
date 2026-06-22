'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DownloadCTA } from '@/components/DownloadCTA'
import { BetaNotice } from '@/components/BetaNotice'
import { Copy, Check, Download } from 'lucide-react'
import { useState } from 'react'
import { useDownloadUrl } from '@/lib/useDownloadUrl'
import type { Dictionary } from '@/lib/i18n/dict'

interface InstallProps {
  dict: { install?: Dictionary['install']; beta?: Dictionary['beta'] }
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
    <Button variant="ghost" size="icon" onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy'}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

export function Install({ dict }: InstallProps) {
  const i = dict?.install ?? {
    title: '',
    subtitle: '',
    tabs: { windows: { label: '', steps: [] }, macos: { label: '', steps: [] }, linux: { label: '', steps: [] } },
    filename: '',
    note: { windows: '', macos: '', linux: '' },
    cta: '',
    ctaMac: '',
    ctaLinux: '',
  }
  const b = dict?.beta ?? { badge: 'BETA', notice: '', reportPrefix: '', reportLink: '' }
  const { os, ctaLabel, isMac, isLinux } = useDownloadUrl()

  const defaultTab = os === 'mac' ? 'macos' : os === 'linux' ? 'linux' : 'windows'

  return (
    <section id="install" className="py-20 px-4 scroll-mt-20">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{i.title}</h2>
          <p className="text-muted-foreground text-lg">{i.subtitle}</p>
        </div>

        <Tabs defaultValue={defaultTab} className="max-w-2xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="windows">{i.tabs?.windows?.label ?? ''}</TabsTrigger>
            <TabsTrigger value="linux">{i.tabs?.linux?.label ?? ''}</TabsTrigger>
            <TabsTrigger value="macos">{i.tabs?.macos?.label ?? ''}</TabsTrigger>
          </TabsList>

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
          {isMac ? (
            <Button
              variant="brand"
              size="xl"
              disabled
              className="w-full max-w-md"
            >
              <Download className="h-5 w-5 mr-2" />
              {i.ctaMac || ctaLabel}
              <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                Coming Soon
              </span>
            </Button>
          ) : (
            <DownloadCTA
              label={isLinux ? (i.ctaLinux || ctaLabel) : ctaLabel}
              labelMac={i.ctaMac}
              betaBadge={b.badge ?? 'BETA'}
              variant="brand"
              size="xl"
            />
          )}
          <BetaNotice
            notice={isMac ? '' : (b.notice ?? '')}
            reportPrefix={b.reportPrefix ?? ''}
            reportLink={b.reportLink ?? ''}
          />
        </div>
      </div>
    </section>
  )
}

