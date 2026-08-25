// Pure maths for the Watchlist Decay/Graveyard differentiator. No React, no
// DOM, no Supabase — like ratingScale.ts and energyScale.ts, this stays a
// plain, independently testable function of (added_at, now).

/** Days elapsed since a watchlist_items row's added_at. */
export function decayDaysSince(addedAt: string, now: Date = new Date()): number {
  const addedMs = new Date(addedAt).getTime()
  const diffMs = now.getTime() - addedMs
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Maps days-unwatched onto a 0 (fresh) - 1 (fully decayed) level.
 *
 *   0-7 days   -> 0 (no visual change yet)
 *   7-30 days  -> 0 to 0.5, linear
 *   30-60 days -> 0.5 to 1, linear
 *   60+ days   -> capped at 1
 */
export function decayLevelForDays(decayDays: number): number {
  if (decayDays <= 7) return 0
  if (decayDays <= 30) return ((decayDays - 7) / (30 - 7)) * 0.5
  if (decayDays <= 60) return 0.5 + ((decayDays - 30) / (60 - 30)) * 0.5
  return 1
}

/** Convenience: straight from a watchlist_items row's added_at to a decayLevel. */
export function decayLevelForAddedAt(addedAt: string, now?: Date): number {
  return decayLevelForDays(decayDaysSince(addedAt, now))
}

/** decayLevel at which the rescue-or-bury prompt is offered (60+ days). */
export const DECAY_RESCUE_THRESHOLD = 1

/**
 * The four named decay stages (DESIGN.md §1), promoted from a styling
 * side-effect to the app's signature element. Never full greyscale/opacity
 * (should read "neglected", not "broken") and never a particle/grain effect,
 * which the project's motion rules explicitly rule out for anything demoed
 * over screen share.
 */
export type DecayStage = 'fresh' | 'settling' | 'stale' | 'graveyard'

const STAGE_FILTERS: Record<DecayStage, string> = {
  fresh: 'none',
  settling: 'saturate(0.85)',
  stale: 'saturate(0.55) brightness(0.82)',
  graveyard: 'saturate(0.15) brightness(0.6)',
}

/**
 * Which stage a continuous decayLevel falls into. Boundaries mirror
 * decayLevelForDays' own day breakpoints (7/30/60 days -> level 0/0.5/1),
 * so a caller already holding a decayLevel can classify it without the
 * original day count.
 */
export function decayStageForLevel(decayLevel: number): DecayStage {
  if (decayLevel <= 0) return 'fresh'
  if (decayLevel < 0.5) return 'settling'
  if (decayLevel < 1) return 'stale'
  return 'graveyard'
}

/** The poster's filter for its stage. Discrete (four fixed values), unlike
 *  the hairline below — the CSS transition between values on stage change
 *  is what makes it read as "settling", not the values themselves. */
export function decayPosterStyle(decayLevel: number): { filter: string } {
  return { filter: STAGE_FILTERS[decayStageForLevel(decayLevel)] }
}

/**
 * Width (as a percentage of the poster's own width) of the 1px decay
 * hairline at its base. Continuous rather than stage-based — "shortening
 * and fading" is meant to read as a feeling, not a jump cut. Floors at 18%
 * rather than 0 so a fully-decayed item still shows a sliver, not nothing.
 */
export function decayHairlineWidth(decayLevel: number): number {
  const level = Math.min(1, Math.max(0, decayLevel))
  const MIN_WIDTH = 18
  return 100 - level * (100 - MIN_WIDTH)
}
