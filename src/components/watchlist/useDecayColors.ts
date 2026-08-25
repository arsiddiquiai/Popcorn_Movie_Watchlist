import { useEffect, useState } from 'react'
import { parseCssColor, type Rgb } from '../../lib/ratingScale'
import { useTheme } from '../../theme/ThemeProvider'

export interface DecayColors {
  fresh: Rgb
  decayed: Rgb
}

// Same pattern as useRatingColors: read the live custom properties rather
// than duplicating the palette in JS, so the hairline follows whichever
// theme is active.
function readDecayColors(): DecayColors {
  const styles = getComputedStyle(document.documentElement)
  return {
    fresh: parseCssColor(styles.getPropertyValue('--accent-warm')),
    decayed: parseCssColor(styles.getPropertyValue('--muted-subtle')),
  }
}

export function useDecayColors(): DecayColors {
  const { theme } = useTheme()
  const [colors, setColors] = useState<DecayColors>(readDecayColors)

  useEffect(() => {
    setColors(readDecayColors())
  }, [theme])

  return colors
}
