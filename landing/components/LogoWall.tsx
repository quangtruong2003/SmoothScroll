import { BRANDS, type Brand } from '@/lib/brands'

function LogoCell({ brand }: { brand: Brand }) {
  return (
    <li
      role="listitem"
      aria-label={brand.name}
      className="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/60 focus-within:bg-muted/60 transition-colors min-w-0"
    >
      <img
        src={brand.src}
        alt=""
        width={24}
        height={24}
        decoding="async"
        loading="lazy"
        className={'h-6 w-6 shrink-0 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ' + (brand.invertOnDark ? 'dark:invert' : '')}
      />
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground group-focus-within:text-foreground truncate">
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
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 max-w-3xl mx-auto w-full min-w-0"
      >
        {BRANDS.map((b) => (
          <LogoCell key={b.slug} brand={b} />
        ))}
      </ul>
    </div>
  )
}
