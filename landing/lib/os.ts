export type OS = 'win' | 'mac' | 'linux' | 'other'

export function detectOS(): OS {
  if (typeof window === 'undefined') return 'other'

  // Mobile/tablet first: iPhone/iPad UA contains "Mac", Android UA contains "Linux".
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase() ?? ''
  const maxTouch = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0
  const ua = navigator.userAgent.toLowerCase()
  if (/android|iphone|ipad|ipod|mobile/.test(ua)) return 'other'
  if (/mac|darwin/.test(platform) && maxTouch > 1) return 'other'
  if (ua.includes('mac') || ua.includes('darwin')) {
    if (maxTouch > 1) return 'other'
    return 'mac'
  }
  if (ua.includes('win')) return 'win'
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
