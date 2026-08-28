import type { Metadata } from 'next'
import { intentPath, type IntentSlug } from './intent-links'

const BASE_URL = 'https://smoothscroll.top'
const OG_IMAGE = `${BASE_URL}/assets/og-image.png`

export interface IntentFaq {
  question: string
  answer: string
}

export interface IntentSection {
  title: string
  paragraphs: string[]
}

export interface IntentPage {
  slug: IntentSlug
  primaryQuery: string
  title: string
  description: string
  eyebrow: string
  heading: string
  lead: string
  answer: string
  sections: IntentSection[]
  setup: string[]
  faq: IntentFaq[]
  related: IntentSlug[]
}

export const intentPages: readonly IntentPage[] = [
  {
    slug: 'mac-like-scrolling-windows',
    primaryQuery: 'mac like scrolling windows',
    title: 'Mac-Like Scrolling on Windows 11 | SmoothScroll',
    description: 'Get a more Mac-like mouse-wheel feel on Windows 10 and 11 with configurable easing, animation time, acceleration, reverse direction, and per-app profiles.',
    eyebrow: 'Windows scroll feel guide',
    heading: 'Get Mac-like scrolling on Windows without changing your mouse',
    lead: 'SmoothScroll turns each discrete mouse-wheel tick into a short eased motion, so Windows apps can feel less step-by-step and more continuous.',
    answer: 'For a more Mac-like scrolling feel on Windows, SmoothScroll intercepts mouse-wheel input at the Windows hook layer and re-emits it as configurable eased pulses. You can tune animation time, easing curve, acceleration, reverse direction, and per-app profiles instead of replacing your mouse or relying on one browser setting.',
    sections: [
      {
        title: 'Why mouse-wheel scrolling feels different from a Mac trackpad',
        paragraphs: [
          'A conventional mouse wheel usually produces discrete notches. Many Windows applications decide for themselves how to animate those notches, which is why the same mouse can feel smooth in one app and abrupt in another.',
          'SmoothScroll works one layer earlier. On Windows it listens for wheel input with a low-level mouse hook, applies an easing curve, then emits smaller wheel movements over the configured animation window. The result is still mouse-wheel scrolling, but the movement can glide instead of arriving as a single jump.',
        ],
      },
      {
        title: 'Tune the feel instead of chasing one magic preset',
        paragraphs: [
          'A Mac-like feel is subjective, so SmoothScroll exposes the controls that matter: step size, animation time, easing curve, acceleration window, maximum acceleration, and reverse direction. Quintic Out gives a long deceleration tail, while shorter animation times keep the response tighter.',
          'Per-app profiles matter because a long reading page and a code editor do not need the same motion. You can keep a slower, softer profile for browsers or documents and a shorter profile for VS Code without changing the global Windows mouse setting each time.',
        ],
      },
      {
        title: 'Keep zoom, games, and special apps responsive',
        paragraphs: [
          'SmoothScroll includes modifier pass-through so Ctrl + wheel can remain raw for browser, design-tool, and editor zoom. Apps can also be excluded completely, and Game mode can bypass smoothing when raw wheel input is the better choice.',
          'That makes the goal narrower than copying macOS: keep the Windows workflow, while making ordinary wheel scrolling more continuous where you want it.',
        ],
      },
    ],
    setup: [
      'Start with the default profile and confirm that ordinary vertical wheel scrolling feels smooth in the apps you use most.',
      'For a longer glide, try Quintic Out and increase animation time gradually. Reduce step size if the page travels too far per notch.',
      'Create per-app profiles for browsers, reading apps, and code editors instead of forcing one slow or fast curve everywhere.',
      'Leave Ctrl + wheel pass-through enabled when you use wheel zoom, and exclude games or specialty apps that should receive raw wheel ticks.',
    ],
    faq: [
      {
        question: 'Can Windows mouse scrolling feel like a Mac trackpad?',
        answer: 'It can feel more continuous and inertial, but a notched mouse wheel and a precision trackpad are different input devices. SmoothScroll focuses on easing discrete wheel ticks and gives you controls to tune a Mac-like glide without pretending the hardware is identical.',
      },
      {
        question: 'Which SmoothScroll easing curve is best for a Mac-like feel?',
        answer: 'Quintic Out is a useful starting point because it produces a longer deceleration tail. The best result depends on your wheel, display, and preferred animation time, so adjust the curve together with step size and duration.',
      },
      {
        question: 'Can I reverse scroll direction on Windows?',
        answer: 'Yes. SmoothScroll includes a Reverse direction setting, and profiles let you keep different behavior for different workflows if needed.',
      },
    ],
    related: ['smooth-mouse-wheel-windows', 'smooth-scrolling-chrome-windows'],
  },
  {
    slug: 'smooth-mouse-wheel-windows',
    primaryQuery: 'smooth mouse wheel windows',
    title: 'Smooth Mouse Wheel Scrolling on Windows | SmoothScroll',
    description: 'Smooth mouse-wheel scrolling across Windows 10 and 11 apps with configurable easing, acceleration, per-app profiles, exclusions, and modifier pass-through.',
    eyebrow: 'System-wide mouse wheel smoothing',
    heading: 'Smooth mouse-wheel scrolling across Windows apps',
    lead: 'One wheel can feel completely different in Chrome, File Explorer, VS Code, and desktop tools. SmoothScroll gives those wheel ticks one configurable smoothing engine.',
    answer: 'SmoothScroll adds smooth mouse-wheel scrolling on Windows by intercepting wheel ticks before they reach the foreground app and converting them into eased output. It supports configurable step size, animation time, easing, acceleration, horizontal scrolling, per-app profiles, exclusions, and raw pass-through when an app needs it.',
    sections: [
      {
        title: 'Why one mouse wheel can feel inconsistent across Windows',
        paragraphs: [
          'Windows applications do not all animate wheel input the same way. Browsers often add their own motion, while desktop utilities, editors, panels, and older apps may move in more obvious steps. Hardware vendor software can help, but it is usually tied to a device family.',
          'SmoothScroll works at the Windows input layer, so its smoothing is not tied to a specific mouse brand. If Windows recognizes the wheel, the app can process the wheel deltas and apply the configured curve before passing movement to the target application.',
        ],
      },
      {
        title: 'Control distance, duration, and acceleration separately',
        paragraphs: [
          'Step size controls how far a notch travels. Animation time controls how long that movement takes to settle. Easing changes the shape of the motion, while acceleration lets consecutive wheel ticks build momentum when you spin faster.',
          'Keeping these controls separate is useful because “faster” and “smoother” are not the same thing. You can reduce step size for precise reading while preserving a soft deceleration, or shorten animation time for a code editor without increasing distance.',
        ],
      },
      {
        title: 'Use system-wide smoothing without forcing it everywhere',
        paragraphs: [
          'Per-app profiles and exclusions let you opt out where smoothing is unwanted. Modifier pass-through keeps Ctrl + wheel or Alt + wheel raw for apps that use the wheel for zooming, scrubbing, or other commands.',
          'The tray controls and global hotkey also make A/B testing immediate: toggle SmoothScroll off, compare native scrolling, then turn it back on without uninstalling or changing Windows settings.',
        ],
      },
    ],
    setup: [
      'Install SmoothScroll and test the default profile in two or three apps that currently feel different from each other.',
      'Adjust step size first so each notch travels the right distance, then tune animation time and easing for the motion you prefer.',
      'Use per-app profiles when an editor needs a tighter response than a browser or long-form reading app.',
      'Add exclusions or modifier pass-through for workflows that depend on raw wheel events.',
    ],
    faq: [
      {
        question: 'Does SmoothScroll work with Logitech, Razer, or other mice?',
        answer: 'SmoothScroll works from Windows wheel input rather than requiring one vendor driver. The project is designed to work with mice that Windows recognizes, including gaming and productivity mice.',
      },
      {
        question: 'Does SmoothScroll change the Windows mouse driver?',
        answer: 'No. The project uses a Windows low-level mouse hook and does not install a custom mouse driver or background service for scrolling.',
      },
      {
        question: 'Can I disable smooth scrolling for one app?',
        answer: 'Yes. SmoothScroll includes per-app exclusions and per-app profile assignments, so one application can receive raw wheel input while others stay smoothed.',
      },
    ],
    related: ['mac-like-scrolling-windows', 'fix-choppy-scrolling-windows-11'],
  },
  {
    slug: 'fix-choppy-scrolling-windows-11',
    primaryQuery: 'fix choppy scrolling windows 11',
    title: 'Fix Choppy Scrolling on Windows 11 | SmoothScroll',
    description: 'If mouse-wheel scrolling feels jumpy in Windows 11, turn discrete wheel ticks into continuous motion with configurable easing and per-app profiles.',
    eyebrow: 'Windows 11 troubleshooting guide',
    heading: 'Make choppy mouse-wheel scrolling feel smoother on Windows 11',
    lead: 'If the problem is the way discrete wheel ticks are rendered by an app, SmoothScroll can replace those abrupt steps with configurable eased motion.',
    answer: 'When Windows 11 mouse-wheel scrolling feels choppy because apps render discrete wheel ticks without consistent smoothing, SmoothScroll can turn those ticks into eased output. It does not claim to fix unrelated display, driver, or performance problems; it specifically changes how wheel scrolling is delivered to applications.',
    sections: [
      {
        title: 'First identify whether the problem is wheel motion or a wider system issue',
        paragraphs: [
          'A page that moves in visible chunks with each wheel notch is different from an application that is dropping frames, a browser tab that is overloaded, or a GPU driver problem. SmoothScroll targets the first case: discrete wheel input that feels too abrupt or inconsistent between apps.',
          'A simple test is to compare the same mouse in several applications. If one app glides while another jumps line by line, the difference is often in how each application handles wheel input. A system-level smoothing layer can make that behavior more consistent.',
        ],
      },
      {
        title: 'Smooth only the input path that needs smoothing',
        paragraphs: [
          'SmoothScroll catches Windows wheel events, applies a configurable easing curve, and emits the movement over time. The default engine is designed around high-frequency output, while step size and animation time remain user-adjustable.',
          'This approach does not require changing the Windows “lines to scroll” setting for every application. You can tune the SmoothScroll profile instead, then assign another profile or exclusion to apps with different needs.',
        ],
      },
      {
        title: 'Avoid turning a scroll fix into input lag',
        paragraphs: [
          'Very long animation times can feel floaty in editors or dense interfaces. Start near the default behavior, then make one change at a time. If you overshoot content, reduce step size before adding more duration.',
          'Keep raw pass-through available for Ctrl + wheel zoom, games, elevated targets, and other contexts where immediate wheel ticks matter more than animation.',
        ],
      },
    ],
    setup: [
      'Compare native scrolling in the affected app with SmoothScroll toggled off, then enable SmoothScroll and test the default profile.',
      'If motion is smoother but travels too far, lower step size. If it still stops too abruptly, increase animation time gradually or try a softer easing curve.',
      'Create a dedicated profile for the affected app instead of slowing every application on the system.',
      'If the whole UI is stuttering rather than only wheel movement, investigate the application, display, or driver path separately; that is outside SmoothScroll’s wheel-smoothing scope.',
    ],
    faq: [
      {
        question: 'Does SmoothScroll fix every kind of Windows 11 scrolling stutter?',
        answer: 'No. SmoothScroll targets mouse-wheel input that feels abrupt because discrete wheel ticks are not being smoothed consistently. It does not fix unrelated GPU, display, browser-performance, or driver problems.',
      },
      {
        question: 'Do I need to change Windows “lines to scroll at a time”?',
        answer: 'Not necessarily. SmoothScroll has its own step-size and animation controls, so you can tune the smoothing layer without relying on one global Windows wheel-distance setting.',
      },
      {
        question: 'Can I test SmoothScroll without committing to it?',
        answer: 'Yes. Use the global toggle or tray control to switch smoothing on and off and compare the same app immediately.',
      },
    ],
    related: ['smooth-mouse-wheel-windows', 'smooth-scrolling-chrome-windows'],
  },
  {
    slug: 'smooth-scrolling-chrome-windows',
    primaryQuery: 'smooth scrolling chrome windows',
    title: 'Smooth Scrolling in Chrome on Windows | SmoothScroll',
    description: 'Smooth Chrome mouse-wheel scrolling on Windows while keeping Ctrl + wheel zoom responsive. Use system-level easing plus per-app Chrome profiles.',
    eyebrow: 'Chrome on Windows',
    heading: 'Smooth Chrome mouse-wheel scrolling without changing every app',
    lead: 'Chrome can animate scrolling on its own, but a Windows-level profile gives you one place to tune wheel distance, easing, acceleration, and modifier behavior.',
    answer: 'SmoothScroll can smooth mouse-wheel input in Chrome on Windows by processing wheel ticks before Chrome receives them. You can assign Chrome its own profile and keep Ctrl + wheel pass-through enabled so browser zoom remains immediate instead of being stretched across the smoothing animation.',
    sections: [
      {
        title: 'Browser smooth scrolling and system-level smoothing solve different problems',
        paragraphs: [
          'A browser can decide how its own pages react to wheel events. That helps inside the browser, but it does not make File Explorer, VS Code, or another desktop app use the same motion. SmoothScroll operates at the Windows input layer, so the same engine can cover Chrome and the rest of your wheel-driven workflow.',
          'The useful part is not stacking every possible animation. It is choosing one predictable profile. If Chrome already feels good natively, exclude it. If its wheel distance or deceleration feels inconsistent with the rest of your apps, give Chrome a dedicated SmoothScroll profile.',
        ],
      },
      {
        title: 'Keep Ctrl + wheel zoom raw',
        paragraphs: [
          'Chrome uses Ctrl + wheel for page zoom. Smoothing those command-style wheel ticks can make zoom feel delayed, so SmoothScroll includes Ctrl + wheel pass-through and an option to clear pending inertia when a modifier is pressed.',
          'That means ordinary page scrolling can remain eased while zoom stays immediate. The same idea applies to design tools and editors that attach commands to modifier-plus-wheel input.',
        ],
      },
      {
        title: 'Make Chrome fast enough for navigation and soft enough for reading',
        paragraphs: [
          'For long pages, a moderate step size with a softer tail can reduce the stop-start feeling between notches. For web apps with dense lists or code views, shorten animation time so the viewport settles sooner.',
          'Because the profile is per app, you do not need to compromise between Chrome and a code editor. Tune each for the way you actually use it.',
        ],
      },
    ],
    setup: [
      'Create or select a profile for Chrome and start with SmoothScroll’s default step size, animation time, and easing.',
      'Keep Advanced → Pass-through Ctrl + wheel enabled so browser zoom receives raw wheel ticks.',
      'If Chrome feels too floaty, shorten animation time before increasing scroll distance.',
      'If you prefer Chrome’s native scrolling, exclude Chrome and use SmoothScroll only in the Windows apps that need it.',
    ],
    faq: [
      {
        question: 'Does SmoothScroll replace Chrome’s own smooth-scrolling behavior?',
        answer: 'SmoothScroll works at the Windows wheel-input layer rather than changing Chrome’s code. You can use a SmoothScroll Chrome profile, or exclude Chrome if its native behavior already feels right to you.',
      },
      {
        question: 'Will SmoothScroll make Ctrl + wheel zoom lag in Chrome?',
        answer: 'It does not have to. SmoothScroll provides Ctrl + wheel pass-through so zoom can receive raw wheel ticks, and it can clear pending inertia when the modifier is pressed.',
      },
      {
        question: 'Can Chrome have different scroll settings from VS Code?',
        answer: 'Yes. Per-app profiles let Chrome use one step size, duration, and easing setup while VS Code or another application uses a different profile.',
      },
    ],
    related: ['smooth-scrolling-vscode-windows', 'mac-like-scrolling-windows'],
  },
  {
    slug: 'smooth-scrolling-vscode-windows',
    primaryQuery: 'smooth scrolling vscode windows',
    title: 'Smooth Scrolling in VS Code on Windows | SmoothScroll',
    description: 'Give VS Code a dedicated smooth-scroll profile on Windows with precise step size, short easing, acceleration controls, and Ctrl/Alt wheel pass-through.',
    eyebrow: 'VS Code on Windows',
    heading: 'Smooth VS Code scrolling while keeping code navigation precise',
    lead: 'A code editor needs a different scroll feel from a long article. SmoothScroll lets VS Code have its own Windows-level profile instead of forcing one global curve everywhere.',
    answer: 'SmoothScroll can give VS Code a dedicated mouse-wheel profile on Windows. A shorter animation time and controlled step size can keep line navigation precise, while Ctrl + wheel and Alt + wheel pass-through remain available for zoom or editor commands that should receive raw wheel ticks.',
    sections: [
      {
        title: 'Why code editors benefit from a tighter profile',
        paragraphs: [
          'Long easing tails can be pleasant for reading but frustrating when you are trying to land on a specific function, diff hunk, or terminal line. SmoothScroll profiles let VS Code use a shorter animation time and a step size chosen for precise navigation.',
          'The profile applies at the Windows application level, so you can keep a softer browser profile at the same time. Switching between Chrome and VS Code does not require moving sliders manually.',
        ],
      },
      {
        title: 'Preserve wheel shortcuts and zoom behavior',
        paragraphs: [
          'Editors and extensions may use modifier-plus-wheel input for zooming or other commands. SmoothScroll can pass Ctrl + wheel and Alt + wheel through without smoothing and can clear existing inertia as soon as a modifier is pressed.',
          'That avoids the common failure mode where a smoothing utility makes command-style wheel input feel delayed. Ordinary vertical navigation can stay eased while modifier gestures stay direct.',
        ],
      },
      {
        title: 'Tune for reviews, large files, and terminals',
        paragraphs: [
          'For code review, use a smaller step size so a notch does not skip past the lines you are comparing. For very large files, acceleration can still let repeated wheel ticks build speed when you intentionally move farther.',
          'If one embedded view or tool window does not behave well with synthetic wheel input, exclude the application or temporarily toggle SmoothScroll off. The goal is predictable navigation, not smoothing at any cost.',
        ],
      },
    ],
    setup: [
      'Create a VS Code profile with a moderate step size and shorter animation time than your browser or reading profile.',
      'Keep Ctrl + wheel pass-through enabled if you use mouse-wheel zoom. Enable Alt + wheel pass-through when your workflow or extensions bind that gesture.',
      'Use acceleration for deliberate fast navigation, but cap it if repeated notches make you overshoot code sections.',
      'A/B test with the global hotkey and keep the profile only if it makes navigation more predictable for your editor workflow.',
    ],
    faq: [
      {
        question: 'Can VS Code use different SmoothScroll settings from Chrome?',
        answer: 'Yes. SmoothScroll supports per-app profile assignments, so VS Code can use a tighter profile while Chrome uses a longer or softer easing setup.',
      },
      {
        question: 'Will Ctrl + wheel still work for zoom in VS Code?',
        answer: 'Yes when Ctrl + wheel pass-through is enabled. SmoothScroll can send those modifier wheel ticks through raw instead of stretching them across the normal scroll animation.',
      },
      {
        question: 'What settings are a good starting point for coding?',
        answer: 'Start near the default step size with a relatively short animation time, then reduce step size if you overshoot lines. Keep modifier pass-through enabled and tune acceleration only after basic navigation feels predictable.',
      },
    ],
    related: ['smooth-scrolling-chrome-windows', 'smooth-mouse-wheel-windows'],
  },
]

export const intentPageBySlug = Object.fromEntries(
  intentPages.map((page) => [page.slug, page])
) as Record<IntentSlug, IntentPage>

export function intentUrl(slug: IntentSlug): string {
  return `${BASE_URL}${intentPath(slug)}`
}

export function buildIntentMetadata(page: IntentPage): Metadata {
  const url = intentUrl(page.slug)

  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: 'SmoothScroll',
      locale: 'en_US',
      type: 'website',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: page.heading }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [OG_IMAGE],
    },
  }
}
