'use client'

import { useEffect, useRef } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function HeroBackgroundVideo() {
  const lightVideoRef = useRef<HTMLVideoElement>(null)
  const darkVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const videos = [lightVideoRef.current, darkVideoRef.current].filter(
      (video): video is HTMLVideoElement => video !== null
    )
    const hero = videos[0]?.closest<HTMLElement>('[data-hero-layout]')
    if (!hero) return

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const themeObserver = new MutationObserver(() => scheduleSeek())
    let frame = 0

    const seek = () => {
      frame = 0
      const scrollDistance = hero.offsetHeight - window.innerHeight
      const progress = scrollDistance > 0
        ? Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / scrollDistance))
        : 0
      const activeVideo = videos.find((video) => getComputedStyle(video).display !== 'none') ?? videos[0]

      if (activeVideo && Number.isFinite(activeVideo.duration)) {
        activeVideo.currentTime = progress * activeVideo.duration
      }
    }
    const scheduleSeek = () => {
      if (!frame) frame = window.requestAnimationFrame(seek)
    }
    const configureMotion = () => {
      window.removeEventListener('scroll', scheduleSeek)
      window.removeEventListener('resize', scheduleSeek)
      if (!motionPreference.matches) {
        window.addEventListener('scroll', scheduleSeek, { passive: true })
        window.addEventListener('resize', scheduleSeek)
      }
      scheduleSeek()
    }

    videos.forEach((video) => video.addEventListener('loadedmetadata', scheduleSeek))
    motionPreference.addEventListener('change', configureMotion)
    themeObserver.observe(document.documentElement, { attributeFilter: ['class'] })
    configureMotion()

    return () => {
      videos.forEach((video) => video.removeEventListener('loadedmetadata', scheduleSeek))
      motionPreference.removeEventListener('change', configureMotion)
      themeObserver.disconnect()
      window.removeEventListener('scroll', scheduleSeek)
      window.removeEventListener('resize', scheduleSeek)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const videoClassName = 'absolute inset-0 h-full w-full object-cover object-center'

  return (
    <>
      <video
        ref={lightVideoRef}
        data-hero-video="light"
        src={`${BASE_PATH}/assets/smooth-scrolling-light-scrub.mp4`}
        poster={`${BASE_PATH}/assets/smooth-scrolling-light-poster.webp`}
        className={`${videoClassName} dark:hidden`}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <video
        ref={darkVideoRef}
        data-hero-video="dark"
        src={`${BASE_PATH}/assets/smooth-scrolling-dark-scrub.mp4`}
        poster={`${BASE_PATH}/assets/smooth-scrolling-dark-poster.webp`}
        className={`${videoClassName} hidden dark:block`}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    </>
  )
}
