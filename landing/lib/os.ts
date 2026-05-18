export type OS = 'win' | 'mac' | 'other'

export function detectOS(): OS {
  if (typeof window === 'undefined') return 'other'

  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'win'
  if (ua.includes('mac') || ua.includes('darwin')) return 'mac'
  return 'other'
}

export function getOSLabel(os: OS): string {
  switch (os) {
    case 'win':
      return 'Windows'
    case 'mac':
      return 'macOS'
    default:
      return 'your OS'
  }
}
