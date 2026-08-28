export type IntentSlug =
  | 'mac-like-scrolling-windows'
  | 'smooth-mouse-wheel-windows'
  | 'fix-choppy-scrolling-windows-11'
  | 'smooth-scrolling-chrome-windows'
  | 'smooth-scrolling-vscode-windows'

export const INTENT_CONTENT_UPDATED = '2026-08-29'

export const intentLinks: ReadonlyArray<{
  slug: IntentSlug
  title: string
  description: string
}> = [
  {
    slug: 'mac-like-scrolling-windows',
    title: 'Mac-like scrolling on Windows',
    description: 'Tune mouse-wheel easing, duration, and direction for a more gliding Windows scroll feel.',
  },
  {
    slug: 'smooth-mouse-wheel-windows',
    title: 'Smooth mouse-wheel scrolling',
    description: 'Turn discrete wheel notches into eased movement across Windows apps.',
  },
  {
    slug: 'fix-choppy-scrolling-windows-11',
    title: 'Fix choppy scrolling on Windows 11',
    description: 'A practical path for mouse-wheel scrolling that feels jumpy in apps without consistent inertia.',
  },
  {
    slug: 'smooth-scrolling-chrome-windows',
    title: 'Smooth scrolling in Chrome',
    description: 'Use system-level smoothing while keeping Ctrl + wheel zoom responsive.',
  },
  {
    slug: 'smooth-scrolling-vscode-windows',
    title: 'Smooth scrolling in VS Code',
    description: 'Give VS Code its own profile for precise navigation without changing every other app.',
  },
]

export function intentPath(slug: IntentSlug): `/${IntentSlug}/` {
  return `/${slug}/`
}
