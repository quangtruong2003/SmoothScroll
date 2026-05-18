import type { Lang } from "@/i18n";

const COMMON = { width: 18, height: 12, viewBox: "0 0 18 12" } as const;
const CLASSES = "shrink-0 rounded-[1px]";

export function FlagIcon({ lang }: { lang: Lang }) {
  switch (lang) {
    case "vi":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="12" fill="#DA251D" />
          <polygon
            points="9,2.4 10.05,5.46 13.32,5.46 10.68,7.32 11.73,10.38 9,8.52 6.27,10.38 7.32,7.32 4.68,5.46 7.95,5.46"
            fill="#FFFF00"
          />
        </svg>
      );
    case "zh":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="12" fill="#DE2910" />
          <g fill="#FFDE00">
            <polygon points="3,1.6 3.55,3.05 5.1,3.05 3.85,3.95 4.4,5.4 3,4.5 1.6,5.4 2.15,3.95 0.9,3.05 2.45,3.05" />
            <polygon points="6.3,1 6.55,1.6 7.2,1.6 6.65,1.95 6.85,2.55 6.3,2.15 5.75,2.55 5.95,1.95 5.4,1.6 6.05,1.6" />
            <polygon points="7.2,2.5 7.45,3.1 8.1,3.1 7.55,3.45 7.75,4.05 7.2,3.65 6.65,4.05 6.85,3.45 6.3,3.1 6.95,3.1" />
            <polygon points="7.2,4.6 7.45,5.2 8.1,5.2 7.55,5.55 7.75,6.15 7.2,5.75 6.65,6.15 6.85,5.55 6.3,5.2 6.95,5.2" />
            <polygon points="6.3,6 6.55,6.6 7.2,6.6 6.65,6.95 6.85,7.55 6.3,7.15 5.75,7.55 5.95,6.95 5.4,6.6 6.05,6.6" />
          </g>
        </svg>
      );
    case "fr":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="6" height="12" x="0" fill="#0055A4" />
          <rect width="6" height="12" x="6" fill="#FFFFFF" />
          <rect width="6" height="12" x="12" fill="#EF4135" />
        </svg>
      );
    case "de":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="4" y="0" fill="#000000" />
          <rect width="18" height="4" y="4" fill="#DD0000" />
          <rect width="18" height="4" y="8" fill="#FFCE00" />
        </svg>
      );
    case "hi":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="4" y="0" fill="#FF9933" />
          <rect width="18" height="4" y="4" fill="#FFFFFF" />
          <rect width="18" height="4" y="8" fill="#138808" />
          <circle cx="9" cy="6" r="1.4" fill="none" stroke="#000088" strokeWidth="0.3" />
          <circle cx="9" cy="6" r="0.3" fill="#000088" />
        </svg>
      );
    case "id":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="6" y="0" fill="#FF0000" />
          <rect width="18" height="6" y="6" fill="#FFFFFF" />
        </svg>
      );
    case "it":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="6" height="12" x="0" fill="#009246" />
          <rect width="6" height="12" x="6" fill="#FFFFFF" />
          <rect width="6" height="12" x="12" fill="#CE2B37" />
        </svg>
      );
    case "ja":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="12" fill="#FFFFFF" />
          <circle cx="9" cy="6" r="3.6" fill="#BC002D" />
        </svg>
      );
    case "ko":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="12" fill="#FFFFFF" />
          <g transform="translate(9 6)">
            <path d="M 0,-2.4 A 2.4,2.4 0 0,1 0,2.4 A 1.2,1.2 0 0,0 0,0 A 1.2,1.2 0 0,1 0,-2.4 Z" fill="#CD2E3A" />
            <path d="M 0,-2.4 A 2.4,2.4 0 0,0 0,2.4 A 1.2,1.2 0 0,1 0,0 A 1.2,1.2 0 0,0 0,-2.4 Z" fill="#0047A0" />
          </g>
          <g fill="#000000" stroke="none">
            <rect x="2.4" y="2.4" width="2.4" height="0.4" />
            <rect x="2.4" y="3" width="2.4" height="0.4" />
            <rect x="2.4" y="3.6" width="2.4" height="0.4" />
            <rect x="13.2" y="2.4" width="2.4" height="0.4" />
            <rect x="13.2" y="3" width="2.4" height="0.4" />
            <rect x="13.2" y="3.6" width="1" height="0.4" />
            <rect x="14.6" y="3.6" width="1" height="0.4" />
            <rect x="2.4" y="8" width="1" height="0.4" />
            <rect x="3.8" y="8" width="1" height="0.4" />
            <rect x="2.4" y="8.6" width="2.4" height="0.4" />
            <rect x="2.4" y="9.2" width="1" height="0.4" />
            <rect x="3.8" y="9.2" width="1" height="0.4" />
            <rect x="13.2" y="8" width="1" height="0.4" />
            <rect x="14.6" y="8" width="1" height="0.4" />
            <rect x="13.2" y="8.6" width="1" height="0.4" />
            <rect x="14.6" y="8.6" width="1" height="0.4" />
            <rect x="13.2" y="9.2" width="1" height="0.4" />
            <rect x="14.6" y="9.2" width="1" height="0.4" />
          </g>
        </svg>
      );
    case "pt-BR":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="12" fill="#009C3B" />
          <polygon points="9,1.8 16.2,6 9,10.2 1.8,6" fill="#FFDF00" />
          <circle cx="9" cy="6" r="2.4" fill="#002776" />
          <path d="M 6.6,5.4 Q 9,4 11.4,5.4" stroke="#FFFFFF" strokeWidth="0.4" fill="none" />
        </svg>
      );
    case "es":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="3" y="0" fill="#AA151B" />
          <rect width="18" height="6" y="3" fill="#F1BF00" />
          <rect width="18" height="3" y="9" fill="#AA151B" />
        </svg>
      );
    case "tr":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="12" fill="#E30A17" />
          <circle cx="6.5" cy="6" r="2.4" fill="#FFFFFF" />
          <circle cx="7.2" cy="6" r="1.9" fill="#E30A17" />
          <polygon
            points="9.6,6 10.8,6.36 10.36,5.28 11.04,4.32 9.84,4.56 9.6,3.36 9.36,4.56 8.16,4.32 8.84,5.28 8.4,6.36"
            fill="#FFFFFF"
          />
        </svg>
      );
    case "ru":
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
          <rect width="18" height="4" y="0" fill="#FFFFFF" />
          <rect width="18" height="4" y="4" fill="#0039A6" />
          <rect width="18" height="4" y="8" fill="#D52B1E" />
        </svg>
      );
    case "en":
    default:
      return (
        <svg {...COMMON} aria-hidden className={CLASSES}>
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
      );
  }
}
