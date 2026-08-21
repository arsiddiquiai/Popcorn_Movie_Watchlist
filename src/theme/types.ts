export type Theme = 'nightcap' | 'daylight' | 'cinema'

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  reducedMotion: boolean
  setReducedMotion: (reducedMotion: boolean) => void
}
