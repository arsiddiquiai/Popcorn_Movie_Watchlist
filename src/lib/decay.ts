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
 * The poster's decay treatment: desaturation + a slight opacity drop, never
 * full greyscale (should read "neglected", not "broken" — CLAUDE.md's own
 * distinction) and never a particle/grain effect, which the project's
 * motion rules explicitly rule out for anything demoed over screen share.
 *
 * Saturation floors at 35% rather than 0 for the same reason; opacity floors
 * at 0.75, within the spec's 70-80% range.
 */
export function decayPosterStyle(decayLevel: number): { filter: string; opacity: number } {
  const level = Math.min(1, Math.max(0, decayLevel))
  const MIN_SATURATION = 35
  const MIN_OPACITY = 0.75
  const saturation = 100 - level * (100 - MIN_SATURATION)
  const opacity = 1 - level * (1 - MIN_OPACITY)
  return { filter: `saturate(${saturation.toFixed(1)}%)`, opacity: Number(opacity.toFixed(3)) }
}
