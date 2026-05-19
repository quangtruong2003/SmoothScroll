export interface Brand {
  name: string
  slug: string
  srcLight: string
  srcDark: string
}

const ICONIFY = (id: string) => `https://api.iconify.design/${id}.svg`

export const BRANDS: Brand[] = [
  { name: 'Windows 11',    slug: 'windows11',        srcLight: ICONIFY('logos:microsoft-windows'),       srcDark: ICONIFY('logos:microsoft-windows') },
  { name: 'macOS',         slug: 'apple',            srcLight: ICONIFY('logos:apple'),                   srcDark: ICONIFY('logos:apple-dark') },
  { name: 'Chrome',        slug: 'chrome',           srcLight: ICONIFY('logos:chrome'),                  srcDark: ICONIFY('logos:chrome') },
  { name: 'Edge',          slug: 'edge',             srcLight: ICONIFY('logos:microsoft-edge'),          srcDark: ICONIFY('logos:microsoft-edge') },
  { name: 'Firefox',       slug: 'firefox',          srcLight: ICONIFY('logos:firefox'),                 srcDark: ICONIFY('logos:firefox') },
  { name: 'VS Code',       slug: 'vscode',           srcLight: ICONIFY('logos:visual-studio-code'),      srcDark: ICONIFY('logos:visual-studio-code') },
  { name: 'Cursor',        slug: 'cursor',           srcLight: ICONIFY('logos:cursor'),                  srcDark: ICONIFY('logos:cursor') },
  { name: 'IntelliJ IDEA', slug: 'intellijidea',     srcLight: ICONIFY('logos:intellij-idea'),           srcDark: ICONIFY('logos:intellij-idea') },
  { name: 'WebStorm',      slug: 'webstorm',         srcLight: ICONIFY('logos:webstorm'),                srcDark: ICONIFY('logos:webstorm') },
  { name: 'PyCharm',       slug: 'pycharm',          srcLight: ICONIFY('logos:pycharm'),                 srcDark: ICONIFY('logos:pycharm') },
  { name: 'Word',          slug: 'word',             srcLight: ICONIFY('logos:microsoft-word'),          srcDark: ICONIFY('logos:microsoft-word') },
  { name: 'Excel',         slug: 'excel',            srcLight: ICONIFY('logos:microsoft-excel'),         srcDark: ICONIFY('logos:microsoft-excel') },
  { name: 'Notion',        slug: 'notion',           srcLight: ICONIFY('logos:notion-icon'),             srcDark: ICONIFY('logos:notion-icon') },
  { name: 'Slack',         slug: 'slack',            srcLight: ICONIFY('logos:slack-icon'),              srcDark: ICONIFY('logos:slack-icon') },
  { name: 'Figma',         slug: 'figma',            srcLight: ICONIFY('logos:figma'),                   srcDark: ICONIFY('logos:figma') },
  { name: 'Discord',       slug: 'discord',          srcLight: ICONIFY('logos:discord-icon'),            srcDark: ICONIFY('logos:discord-icon') },
]
