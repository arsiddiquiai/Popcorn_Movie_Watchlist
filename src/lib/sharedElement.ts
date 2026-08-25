/**
 * Shared layoutId scheme for the poster shared-element transition
 * (DESIGN.md §6) between WatchlistCard/SearchResultCard and Movie
 * Detail's hero. Framer Motion's own layoutId matching does the actual
 * animation work — this just keeps all three call sites using the exact
 * same id format, so there's one source of truth instead of three
 * hand-typed template strings that could drift apart.
 */
export function posterLayoutId(tmdbId: number): string {
  return `poster-${tmdbId}`
}
