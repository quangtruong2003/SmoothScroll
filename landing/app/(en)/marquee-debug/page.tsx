import { BRANDS } from '@/lib/brands'

export default function MarqueeDebug() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-2xl font-bold mb-4">Marquee Debug Page</h1>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Animation state (live):</h2>
        <pre
          id="debug-output"
          className="text-xs bg-muted p-4 rounded font-mono whitespace-pre-wrap"
        >
          waiting for data...
        </pre>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">LogoWall (live):</h2>
      </div>

      <div className="logo-wall w-full overflow-hidden mask-fade border-2 border-amber-500">
        <div className="marquee-track" id="marquee-track">
          <ul role="list" className="marquee-segment">
            {BRANDS.map((b) => (
              <li
                key={b.slug}
                role="listitem"
                aria-label={b.name}
                className="logo-cell flex items-center gap-2 px-3 py-2 min-w-0 border border-emerald-500"
              >
                <img
                  src={b.src}
                  alt=""
                  width={24}
                  height={24}
                  decoding="async"
                  loading="lazy"
                  className={`h-6 w-6 shrink-0 ${b.invertOnDark ? 'dark:invert' : ''}`}
                />
                <span className="text-sm font-medium text-muted-foreground truncate">
                  {b.name}
                </span>
              </li>
            ))}
          </ul>
          <ul role="list" aria-hidden="true" className="marquee-segment">
            {BRANDS.map((b) => (
              <li
                key={`${b.slug}-dup`}
                role="listitem"
                aria-label={b.name}
                className="logo-cell flex items-center gap-2 px-3 py-2 min-w-0 border border-emerald-500"
              >
                <img
                  src={b.src}
                  alt=""
                  width={24}
                  height={24}
                  decoding="async"
                  loading="lazy"
                  className={`h-6 w-6 shrink-0 ${b.invertOnDark ? 'dark:invert' : ''}`}
                />
                <span className="text-sm font-medium text-muted-foreground truncate">
                  {b.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        <p>The amber border shows the .logo-wall (overflow-hidden region).</p>
        <p>Green borders show individual .logo-cell elements.</p>
        <p>If you see cells scrolling smoothly right-to-left, animation is working.</p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const out = document.getElementById('debug-output');
              const track = document.getElementById('marquee-track');
              if (!out || !track) return;
              const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              function update() {
                const cs = getComputedStyle(track);
                const rect = track.getBoundingClientRect();
                out.textContent = [
                  'prefers-reduced-motion: ' + (reducedMotion ? 'REDUCE (animation halted)' : 'no-preference'),
                  'animation-name: ' + cs.animationName,
                  'animation-duration: ' + cs.animationDuration,
                  'animation-play-state: ' + cs.animationPlayState,
                  'current transform: ' + cs.transform,
                  'track width: ' + Math.round(rect.width) + 'px',
                  'viewport width: ' + window.innerWidth + 'px',
                  'updated: ' + new Date().toLocaleTimeString(),
                ].join('\\n');
              }
              update();
              setInterval(update, 200);
            })();
          `,
        }}
      />
    </main>
  )
}