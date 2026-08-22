import { useEffect, useState } from 'react'
import { parseCssColor, type Rgb } from '../../lib/ratingScale'
import { useTheme } from '../../theme/ThemeProvider'

export interface RatingColors {
  cold: Rgb
  neutral: Rgb
  warm: Rgb
}

// Read from the live CSS custom properties rather than duplicating the
// palette in JS, so the interpolation follows whichever theme is active
// (and keeps the "never hardcode a colour" rule intact).
function readRatingColors(): RatingColors {
  const styles = getComputedStyle(document.documentElement)
  return {
    cold: parseCssColor(styles.getPropertyValue('--accent-cold')),
    neutral: parseCssColor(styles.getPropertyValue('--muted')),
    warm: parseCssColor(styles.getPropertyValue('--accent-warm')),
  }
}

export function useRatingColors(): RatingColors {
  const { theme } = useTheme()
  const [colors, setColors] = useState<RatingColors>(readRatingColors)

  useEffect(() => {
    setColors(readRatingColors())
  }, [theme])

  return colors
}
