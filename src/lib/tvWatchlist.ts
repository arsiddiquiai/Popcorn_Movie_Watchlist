import type { Json, TvCache, TvWatchlistItem, WatchlistStatus } from './database.types'
import { getTvDetails, pickTrailerKey } from './tmdbClient'
import { supabase } from './supabaseClient'

/** Mirrors lib/watchlist.ts exactly, operating on tv_cache/
 *  tv_watchlist_items instead of movies_cache/watchlist_items — see the
 *  migration's own header comment for why TV gets fully parallel tables
 *  rather than a shared/altered schema. */

export async function getOrCacheTvShow(tmdbId: number): Promise<TvCache> {
  const { data: existing, error: selectError } = await supabase
    .from('tv_cache')
    .select('*')
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing

  const details = await getTvDetails(tmdbId)

  const { error: upsertError } = await supabase.from('tv_cache').upsert(
    {
      tmdb_id: details.id,
      name: details.name,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      first_air_year: details.first_air_date ? new Date(details.first_air_date).getFullYear() : null,
      episode_run_minutes: details.episode_run_time?.[0] ?? null,
      genres: details.genres.map((g) => g.name),
      overview: details.overview,
      tmdb_rating: details.vote_average,
      original_language: details.original_language,
      trailer_key: pickTrailerKey(details.videos),
      credits: (details.credits ?? null) as Json | null,
    },
    { onConflict: 'tmdb_id', ignoreDuplicates: true },
  )
  if (upsertError) throw upsertError

  const { data: row, error: reselectError } = await supabase
    .from('tv_cache')
    .select('*')
    .eq('tmdb_id', tmdbId)
    .single()
  if (reselectError) throw reselectError
  return row
}

export type AddToTvWatchlistResult = 'added' | 'already_on_list'

export async function addToTvWatchlist(tmdbId: number, userId: string): Promise<AddToTvWatchlistResult> {
  await getOrCacheTvShow(tmdbId)

  const { data: existing, error: selectError } = await supabase
    .from('tv_watchlist_items')
    .select('id, status')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (selectError) throw selectError

  if (existing) {
    if (existing.status !== 'dropped') return 'already_on_list'
    const { error: updateError } = await supabase
      .from('tv_watchlist_items')
      .update({ status: 'want', watched_at: null })
      .eq('id', existing.id)
    if (updateError) throw updateError
    return 'added'
  }

  const { error: insertError } = await supabase
    .from('tv_watchlist_items')
    .insert({ user_id: userId, tmdb_id: tmdbId, status: 'want' })
  if (insertError) {
    if (insertError.code === '23505') return 'already_on_list'
    throw insertError
  }
  return 'added'
}

export async function getTvWatchlistItem(userId: string, tmdbId: number): Promise<TvWatchlistItem | null> {
  const { data, error } = await supabase
    .from('tv_watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function markTvAsWatched(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('tv_watchlist_items')
    .update({ status: 'watched', watched_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) throw error
}

export async function unmarkTvWatched(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('tv_watchlist_items')
    .update({ status: 'want', watched_at: null })
    .eq('id', itemId)
  if (error) throw error
}

export async function removeFromTvWatchlist(itemId: string): Promise<void> {
  const { error } = await supabase.from('tv_watchlist_items').update({ status: 'dropped' }).eq('id', itemId)
  if (error) throw error
}

export interface TvWatchlistEntry {
  item: TvWatchlistItem
  show: TvCache
  score: number | null
}

export async function fetchTvWatchlistByStatus(userId: string, status: WatchlistStatus): Promise<TvWatchlistEntry[]> {
  const { data: items, error: itemsError } = await supabase
    .from('tv_watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('added_at', { ascending: false })
  if (itemsError) throw itemsError
  if (!items.length) return []

  const tmdbIds = items.map((item) => item.tmdb_id)

  const { data: shows, error: showsError } = await supabase.from('tv_cache').select('*').in('tmdb_id', tmdbIds)
  if (showsError) throw showsError
  const showByTmdbId = new Map(shows.map((show) => [show.tmdb_id, show]))

  let scoreByTmdbId = new Map<number, number>()
  if (status === 'watched') {
    const { data: ratings, error: ratingsError } = await supabase
      .from('tv_ratings')
      .select('tmdb_id, score')
      .eq('user_id', userId)
      .in('tmdb_id', tmdbIds)
    if (ratingsError) throw ratingsError
    scoreByTmdbId = new Map(ratings.map((rating) => [rating.tmdb_id, rating.score]))
  }

  return items.flatMap((item) => {
    const show = showByTmdbId.get(item.tmdb_id)
    if (!show) return []
    return [{ item, show, score: scoreByTmdbId.get(item.tmdb_id) ?? null }]
  })
}
