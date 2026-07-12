# SmoothScroll Social Media Posts

> Domain mới: https://smoothscroll.top
> GitHub: https://github.com/quangtruong2003/SmoothScroll

---

## 🐦 X (Twitter)

### Post 1 — Launch Thread (6 tweets)

**Tweet 1 (hook):**
Mouse wheel scrolling on Windows is broken.

Every app does it differently. Chrome is smooth, VS Code is janky, File Explorer is from 2005.

I built a 120 Hz easing engine that fixes it — system-wide. Free, open-source, zero telemetry.

smoothscroll.top 🧵👇

**Tweet 2 (problem):**
The problem: Windows has no system-wide smooth scroll.

- Chrome rolls its own
- Edge rolls its own
- Explorer doesn't bother
- UWP apps ignore synthetic wheel events entirely

You're stuck with whatever each dev shipped.

**Tweet 3 (solution):**
SmoothScroll sits between the OS and your apps.

Every wheel tick gets caught at the hook layer, eased into a smooth pulse, and re-emitted at 120 Hz.

One engine. Every window. You pick the curve.

**Tweet 4 (features):**
What makes it different:

→ Per-app profiles (Chrome snappy, VS Code silky, Photoshop raw)
→ Game mode auto-bypass (anti-cheat never sees it)
→ UWP force-enable (WinUI apps actually scroll now)
→ Per-monitor profiles for multi-screen setups
→ Rust binary — tiny, no Electron, no bloat

**Tweet 5 (trust):**
The boring but important stuff:

✓ Zero telemetry — no network calls, no analytics
✓ No service, no daemon, no driver
✓ Source-available (FSL-1.1 → Apache 2.0)
✓ No ads, no premium tier, no upsell
✓ Just delete the executable to uninstall

**Tweet 6 (CTA):**
Try it — you'll feel the difference in 5 seconds.

Windows: smoothscroll.top
Linux: smoothscroll.top (AppImage)
macOS: coming soon

Star it on GitHub if you want to see more:
github.com/quangtruong2003/SmoothScroll

---

### Post 2 — Standalone (short, punchy)

Windows still doesn't have system-wide smooth scrolling in 2026.

So I built one. 120 Hz easing engine, per-app profiles, game mode bypass, zero telemetry.

Free & open-source → smoothscroll.top

---

### Post 3 — Developer angle

If you use VS Code + a regular mouse on Windows, your scroll is probably janky.

SmoothScroll adds 120 Hz easing at the OS level — no extensions, no config per-app.

Per-app profiles: set VS Code to "silky" and Chrome to "snappy". Done.

smoothscroll.top (free, open-source)

---

### Post 4 — Pain point angle

Things that are stuck in 2014:

- WizMouse (last updated: 2014)
- Windows built-in smooth scroll (app-specific, inconsistent)
- Logi Options+ (breaks when you switch mice)

I built SmoothScroll to fix this. Rust binary, 120 Hz, per-app profiles, zero telemetry.

smoothscroll.top

---

### Post 5 — Privacy angle

Most input utilities on Windows:
- Phone home with telemetry
- Install drivers or services
- Flagged by anti-cheat

SmoothScroll:
- Zero network calls
- Standalone .exe — no services
- Auto-bypasses games so anti-cheat never sees it
- Source-available — audit it yourself

smoothscroll.top

---

### Post 6 — macOS switcher angle

Moved from Mac to Windows and miss trackpad inertia?

SmoothScroll brings Mac-style smooth scrolling to every app on Windows.

120 Hz easing. Per-app profiles. One toggle.

smoothscroll.top

---

### Post 7 — Linux announcement

SmoothScroll for Linux is out.

AppImage — works on Ubuntu, Debian, Fedora, and most distros.

chmod +x → run → done. No root, no install.

smoothscroll.top

---

### Post 8 — "How it works" teaser

Every wheel tick in SmoothScroll:

1. Intercept — low-level hook catches raw event
2. Smooth — eased curve interpolates the delta
3. Emit — synthetic events fire at 120 Hz

3 steps. 120 times a second. Every app.

smoothscroll.top/how-it-works

---

## 📱 Reddit

### r/software

**Title:** SmoothScroll — 120 Hz system-wide smooth scrolling for Windows (free, open-source)

**Body:**
Windows has no system-wide smooth scrolling. Every app rolls its own — Chrome is smooth, VS Code is janky, File Explorer doesn't bother.

SmoothScroll fixes this at the OS level. A 120 Hz easing engine catches every wheel tick and re-emits it as a smooth pulse.

**Features:**
- Per-app profiles (different curves for different apps)
- Per-monitor profiles (4K at home vs 1080p at office)
- Game mode auto-bypass (anti-cheat never sees it)
- UWP/WinUI force-enable
- Zero telemetry, no network calls
- Standalone .exe — no service, no driver, no admin required
- Open-source (FSL-1.1 → Apache 2.0)

**Links:**
- Website: https://smoothscroll.top
- GitHub: https://github.com/quangtruong2003/SmoothScroll

---

### r/windows

**Title:** I built a system-wide smooth scrolling engine for Windows — free & open-source

**Body:**
Windows still doesn't have system-wide smooth scrolling in 2026. Each app implements it differently (or not at all).

SmoothScroll is a lightweight Rust binary that intercepts mouse wheel events at the OS hook level and re-emits them as 120 Hz eased pulses.

No services, no drivers, no admin required. Just run the .exe.

Key features:
- Per-app profiles
- Game mode auto-bypass
- UWP force-enable
- Zero telemetry

Download: https://smoothscroll.top
Source: https://github.com/quangtruong2003/SmoothScroll

---

### r/opensource

