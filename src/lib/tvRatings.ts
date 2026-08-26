import type { TvRating } from './database.types'
import { supabase } from './supabaseClient'

/** Mirrors lib/ratings.ts exactly, operating on tv_ratings instead of
 *  ratings — see the migration's own header comment for why TV gets fully
 *  parallel tables rather than a shared/altered schema. */

export async function getTvRating(userId: string, tmdbId: number): Promise<TvRating | null> {
  const { data, error } = await supabase
    .from('tv_ratings')
    .select('*')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveTvScore(userId: string, tmdbId: number, score: number): Promise<TvRating> {
  const { data, error } = await supabase
    .from('tv_ratings')
    .upsert({ user_id: userId, tmdb_id: tmdbId, score }, { onConflict: 'user_id,tmdb_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveTvReasonTags(ratingId: string, tags: string[]): Promise<void> {
  const { error } = await supabase.from('tv_ratings').update({ reason_tags: tags }).eq('id', ratingId)
  if (error) throw error
}

export async function saveTvReviewText(ratingId: string, text: string): Promise<void> {
  const trimmed = text.trim()
  const { error } = await supabase
    .from('tv_ratings')
    .update({ review_text: trimmed || null })
    .eq('id', ratingId)
  if (error) throw error
}
