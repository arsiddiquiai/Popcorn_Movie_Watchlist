import type { Json, MovieCache, WatchlistItem, WatchlistStatus } from './database.types'
import { getMovieDetails, pickTrailerKey } from './tmdbClient'
import { supabase } from './supabaseClient'

/** Returns the cached movies_cache row for a tmdb_id, upserting it from TMDB first if it isn't cached yet. */
export async function getOrCacheMovie(tmdbId: number): Promise<MovieCache> {
  const { data: existing, error: selectError } = await supabase
    .from('movies_cache')
    .select('*')
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing

  const details = await getMovieDetails(tmdbId)

  const { data: inserted, error: upsertError } = await supabase
    .from('movies_cache')
    .upsert({
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
    .select()
    .single()
  if (upsertError) throw upsertError
  return inserted
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
  await getOrCacheMovie(tmdbId)

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

/** The current user's watchlist_items row for this movie, or null if it isn't on their list at all. */
export async function getWatchlistItem(userId: string, tmdbId: number): Promise<WatchlistItem | null> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function markAsWatched(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('watchlist_items')
    .update({ status: 'watched', watched_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) throw error
}

export async function removeFromWatchlist(itemId: string): Promise<void> {
  const { error } = await supabase.from('watchlist_items').update({ status: 'dropped' }).eq('id', itemId)
  if (error) throw error
}

export interface WatchlistEntry {
  item: WatchlistItem
  movie: MovieCache
  /** The user's rating for this movie, if they've rated it. */
  score: number | null
}

/** All of the current user's watchlist entries with a given status, newest-added first, joined with their cached movie data and (for 'watched') their rating score. */
export async function fetchWatchlistByStatus(userId: string, status: WatchlistStatus): Promise<WatchlistEntry[]> {
  const { data: items, error: itemsError } = await supabase
    .from('watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('added_at', { ascending: false })
  if (itemsError) throw itemsError
  if (!items.length) return []

  const tmdbIds = items.map((item) => item.tmdb_id)

  const { data: movies, error: moviesError } = await supabase.from('movies_cache').select('*').in('tmdb_id', tmdbIds)
  if (moviesError) throw moviesError
  const movieByTmdbId = new Map(movies.map((movie) => [movie.tmdb_id, movie]))

  let scoreByTmdbId = new Map<number, number>()
  if (status === 'watched') {
    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .select('tmdb_id, score')
      .eq('user_id', userId)
      .in('tmdb_id', tmdbIds)
    if (ratingsError) throw ratingsError
    scoreByTmdbId = new Map(ratings.map((rating) => [rating.tmdb_id, rating.score]))
  }

  return items.flatMap((item) => {
    const movie = movieByTmdbId.get(item.tmdb_id)
    // Shouldn't happen given the FK, but a row disappearing between the
    // two queries is possible in theory — skip rather than crash.
    if (!movie) return []
    return [{ item, movie, score: scoreByTmdbId.get(item.tmdb_id) ?? null }]
  })
}
