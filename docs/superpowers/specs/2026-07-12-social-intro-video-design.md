# Design: SmoothScroll Social Media Intro Video — "The Reveal"

**Date:** 2026-07-12
**Status:** Approved
**Author:** Codex (brainstorming session)

---

## Overview

A 25-second cinematic social media video (9:16 vertical, 1080x1920) introducing SmoothScroll for Windows. Dark-to-light dramatic reveal style. Problem - Solution - Features - CTA structure. HyperFrames HTML + GSAP stack. TTS narration + cinematic BGM + SFX.

---

## Target Platform

- **Primary:** TikTok, Instagram Reels, YouTube Shorts
- **Format:** 1080x1920 (9:16 vertical)
- **Duration:** 25 seconds
- **FPS:** 30
- **Output:** MP4 (H.264)
- **Audio:** TTS narration + BGM + SFX

---

## Visual Identity

Derived from existing SmoothScroll brand (see videos/smoothscroll-showcase/DESIGN.md).

### Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Near-Black | #09090B | Dark scenes bg, primary text on light |
| Pure White | #FFFFFF | Light scenes bg, card surfaces |
| Dark Navy | #18181B | CTA button bg, feature card icons |
| Near-White | #FAFAFA | Text on dark backgrounds |
| Gray | #5E5E6A | Secondary text, metadata |
| Border Gray | #E4E4E7 | Card borders on light bg |
| Amber | #B45309 | CTA URL text, warm glow accent |
| Yellow | #F59E0B | Radial glow highlights |

### Typography

- **Display/UI:** ui-sans-serif (system font stack)
- **Monospace:** ui-monospace
- **Scale:** 96px display, 36px h2, 18px body, 14px meta

### Motion Defaults

- **Easing:** power3.out for entrances, power2.inOut for transitions
- **Logo reveal:** back.out(2.0) — confident overshoot
- **Text typing:** steps(N) easing for discrete character appearance
- **Feature card stagger:** 0.4s interval
- **Scene transitions:** 0.5-0.6s

---

## Scene Breakdown

### Scene 1: THE PROBLEM (0:00-0:06)

**Concept:** Dark cinematic opening. Windows desktop with jarring jumpy scroll. Tension builds.

