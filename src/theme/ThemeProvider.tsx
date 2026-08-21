import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import type { Theme, ThemeContextValue } from './types'

const THEME_KEY = 'popcorn:theme'
const REDUCED_MOTION_KEY = 'popcorn:reduced-motion'
const DEFAULT_THEME: Theme = 'nightcap'

const THEMES: Theme[] = ['nightcap', 'daylight', 'cinema']

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY)
  return (THEMES as string[]).includes(stored ?? '') ? (stored as Theme) : DEFAULT_THEME
}

function readStoredReducedMotion(): boolean {
  const stored = window.localStorage.getItem(REDUCED_MOTION_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false
  // No explicit preference saved yet — fall back to the OS setting.
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const [reducedMotion, setReducedMotion] = useState<boolean>(readStoredReducedMotion)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion))
    window.localStorage.setItem(REDUCED_MOTION_KEY, String(reducedMotion))
  }, [reducedMotion])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, reducedMotion, setReducedMotion }}>
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>{children}</MotionConfig>
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
