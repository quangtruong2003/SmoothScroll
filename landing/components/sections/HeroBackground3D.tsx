'use client'

import { useEffect, useRef, useState } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** Ribbons of eased motion, rendered on a raw WebGL canvas.
 *
 * Replaces the pre-rendered hero scrub videos (~4 MB of mp4) with ~4 KB of
 * shader. Colours are read from the `--brand-from` / `--brand-to` design
 * tokens in globals.css, so the background follows the theme instead of
 * hard-coding hexes, and the light/dark swap needs no second asset.
 *
 * Behaviour:
 * - ambient drift by default, with scroll progress through the sticky hero
 *   speeding up the flow and fading the ribbons out behind the copy
 * - the travelling highlights ease along each ribbon on a quintic-out curve —
 *   the engine's own default easing
 * - prefers-reduced-motion renders a single static frame
 * - no WebGL (or a lost context) falls back to the existing poster image
 */

const RIBBONS = [
  { phase: 0.0, amp: 1.0, offset: 0.4, opacity: 0.5 },
  { phase: 2.1, amp: 0.75, offset: -1.2, opacity: 0.34 },
  { phase: 4.4, amp: 1.25, offset: 1.6, opacity: 0.22 },
  { phase: 6.2, amp: 0.55, offset: -2.4, opacity: 0.16 },
]

const VERT = `
attribute vec2 aPos;
uniform float uTime, uPhase, uAmp, uOffset, uAspect;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  float x = aPos.x * 9.5;
  float w = sin(x * 0.28 + uTime * 0.5 + uPhase) * 1.1
          + sin(x * 0.13 - uTime * 0.32 + uPhase * 2.0) * 1.8
          + sin(x * 0.52 + uTime * 0.75 + uPhase * 0.5) * 0.25;
  float y = aPos.y * 0.16 + (w * uAmp + uOffset) * 0.11;
  gl_Position = vec4(aPos.x, y / uAspect, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
uniform vec3 uFrom, uTo;
uniform float uOpacity, uFade, uHead;
varying vec2 vUv;
void main() {
  vec3 c = mix(uFrom, uTo, smoothstep(0.0, 1.0, vUv.x));
  float core = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.2);
  float band = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
  float ends = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x);
  // travelling highlight: a soft pulse eased along the ribbon
  float head = exp(-pow((vUv.x - uHead) * 14.0, 2.0));
  float a = (band * 0.55 + core * 0.8 + head * core * 1.6) * ends * uOpacity * uFade;
  gl_FragColor = vec4(c * (1.0 + head), a);
}`

