import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabaseClient'
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
  const { user } = useAuth()
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const [reducedMotion, setReducedMotion] = useState<boolean>(readStoredReducedMotion)
  // Which user id we've finished pulling Supabase preferences for. Pushes
  // are gated on this so a fresh login can't race the pull and clobber a
  // saved preference with a stale local value before it's even been read
  // (see the pull/push effects below).
  const hydratedForUserId = useRef<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion))
    window.localStorage.setItem(REDUCED_MOTION_KEY, String(reducedMotion))
  }, [reducedMotion])

  // On login, pull saved preferences from the user's profile row so they
  // follow the user across devices. Falls back to whatever localStorage/
  // system-default already resolved to if the profile hasn't set them yet
  // (or if the fetch fails). Only once this finishes do we allow the push
  // effects below to write anything, so a fresh device can't round-trip
  // its local default back to Supabase before we've had a chance to read
  // the user's real saved value.
  useEffect(() => {
    const userId = user?.id
    if (!userId) {
      hydratedForUserId.current = null
      return
    }
    let cancelled = false

    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('theme_pref, reduced_motion')
        .eq('id', userId)
        .single()

      if (cancelled) return
      if (data) {
        if ((THEMES as string[]).includes(data.theme_pref ?? '')) setTheme(data.theme_pref as Theme)
        if (typeof data.reduced_motion === 'boolean') setReducedMotion(data.reduced_motion)
      }
      hydratedForUserId.current = userId
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Keep the profile row in sync with any local preference change, once
  // we've hydrated from Supabase for the current user.
  useEffect(() => {
    const userId = user?.id
    if (!userId || hydratedForUserId.current !== userId) return
    void (async () => {
      const { error } = await supabase.from('profiles').update({ theme_pref: theme }).eq('id', userId)
      if (error) console.error('Failed to sync theme preference:', error.message)
    })()
  }, [user?.id, theme])

  useEffect(() => {
    const userId = user?.id
    if (!userId || hydratedForUserId.current !== userId) return
    void (async () => {
      const { error } = await supabase.from('profiles').update({ reduced_motion: reducedMotion }).eq('id', userId)
      if (error) console.error('Failed to sync reduced-motion preference:', error.message)
    })()
  }, [user?.id, reducedMotion])

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
