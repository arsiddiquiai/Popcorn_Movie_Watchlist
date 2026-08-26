/**
 * Shared layoutId scheme for the poster shared-element transition
 * (DESIGN.md §6) between WatchlistCard/SearchResultCard and Movie
 * Detail's hero. Framer Motion's own layoutId matching does the actual
 * animation work — this just keeps all call sites using the exact same id
 * format, so there's one source of truth instead of hand-typed template
 * strings that could drift apart.
 *
 * `mediaType` defaults to 'movie' so every existing call site (all three
 * originally passed a bare tmdb_id) keeps producing a consistent id with
 * no changes needed there — the id's STRING VALUE did change shape
 * (`poster-{id}` -> `poster-movie-{id}`), but since this is a pure
 * function recomputed fresh on every render with no stored/cached old
 * value anywhere, every existing caller shifts to the new format
 * together and the shared-element match among them is unaffected.
 *
 * The parameter exists because TMDB's movie and TV id spaces are
 * separate and can collide numerically (see the TV migration's own
 * comment) — without it, a movie and a TV show that happened to share a
 * numeric tmdb_id could make Framer Motion morph between the wrong two
 * poster elements if both were ever visible in the same transition.
 */
export function posterLayoutId(tmdbId: number, mediaType: 'movie' | 'tv' = 'movie'): string {
  return `poster-${mediaType}-${tmdbId}`
}
