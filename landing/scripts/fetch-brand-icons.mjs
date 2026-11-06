#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'brand-icons')

const ICONS = [
  { slug: 'microsoft-windows', name: 'windows11' },
  { slug: 'apple', name: 'apple' },
  { slug: 'chrome', name: 'chrome' },
  { slug: 'microsoft-edge', name: 'edge' },
  { slug: 'firefox', name: 'firefox' },
  { slug: 'visual-studio-code', name: 'vscode' },
  { slug: 'cursor', name: 'cursor' },
  { slug: 'intellij-idea', name: 'intellijidea' },
  { slug: 'webstorm', name: 'webstorm' },
  { slug: 'pycharm', name: 'pycharm' },
  { slug: 'file-type-word', name: 'word' },
  { slug: 'file-type-excel', name: 'excel' },
  { slug: 'notion-icon', name: 'notion' },
  { slug: 'slack-icon', name: 'slack' },
  { slug: 'figma', name: 'figma' },
  { slug: 'discord-icon', name: 'discord' },
]

const COLLECTIONS = {
  'microsoft-windows': 'logos',
  apple: 'logos',
  chrome: 'logos',
  'microsoft-edge': 'logos',
  firefox: 'logos',
  'visual-studio-code': 'logos',
  cursor: 'simple-icons',
  'intellij-idea': 'logos',
  webstorm: 'logos',
  pycharm: 'logos',
  'file-type-word': 'vscode-icons',
  'file-type-excel': 'vscode-icons',
  'notion-icon': 'logos',
  'slack-icon': 'logos',
  figma: 'logos',
  'discord-icon': 'logos',
}

async function fetchIcon(collection, slug, outName) {
  const url = `https://api.iconify.design/${collection}/${slug}.svg?download=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`)
  const svg = await res.text()
  const outPath = join(OUT_DIR, `${outName}.svg`)
  await writeFile(outPath, svg, 'utf8')
  console.log(`  ${outName}.svg`)
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true })
  }
  console.log(`Fetching ${ICONS.length} brand icons to ${OUT_DIR}`)
  for (const { slug, name } of ICONS) {
    const collection = COLLECTIONS[slug]
    await fetchIcon(collection, slug, name)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
