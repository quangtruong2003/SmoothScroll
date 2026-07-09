'use client'

import { useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  const resolved = theme === 'system' ? getSystemTheme() : theme
  root.classList.add(resolved)
  // Clear inline styles set by the inline <script> to let CSS variables take over
  root.style.removeProperty('background')
  root.style.removeProperty('color')
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
    setThemeState(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    applyTheme(theme)
  }, [theme, mounted])

  useEffect(() => {
    if (!mounted || theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme, mounted])

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  const resolvedTheme: 'light' | 'dark' = mounted
    ? theme === 'system'
      ? getSystemTheme()
      : theme
    : 'light'

  return { theme, setTheme, resolvedTheme, mounted }
}