**Title:** SmoothScroll — 120 Hz smooth scrolling engine for Windows/Linux (FSL-1.1 → Apache 2.0)

**Body:**
A system-wide smooth scrolling engine built with Rust + Tauri. Catches raw wheel events at the OS level and re-emits them as eased 120 Hz pulses.

License: FSL-1.1 (auto-converts to Apache 2.0 after 2 years)
Zero telemetry. No services. Standalone binary.

GitHub: https://github.com/quangtruong2003/SmoothScroll
Website: https://smoothscroll.top

---

### r/Windows11

**Title:** This tool gives Windows 11 the smooth scrolling macOS users are used to

**Body:**
SmoothScroll adds system-wide smooth scrolling to Windows 11. It intercepts wheel events before they reach any app and re-emits them as smooth 120 Hz pulses.

Per-app profiles, game mode bypass, zero telemetry. Free and open-source.

https://smoothscroll.top

---

### r/vscode

**Title:** If your mouse scroll feels janky in VS Code, this might help

**Body:**
SmoothScroll is a system-wide tool that adds 120 Hz easing to every scroll wheel tick. It works at the OS level, so VS Code gets smooth scrolling without any extensions.

You can set per-app profiles — I use "silky" for VS Code and "snappy" for Chrome.

Free, open-source, zero telemetry: https://smoothscroll.top

---

## 🟠 Hacker News

**Title:** SmoothScroll – 120 Hz system-wide smooth scrolling for Windows (Rust/Tauri)

**Comment (first post):**
Hey HN — I built this because Windows still has no system-wide smooth scrolling in 2026.

SmoothScroll sits between the OS and applications, intercepting raw wheel events and re-emitting them as eased 120 Hz pulses. Built with Rust + Tauri (no Electron).

Key design decisions:
- OS-level hook (WH_MOUSE_LL) — works with every app
- Per-app profiles so different apps get different curves
- Game mode auto-bypass — foreground switches to a known game → raw input restored
- UWP force-enable — WinUI apps ignore synthetic wheel events by default, we override that
- Zero telemetry, standalone .exe, no services/drivers

License is FSL-1.1 (auto-converts to Apache 2.0 after 2 years).

Would love feedback on the approach and the license model.

---

## 📝 Dev.to / Hashnode / Medium

**Title:** Why Windows Still Doesn't Have System-Wide Smooth Scrolling in 2026 (And How I Fixed It)

**Tags:** `#windows` `#rust` `#opensource` `#tauri`

**Body:**

If you use Windows with a regular mouse, you've probably noticed something: scrolling feels different in every app.

Chrome has its own smooth scroll. Edge has its own. File Explorer doesn't bother. VS Code is janky. Adobe apps do their own thing.

There's no system-wide smooth scrolling on Windows — unlike macOS, which has it built into the OS.

I built [SmoothScroll](https://smoothscroll.top) to fix this.

### How it works

SmoothScroll sits between the Windows input system and your applications:

1. **Intercept** — A low-level hook (`WH_MOUSE_LL`) catches each raw wheel event before any app sees it
2. **Smooth** — An eased curve (Exponential, Cubic, Quintic, or Linear) interpolates the delta over an animation window
3. **Emit** — Synthetic wheel events fire at 120 Hz to the foreground app

Three steps, 120 times a second, for every wheel tick.

### What makes it different from existing tools

- **Per-app profiles** — Chrome gets snappy, VS Code gets silky, Photoshop gets raw
- **Game mode auto-bypass** — Switch to a game? Raw input restored. No config needed.
- **UWP force-enable** — WinUI apps ignore synthetic wheel events by default. We override that.
- **Per-monitor profiles** — Your 4K at home and 1080p at the office scroll differently
- **Zero telemetry** — No network calls, no analytics. Settings live in `%APPDATA%\SmoothScroll\`

### Tech stack

Built with Rust + Tauri 2. No Electron. The binary is tiny. No services, no drivers, no admin required.

### License

FSL-1.1 — free for personal, educational, and internal use. Auto-converts to Apache 2.0 after 2 years.

### Links

- Website: https://smoothscroll.top
- GitHub: https://github.com/quangtruong2003/SmoothScroll
- How it works: https://smoothscroll.top/how-it-works

---

## 🐦 Threads / Bluesky (short format)

### Option A
Windows has no system-wide smooth scrolling. I built one.

120 Hz easing engine. Per-app profiles. Game mode bypass. Zero telemetry.

Free → smoothscroll.top

### Option B
Every mouse wheel tick on Windows gets caught, eased, and re-emitted at 120 Hz.

SmoothScroll — smooth scrolling for every app. Free, open-source.

smoothscroll.top

### Option C
"Stop fighting your scroll wheel."

One download. One toggle. Feel it in 5 seconds.

smoothscroll.top

---

## 💼 LinkedIn

**Post:**

I just shipped a major update to SmoothScroll — a system-wide smooth scrolling engine for Windows.

The problem: Windows has no unified smooth scrolling. Every app implements it differently (or not at all). If you switch between Chrome, VS Code, and File Explorer, you're dealing with three different scroll behaviors.

SmoothScroll fixes this at the OS level with a 120 Hz easing engine built in Rust + Tauri.

What makes it different:
→ Per-app profiles (different curves for different apps)
→ Game mode auto-bypass (anti-cheat compatibility)
→ UWP/WinUI force-enable
→ Zero telemetry — no network calls, no analytics
→ Standalone binary — no services, no drivers

Free and open-source (FSL-1.1 → Apache 2.0).

Try it: https://smoothscroll.top
Source: https://github.com/quangtruong2003/SmoothScroll

#opensource #rust #windows #tui #ux