**Visual:**
- Pure black background (#09090B)
- Slow camera zoom toward center
- Screen recording frame (browser chrome mockup) appears at 2s
- Jumpy scroll GIF plays inside frame (jumpy-sluggish-scrolling-on-windows-with.gif)
- Text reveals character-by-character at bottom: "Windows scrolling is broken."
- "broken" in red/amber accent (#B45309)

**Audio:**
- **BGM:** Deep bass drone, tension builds
- **TTS:** "Windows scrolling is broken." — delivered at 4s, measured pace

**Timing:**
- 0.0-2.0s: Fade from black, slow zoom
- 2.0-4.0s: Screen frame + jumpy GIF appears (fade in + scale)
- 4.0-5.5s: Text types character-by-character
- 5.5-6.0s: Hold tension, music builds

---

### Scene 2: THE SOLUTION (0:07-0:14)

**Concept:** Dramatic light sweep from left. Everything transforms. SmoothScroll logo appears. Smooth scroll GIF plays. Hope and relief.

**Visual:**
- Light sweep transition (white gradient moves left to right over 0.6s)
- Background shifts to pure white (#FFFFFF)
- SmoothScroll logo scales in from 0.8 to 1.0 with back.out(2.0)
- Smooth scroll GIF plays in same frame position as Scene 1 jumpy GIF
- Tagline fades in below: "Mac-style smooth scrolling on Windows. Finally."
- Subtle warm amber radial glow in background

**Audio:**
- **BGM:** Music shifts to major key, swell at light sweep
- **SFX:** Whoosh at 7.0s (light sweep), chime at 8.0s (logo reveal)
- **TTS:** "Mac-style smooth scrolling on Windows. Finally." — delivered at 9s

**Timing:**
- 7.0-7.6s: Light sweep transition
- 7.6-8.2s: Logo enters (scale 0.8 to 1.0)
- 8.2-12.0s: Smooth GIF plays
- 12.0-13.0s: Tagline fades in
- 13.0-14.0s: Hold — complete picture

---

### Scene 3: FEATURES (0:15-0:22)

**Concept:** Three feature cards enter sequentially. Clean, informative, punchy.

**Visual:**
- White background continues from Scene 2
- Header: "Everything you need." — fades in at 15s
- 3 feature cards enter with stagger (0.4s each):
  1. **Pluggable easing curves** — Linear, Cubic, Quintic, Exponential
  2. **Per-app exclusion** — Opt out any app by process name
  3. **Tiny footprint** — Single Rust binary. No Electron.
- Each card: slide up + fade in, icon pulses briefly
- Card style: white bg, #E4E4E7 border, 12px radius, 24px padding

**Audio:**
- **SFX:** Swoosh at 15.5s, 17.0s, 18.5s (card entries)
- **TTS:** Narrator reads each feature name as card enters

**Timing:**
- 15.0-15.5s: Header fades in
- 15.5-16.5s: Card 1 enters
- 17.0-18.0s: Card 2 enters
- 18.5-19.5s: Card 3 enters
- 19.5-22.0s: All settled, hold

---

### Scene 4: CTA (0:23-0:25)

**Concept:** Dark dramatic close. Logo + tagline types itself + download CTA. Confident, memorable.

**Visual:**
- Fade to dark (#09090B) with radial warm amber glow
- Logo scales in (center, 200px)
- Tagline types character-by-character: "Free. Open-source. Just smooth."
- CTA button appears: "Download for Windows"
- URL below: "smoothscroll.top" in amber

**Audio:**
- **SFX:** Deep bass hit at 23.0s (dark transition), final chime at 24.8s (CTA)
- **TTS:** "Free. Open-source. Just smooth." — delivered at 23.5s

**Timing:**
- 23.0-23.5s: Fade to dark
- 23.5-24.0s: Logo enters
- 24.0-24.6s: Tagline types
- 24.6-25.0s: CTA + chime, hold

---

## Audio Design

### TTS Narration

Generated via Kokoro-82M (local TTS). Voice: neutral, confident, measured.

| Timestamp | Line | Delivery |
|-----------|------|----------|
| 4.0s | "Windows scrolling is broken." | Measured, slight emphasis on "broken" |
| 9.0s | "Mac-style smooth scrolling on Windows. Finally." | Warm, relieved tone |
| 15.5s | "Pluggable easing curves." | Quick, factual |
| 17.0s | "Per-app exclusion." | Quick, factual |
| 18.5s | "Tiny footprint." | Quick, factual |
| 23.5s | "Free. Open-source. Just smooth." | Confident, final |

### BGM

Cinematic ambient track. Structure:
- 0-6s: Dark drone, tension
- 7-14s: Major key swell, uplift
- 15-22s: Steady, rhythmic
- 23-25s: Resolve, fade out

### SFX

| Timestamp | Sound | Source |
|-----------|-------|--------|
| 7.0s | Light sweep whoosh | Generate or find |
| 8.0s | Logo reveal chime | Generate or find |
| 15.5s | Card enter swoosh | Generate or find |
| 17.0s | Card enter swoosh | Reuse |
| 18.5s | Card enter swoosh | Reuse |
| 23.0s | Deep bass hit | Generate or find |
| 24.8s | Final chime | Generate or find |

---

## Assets

### Existing (from repo)

- capture/assets/smoothscroll-logo.png
- capture/assets/jumpy-sluggish-scrolling-on-windows-with.gif
- capture/assets/smooth-fluid-scrolling-on-windows-with-s.gif
- capture/assets/smoothscroll-system-tray-panel.png

### To Generate/Find

- TTS narration clips (Kokoro-82M)
- BGM track (cinematic ambient, ~25s)
- SFX (whoosh, chime, bass hit)

---

## Technical Architecture

`
videos/social-intro/
  index.html                    root — BGM + beat orchestration
  DESIGN.md                     brand reference
  SCRIPT.md                     narration text
  STORYBOARD.md                 scene breakdown
  capture/                      existing assets (symlink or copy)
    assets/
  audio/
    narration/                  TTS clips per scene
    bgm/                        background music
    sfx/                        sound effects
  compositions/
    scene-1-problem.html
    scene-2-solution.html
    scene-3-features.html
    scene-4-cta.html
  snapshots/                    render preview frames
`

---

## Success Criteria

1. Video renders at 1080x1920, 30fps, 25s duration
2. All 4 scenes render correctly with proper timing
3. TTS narration syncs with visual cues
4. BGM transitions match scene changes
5. SFX land on correct timestamps
6. Before/after GIF comparison is clearly visible
7. CTA is readable and prominent
8. Total file size < 10MB for social media upload

---

## Scope Exclusions

- No multi-language version (English only)
- No subtitles/captions burned in (platform auto-captions)
- No horizontal (16:9) version
- No interactive elements
- No additional scenes beyond the 4 defined