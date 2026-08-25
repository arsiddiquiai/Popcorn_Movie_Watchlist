/**
 * The share card's "taste badge" — a short stat line like "60% of your list
 * is thriller".
 *
 * Self-relative, not cross-user: the brief's first choice was a comparison
 * against other users' aggregate distribution (e.g. "Top 4% for Korean
 * cinema this month"), but that needs a global stats table or materialized
 * view this project doesn't have — nothing in the schema aggregates across
 * users today, and building that pipeline is out of scope for a share-card
 * visual pass. The brief explicitly names a self-relative stat as an
 * acceptable fallback, so that's what this computes: purely from the
 * caller's own genre distribution, no server round-trip and no AI call —
 * zero added cost or latency, unlike the verdict line.
 *
 * Pure maths, no React/DOM/Supabase — same shape as ratingScale.ts and
 * decay.ts.
 */

const MIN_ITEMS = 3
/** Below this share of the list, naming one genre as "the" pattern
 *  overstates a fairly even spread — stay quiet rather than force a badge
 *  that isn't really there. */
const MIN_SHARE_PERCENT = 25

export function computeTasteBadge(genreLists: (string[] | null)[]): string | null {
  if (genreLists.length < MIN_ITEMS) return null

  const counts = new Map<string, number>()
  for (const genres of genreLists) {
    for (const genre of genres ?? []) counts.set(genre, (counts.get(genre) ?? 0) + 1)
  }
  if (counts.size === 0) return null

  const [topGenre, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const percent = Math.round((topCount / genreLists.length) * 100)
  if (percent < MIN_SHARE_PERCENT) return null

  return `${percent}% of your list is ${topGenre.toLowerCase()}`
}
