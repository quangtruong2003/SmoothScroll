export interface Brand {
  name: string
  slug: string
  hexLight: string
  hexDark: string
  customPath?: string
}

export const BRANDS: Brand[] = [
  {
    name: 'Windows 11',
    slug: 'windows11',
    hexLight: '#0078D4',
    hexDark: '#0078D4',
    customPath: 'M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z',
  },
  { name: 'macOS', slug: 'apple', hexLight: '#1D1D1F', hexDark: '#F5F5F7' },
  { name: 'Chrome', slug: 'googlechrome', hexLight: '#4285F4', hexDark: '#4285F4' },
  {
    name: 'Edge',
    slug: 'microsoftedge',
    hexLight: '#0078D4',
    hexDark: '#0078D4',
    customPath:
      'M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10c0-1.93-.55-3.74-1.5-5.27l-1.43 1.43C19.66 9.21 20 10.57 20 12c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8c1.43 0 2.79.34 3.84.93l1.43-1.43C15.74 2.55 13.93 2 12 2z',
  },
  { name: 'Firefox', slug: 'firefoxbrowser', hexLight: '#FF7139', hexDark: '#FF7139' },
  {
    name: 'VS Code',
    slug: 'visualstudiocode',
    hexLight: '#007ACC',
    hexDark: '#007ACC',
    customPath:
      'M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z',
  },
  { name: 'Cursor', slug: 'cursor', hexLight: '#1D1D1F', hexDark: '#F5F5F7' },
  { name: 'IntelliJ IDEA', slug: 'intellijidea', hexLight: '#000000', hexDark: '#FE2857' },
  { name: 'WebStorm', slug: 'webstorm', hexLight: '#000000', hexDark: '#07C3F2' },
  { name: 'PyCharm', slug: 'pycharm', hexLight: '#21D789', hexDark: '#21D789' },
  {
    name: 'Word',
    slug: 'microsoftword',
    hexLight: '#2B579A',
    hexDark: '#41A5EE',
    customPath:
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 5L9 16h1.5l1.5-5 1.5 5H15l1.5-8H15l-.9 5.4L12.6 8h-1.2l-1.5 5.4L9 8H7.5z',
  },
  {
    name: 'Excel',
    slug: 'microsoftexcel',
    hexLight: '#217346',
    hexDark: '#33C481',
    customPath:
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.7 5 2.6 4-2.7 4h2.05L11.3 13l1.65 3h2.05l-2.7-4 2.6-4h-2L11.3 11 9.7 8H7.7z',
  },
  { name: 'Notion', slug: 'notion', hexLight: '#1D1D1F', hexDark: '#FFFFFF' },
  {
    name: 'Slack',
    slug: 'slack',
    hexLight: '#4A154B',
    hexDark: '#ECB22E',
    customPath:
      'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523z',
  },
  { name: 'Figma', slug: 'figma', hexLight: '#F24E1E', hexDark: '#F24E1E' },
  { name: 'Discord', slug: 'discord', hexLight: '#5865F2', hexDark: '#5865F2' },
]
