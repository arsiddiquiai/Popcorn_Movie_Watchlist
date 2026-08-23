// Pure maths + copy for the Pick For Me transformation. No React, no DOM —
// like ratingScale.ts, the colours themselves are read from CSS variables
// by the caller so all three themes stay correct and nothing here hardcodes
// a hex value.
//
// CLAUDE.md's motion rules drive every number below: this is demoed over
// Google Meet screen share, where video compression destroys fine detail.
// So: one large colour block, slow sweeping scale, no particles, no grain.
// Fewer, bigger, slower.

import { clamp, interpolateScoreColor, type Rgb } from './ratingScale'

export const ENERGY_MIN = 1
export const ENERGY_MAX = 5

/** Short label under each energy level in the selector. */
export const ENERGY_LABELS: Record<number, string> = {
  1: 'Drained',
  2: 'Low',
  3: 'Steady',
  4: 'Up for it',
  5: 'Wired',
}

/** What the transformation says while it runs, per energy level. */
export const ENERGY_STATUS_COPY: Record<number, string> = {
  1: 'Winding all the way down…',
  2: 'Looking for something gentle…',
  3: 'Reading the room…',
  4: 'Finding something with a pulse…',
  5: 'Chasing something big…',
}

export interface EnergyVisuals {
  /** The wash colour, interpolated cold (drained) -> warm (wired). */
  tint: Rgb
  /** Peak opacity of the colour wash. */
  intensity: number
  /** Overall brightness multiplier — dimmer when drained, brighter when wired. */
  brightness: number
  /** Saturation multiplier — desaturated when drained. */
  saturation: number
  /** Seconds for one breath of the wash. Slow when drained, quicker when wired. */
  breathSeconds: number
  /** Minimum seconds the transformation stays up, so it can't resolve early. */
  minDurationSeconds: number
  statusCopy: string
}

/**
 * Maps energy 1-5 onto the transformation's visual state.
 *
 * Energy is remapped onto the rating scale's 1-10 range so the wash reuses
 * the exact cold -> neutral -> warm interpolation the rating slider uses.
 * That's deliberate: it's the same "this is how the app feels about where
 * you are" colour language, even though the control itself looks nothing
 * like the rating slider.
 */
export function energyVisuals(energy: number, cold: Rgb, neutral: Rgb, warm: Rgb): EnergyVisuals {
  const e = clamp(energy, ENERGY_MIN, ENERGY_MAX)
  // 1 -> 1, 5 -> 10, so the ends hit the true cold and warm anchors.
  const asScore = 1 + ((e - 1) / (ENERGY_MAX - ENERGY_MIN)) * 9
  const t = (e - 1) / (ENERGY_MAX - ENERGY_MIN) // 0 at drained, 1 at wired

  return {
    tint: interpolateScoreColor(asScore, cold, neutral, warm),
    intensity: 0.5 + t * 0.32,
    brightness: 0.72 + t * 0.42,
    saturation: 0.72 + t * 0.5,
    // Slower breath when drained (calmer), quicker when wired.
    breathSeconds: 5.2 - t * 2.6,
    // Low energy lingers a little longer before the result lands. Both ends
    // sit under the function's ~5-7s real latency, so in practice the
    // network is what gates the reveal — this only guarantees the
    // transformation never flashes past on an unusually fast response.
    minDurationSeconds: 3.4 - t * 0.9,
    statusCopy: ENERGY_STATUS_COPY[Math.round(e)] ?? ENERGY_STATUS_COPY[3],
  }
}
