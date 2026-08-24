import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider'
import type { Profile } from '../lib/database.types'
import { supabase } from '../lib/supabaseClient'
import { RETIRED_THEMES, type Theme, type ThemeContextValue } from './types'

const THEME_KEY = 'popcorn:theme'
const REDUCED_MOTION_KEY = 'popcorn:reduced-motion'
const DEFAULT_THEME: Theme = 'nightcap'

const THEMES: Theme[] = ['nightcap', 'daylight', 'neon']

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Normalises any stored theme string into a currently-valid Theme.
 *
 * Order matters: a retired name is mapped to its replacement BEFORE the
 * validity check, so `cinema` resolves to `neon` rather than failing the
 * check and silently becoming the default. Shared by both the localStorage
 * read below and the Supabase profile pull, since either can hold a stale
 * value independently.
 */
function normaliseTheme(stored: string | null | undefined): Theme | null {
  if (!stored) return null
  const migrated = RETIRED_THEMES[stored] ?? stored
  return (THEMES as string[]).includes(migrated) ? (migrated as Theme) : null
}

function readStoredTheme(): Theme {
  return normaliseTheme(window.localStorage.getItem(THEME_KEY)) ?? DEFAULT_THEME
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
      // supabase-js can't parse a multi-column select string into a
      // precise type, so it falls back to `never` — override it
      // explicitly with the slice of Profile these columns actually are.
      const { data } = await supabase
        .from('profiles')
        .select('theme_pref, reduced_motion')
        .eq('id', userId)
        .single<Pick<Profile, 'theme_pref' | 'reduced_motion'>>()

      if (cancelled) return
      if (data) {
        // Same migration as the localStorage path — a profile row written
        // before `cinema` was retired must resolve to `neon`, not default.
        // The push effect below then writes the migrated value back, so the
        // stale name clears itself from the row on next render.
        const migrated = normaliseTheme(data.theme_pref)
        if (migrated) setTheme(migrated)
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
