export type Theme = 'nightcap' | 'daylight' | 'neon'

/**
 * Themes that no longer exist, mapped to their replacement.
 *
 * `cinema` was removed in the redesign (DESIGN.md §2) because it and
 * `nightcap` were both warm near-blacks and read as the same theme. Anyone
 * still carrying it — in localStorage on a device they haven't opened since,
 * or in their Supabase `profiles.theme_pref` row — must land on the theme
 * that actually replaced it, not silently fall back to the default. Without
 * this, a `cinema` user would appear to have their preference reset.
 */
export const RETIRED_THEMES: Record<string, Theme> = {
  cinema: 'neon',
}

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  reducedMotion: boolean
  setReducedMotion: (reducedMotion: boolean) => void
}
