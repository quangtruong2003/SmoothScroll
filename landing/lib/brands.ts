export interface Brand {
  name: string
  slug: string
  src: string
  invertOnDark?: boolean
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const LOCAL = (name: string) => `${BASE}/assets/brand-icons/${name}.svg`

export const BRANDS: Brand[] = [
  { name: 'Windows 11',    slug: 'windows11',    src: LOCAL('windows11') },
  { name: 'macOS',         slug: 'apple',        src: LOCAL('apple'),              invertOnDark: true },
  { name: 'Chrome',        slug: 'chrome',       src: LOCAL('chrome') },
  { name: 'Edge',          slug: 'edge',          src: LOCAL('edge') },
  { name: 'Firefox',       slug: 'firefox',      src: LOCAL('firefox') },
  { name: 'VS Code',       slug: 'vscode',        src: LOCAL('vscode') },
  { name: 'Cursor',        slug: 'cursor',        src: LOCAL('cursor'),             invertOnDark: true },
  { name: 'IntelliJ IDEA', slug: 'intellijidea',  src: LOCAL('intellijidea') },
  { name: 'WebStorm',      slug: 'webstorm',      src: LOCAL('webstorm') },
  { name: 'PyCharm',       slug: 'pycharm',       src: LOCAL('pycharm') },
  { name: 'Word',          slug: 'word',           src: LOCAL('word') },
  { name: 'Excel',         slug: 'excel',          src: LOCAL('excel') },
  { name: 'Notion',        slug: 'notion',         src: LOCAL('notion'),            invertOnDark: true },
  { name: 'Slack',         slug: 'slack',          src: LOCAL('slack') },
  { name: 'Figma',         slug: 'figma',          src: LOCAL('figma') },
  { name: 'Discord',       slug: 'discord',         src: LOCAL('discord') },
]
