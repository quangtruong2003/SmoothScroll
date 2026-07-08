import { BRANDS, type Brand } from '@/lib/brands'

function LogoCell({ brand }: { brand: Brand }) {
  return (
    <li
      role="listitem"
      aria-label={brand.name}
      className="flex items-center gap-2 px-3 py-2 rounded-md opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity"
    >
      <img
        src={brand.src}
        alt=""
        width={24}
        height={24}
        decoding="async"
        loading="lazy"
        className={'h-6 w-6 shrink-0 ' + (brand.invertOnDark ? 'dark:invert' : '')}
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
      className="w-full"
    >
      <ul
        role="list"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 max-w-3xl mx-auto"
      >
        {BRANDS.map((b) => (
          <LogoCell key={b.slug} brand={b} />
        ))}
      </ul>
    </div>
  )
}
