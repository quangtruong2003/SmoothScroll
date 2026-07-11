import { BRANDS, type Brand } from '@/lib/brands'

function LogoCell({ brand }: { brand: Brand }) {
  return (
    <li
      role="listitem"
      aria-label={brand.name}
      className="logo-cell flex items-center gap-2 px-3 py-2 min-w-0"
    >
      <img
        src={brand.src}
        alt=""
        width={24}
        height={24}
        decoding="async"
        loading="lazy"
        className={`h-6 w-6 shrink-0 ${brand.invertOnDark ? 'dark:invert' : ''}`}
      />
      <span className="text-sm font-medium text-muted-foreground truncate">
        {brand.name}
      </span>
    </li>
  )
}

export function LogoWall() {
  return (
    <div
      role="region"
      aria-label="Compatible apps and operating systems"
      className="logo-wall w-full overflow-hidden mask-fade"
    >
      <div className="marquee-track">
        <ul role="list" className="marquee-segment">
          {BRANDS.map((b) => (
            <LogoCell key={b.slug} brand={b} />
          ))}
        </ul>
        <ul role="list" aria-hidden="true" className="marquee-segment">
          {BRANDS.map((b) => (
            <LogoCell key={`${b.slug}-dup`} brand={b} />
          ))}
        </ul>
      </div>
    </div>
  )
}
