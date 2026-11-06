import type { Locale } from '@/lib/i18n/dict'

const COMMON = { width: 18, height: 12, viewBox: '0 0 18 12' } as const
const CLASSES = 'shrink-0 rounded-[1px]'

export function FlagIcon({ lang }: { lang: Locale }) {
  switch (lang) {
    case 'vi':
      return (
        <svg {...COMMON} aria-hidden="true" className={CLASSES}>
          <rect width="18" height="12" fill="#DA251D" />
          <polygon
            points="9,2.4 10.05,5.46 13.32,5.46 10.68,7.32 11.73,10.38 9,8.52 6.27,10.38 7.32,7.32 4.68,5.46 7.95,5.46"
            fill="#FFFF00"
          />
        </svg>
      )
    case 'zh':
      return (
        <svg {...COMMON} aria-hidden="true" className={CLASSES}>
          <rect width="18" height="12" fill="#DE2910" />
          <g fill="#FFDE00">
            <polygon points="3,1.6 3.55,3.05 5.1,3.05 3.85,3.95 4.4,5.4 3,4.5 1.6,5.4 2.15,3.95 0.9,3.05 2.45,3.05" />
            <polygon points="6.3,1 6.55,1.6 7.2,1.6 6.65,1.95 6.85,2.55 6.3,2.15 5.75,2.55 5.95,1.95 5.4,1.6 6.05,1.6" />
            <polygon points="7.2,2.5 7.45,3.1 8.1,3.1 7.55,3.45 7.75,4.05 7.2,3.65 6.65,4.05 6.85,3.45 6.3,3.1 6.95,3.1" />
            <polygon points="7.2,4.6 7.45,5.2 8.1,5.2 7.55,5.55 7.75,6.15 7.2,5.75 6.65,6.15 6.85,5.55 6.3,5.2 6.95,5.2" />
            <polygon points="6.3,6 6.55,6.6 7.2,6.6 6.65,6.95 6.85,7.55 6.3,7.15 5.75,7.55 5.95,6.95 5.4,6.6 6.05,6.6" />
          </g>
        </svg>
      )
    case 'en':
    default:
      return (
        <svg {...COMMON} aria-hidden="true" className={CLASSES}>
          <rect width="18" height="12" fill="#B22234" />
          <g fill="#FFFFFF">
            <rect y="0.92" width="18" height="0.92" />
            <rect y="2.77" width="18" height="0.92" />
            <rect y="4.62" width="18" height="0.92" />
            <rect y="6.46" width="18" height="0.92" />
            <rect y="8.31" width="18" height="0.92" />
            <rect y="10.15" width="18" height="0.92" />
          </g>
          <rect width="7.2" height="6.46" fill="#3C3B6E" />
        </svg>
      )
  }
}
