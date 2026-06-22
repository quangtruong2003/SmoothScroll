export type OS = 'win' | 'mac' | 'linux' | 'other'

export function detectOS(): OS {
  if (typeof window === 'undefined') return 'other'

  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'win'
  if (ua.includes('mac') || ua.includes('darwin')) return 'mac'
  if (ua.includes('linux') || ua.includes('ubuntu') || ua.includes('fedora') || ua.includes('debian')) return 'linux'
  return 'other'
}

export function getOSLabel(os: OS): string {
  switch (os) {
    case 'win':
      return 'Windows'
    case 'mac':
      return 'macOS'
    case 'linux':
      return 'Linux'
    default:
      return 'your OS'
  }
}
