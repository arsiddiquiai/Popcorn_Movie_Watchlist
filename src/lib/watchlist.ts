import type { Json } from './database.types'
import { getMovieDetails, pickTrailerKey } from './tmdbClient'
import { supabase } from './supabaseClient'

/** Upserts movies_cache from TMDB if this tmdb_id isn't cached yet. */
async function ensureMovieCached(tmdbId: number): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from('movies_cache')
    .select('tmdb_id')
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return

  const details = await getMovieDetails(tmdbId)

  const { error: upsertError } = await supabase.from('movies_cache').upsert({
    tmdb_id: details.id,
    title: details.title,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    release_year: details.release_date ? new Date(details.release_date).getFullYear() : null,
    runtime_minutes: details.runtime,
    genres: details.genres.map((g) => g.name),
    overview: details.overview,
    tmdb_rating: details.vote_average,
    original_language: details.original_language,
    trailer_key: pickTrailerKey(details.videos),
    // TMDB's credits shape is a plain JSON-serializable object at runtime;
    // it just isn't structurally assignable to the generic Json type
    // without this cast (named interfaces vs. an index signature).
    credits: (details.credits ?? null) as Json | null,
  })
  if (upsertError) throw upsertError
}

export type AddToWatchlistResult = 'added' | 'already_on_list'

/**
 * Adds a movie to the current user's watchlist, caching it in movies_cache
 * first if needed. A row that already exists with status 'want' or
 * 'watched' is left untouched and reported as "already on the list" — a
 * 'dropped' row (previously removed) is reset back to 'want' instead of
 * hitting the (user_id, tmdb_id) unique constraint.
 */
export async function addToWatchlist(tmdbId: number, userId: string): Promise<AddToWatchlistResult> {
  await ensureMovieCached(tmdbId)

  const { data: existing, error: selectError } = await supabase
    .from('watchlist_items')
    .select('id, status')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (selectError) throw selectError

  if (existing) {
    if (existing.status !== 'dropped') return 'already_on_list'

    const { error: updateError } = await supabase
      .from('watchlist_items')
      .update({ status: 'want', watched_at: null })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return 'added'
  }

  const { error: insertError } = await supabase
    .from('watchlist_items')
    .insert({ user_id: userId, tmdb_id: tmdbId, status: 'want' })
  if (insertError) {
    // Unique-violation race (e.g. a duplicate click firing before the
    // first request's row existed at SELECT time) — treat it the same as
    // "already on your list" rather than surfacing a raw DB error.
    if (insertError.code === '23505') return 'already_on_list'
    throw insertError
  }
  return 'added'
}
