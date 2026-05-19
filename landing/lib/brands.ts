export interface Brand {
  name: string
  slug: string
  src: string
  invertOnDark?: boolean
}

const ICONIFY = (id: string) => `https://api.iconify.design/${id}.svg`

export const BRANDS: Brand[] = [
  { name: 'Windows 11',    slug: 'windows11',    src: ICONIFY('logos:microsoft-windows') },
  { name: 'macOS',         slug: 'apple',        src: ICONIFY('logos:apple'),              invertOnDark: true },
  { name: 'Chrome',        slug: 'chrome',       src: ICONIFY('logos:chrome') },
  { name: 'Edge',          slug: 'edge',         src: ICONIFY('logos:microsoft-edge') },
  { name: 'Firefox',       slug: 'firefox',      src: ICONIFY('logos:firefox') },
  { name: 'VS Code',       slug: 'vscode',       src: ICONIFY('logos:visual-studio-code') },
  { name: 'Cursor',        slug: 'cursor',       src: ICONIFY('logos:cursor'),             invertOnDark: true },
  { name: 'IntelliJ IDEA', slug: 'intellijidea', src: ICONIFY('logos:intellij-idea') },
  { name: 'WebStorm',      slug: 'webstorm',     src: ICONIFY('logos:webstorm') },
  { name: 'PyCharm',       slug: 'pycharm',      src: ICONIFY('logos:pycharm') },
  { name: 'Word',          slug: 'word',         src: ICONIFY('logos:microsoft-word') },
  { name: 'Excel',         slug: 'excel',        src: ICONIFY('logos:microsoft-excel') },
  { name: 'Notion',        slug: 'notion',       src: ICONIFY('logos:notion-icon'),        invertOnDark: true },
  { name: 'Slack',         slug: 'slack',        src: ICONIFY('logos:slack-icon') },
  { name: 'Figma',         slug: 'figma',        src: ICONIFY('logos:figma') },
  { name: 'Discord',       slug: 'discord',      src: ICONIFY('logos:discord-icon') },
]