function readToken(name: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const [h, s, l] = raw.split(/\s+/).map((part) => parseFloat(part))
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return [0.35, 0.55, 0.96]
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1))
  return [f(0), f(8), f(4)]
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export function HeroBackground3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isFallbackVisible, setIsFallbackVisible] = useState(false)
  const [fallbackPoster, setFallbackPoster] = useState(`${BASE_PATH}/assets/smooth-scrolling-light-poster.webp`)

  useEffect(() => {
    const canvas = canvasRef.current
    const hero = canvas?.closest<HTMLElement>('[data-hero-layout]')
    if (!canvas || !hero) return

    let raf = 0
    let isFallback = false
    const updateFallbackPoster = () => {
      setFallbackPoster(`${BASE_PATH}/assets/smooth-scrolling-${document.documentElement.classList.contains('dark') ? 'dark' : 'light'}-poster.webp`)
    }
    const fallbackThemeObserver = new MutationObserver(updateFallbackPoster)
    const showFallback = () => {
      isFallback = true
      cancelAnimationFrame(raf)
      raf = 0
      updateFallbackPoster()
      fallbackThemeObserver.observe(document.documentElement, { attributeFilter: ['class'] })
      setIsFallbackVisible(true)
    }
    const cleanupFallback = () => fallbackThemeObserver.disconnect()

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      // The shader writes straight (non-premultiplied) colour; without this the
      // compositor would treat RGB as already multiplied and wash the ribbons
      // out to nothing over a light background.
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    })
    if (!gl) {
      showFallback()
      return cleanupFallback
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    const program = gl.createProgram()
    if (!vs || !fs || !program) {
      showFallback()
      return cleanupFallback
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      showFallback()
      return cleanupFallback
    }
    gl.useProgram(program)
    canvas.addEventListener('webglcontextlost', showFallback)

    // one screen-wide strip, subdivided along x so the wave can bend it
    const SEGMENTS = 180
    const verts: number[] = []
    for (let i = 0; i <= SEGMENTS; i++) {
      const x = (i / SEGMENTS) * 2 - 1
      verts.push(x, -1, x, 1)
    }
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const u = {
      time: gl.getUniformLocation(program, 'uTime'),
      phase: gl.getUniformLocation(program, 'uPhase'),
      amp: gl.getUniformLocation(program, 'uAmp'),
      offset: gl.getUniformLocation(program, 'uOffset'),
      aspect: gl.getUniformLocation(program, 'uAspect'),
      opacity: gl.getUniformLocation(program, 'uOpacity'),
      fade: gl.getUniformLocation(program, 'uFade'),
      head: gl.getUniformLocation(program, 'uHead'),
      from: gl.getUniformLocation(program, 'uFrom'),
      to: gl.getUniformLocation(program, 'uTo'),
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)

    let from = readToken('--brand-from')
    let to = readToken('--brand-to')
    let aspect = 1
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      aspect = Math.max(0.35, canvas.clientHeight / Math.max(1, canvas.clientWidth)) * 2.6
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let progress = 0
    let eased = 0
    let time = motionPreference.matches ? 14 : 0
    let last = performance.now()
    let visible = true

    const readProgress = () => {
      const distance = hero.offsetHeight - window.innerHeight
      const top = -hero.getBoundingClientRect().top
      progress = distance > 20
        ? Math.min(1, Math.max(0, top / distance))
        : Math.min(1, Math.max(0, top / Math.max(1, window.innerHeight)))
    }

    const draw = () => {
      resize()
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      const fade = Math.max(0, 1 - eased * 0.75)
      gl.uniform1f(u.aspect, aspect)
      gl.uniform1f(u.fade, fade)
      gl.uniform3f(u.from, from[0], from[1], from[2])
      gl.uniform3f(u.to, to[0], to[1], to[2])
      RIBBONS.forEach((ribbon, index) => {
        // quintic-out, the engine's default curve, staggered per ribbon
        const cycle = ((time * 0.26 + index * 0.27) % 1 + 1) % 1
        gl.uniform1f(u.time, time)
        gl.uniform1f(u.phase, ribbon.phase)
        gl.uniform1f(u.amp, ribbon.amp)
        gl.uniform1f(u.offset, ribbon.offset)
        gl.uniform1f(u.opacity, ribbon.opacity)
        gl.uniform1f(u.head, 1 - Math.pow(1 - cycle, 5))
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (SEGMENTS + 1) * 2)
      })
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      const delta = Math.min((now - last) / 1000, 0.05)
      last = now
      if (!visible) return
      time += delta * (1 + eased * 1.6)
      eased += (progress - eased) * 0.06
      draw()
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    observer.observe(canvas)

    const themeObserver = new MutationObserver(() => {
      from = readToken('--brand-from')
      to = readToken('--brand-to')
      if (motionPreference.matches) draw()
    })
    themeObserver.observe(document.documentElement, { attributeFilter: ['class'] })

    const configureMotion = () => {
      if (isFallback) return
      cancelAnimationFrame(raf)
      raf = 0
      readProgress()
      eased = progress
      if (motionPreference.matches) {
        draw()
      } else {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }

    window.addEventListener('scroll', readProgress, { passive: true })
    window.addEventListener('resize', resize)
    motionPreference.addEventListener('change', configureMotion)
    configureMotion()

    return () => {
      cancelAnimationFrame(raf)
      cleanupFallback()
      observer.disconnect()
      themeObserver.disconnect()
      canvas.removeEventListener('webglcontextlost', showFallback)
      window.removeEventListener('scroll', readProgress)
      window.removeEventListener('resize', resize)
      motionPreference.removeEventListener('change', configureMotion)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return (
    <>
      <div
        aria-hidden="true"
        data-hero-fallback
        className={`pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-300 ${isFallbackVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: `url(${fallbackPoster})` }}
      />
      <canvas
        ref={canvasRef}
        data-hero-canvas
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${isFallbackVisible ? 'opacity-0' : 'opacity-100'}`}
      />
    </>
  )
}
