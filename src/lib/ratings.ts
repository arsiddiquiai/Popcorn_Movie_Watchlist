import type { Rating } from './database.types'
import { supabase } from './supabaseClient'

/** The "why" chips offered after a score is saved (CLAUDE.md). */
export const REASON_TAGS = ['Story', 'Visuals', 'Performance', 'Mood', 'Pacing'] as const

export async function getRating(userId: string, tmdbId: number): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId)
    .eq('tmdb_id', tmdbId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Saves a score, upserting on the (user_id, tmdb_id) unique constraint so
 * re-rating a movie updates in place. reason_tags is deliberately left out
 * of the payload: PostgREST only writes the columns it's given, so an
 * existing row's tags survive a score change.
 */
export async function saveScore(userId: string, tmdbId: number, score: number): Promise<Rating> {
  const { data, error } = await supabase
    .from('ratings')
    .upsert({ user_id: userId, tmdb_id: tmdbId, score }, { onConflict: 'user_id,tmdb_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveReasonTags(ratingId: string, tags: string[]): Promise<void> {
  const { error } = await supabase.from('ratings').update({ reason_tags: tags }).eq('id', ratingId)
  if (error) throw error
}

/** Optional free-text note on a rating (Prompt 6's ratings.review_text
 *  column, never wired up until now). Empty string is stored as null rather
 *  than "", so an emptied-out note reads the same as one never written. */
export async function saveReviewText(ratingId: string, text: string): Promise<void> {
  const trimmed = text.trim()
  const { error } = await supabase
    .from('ratings')
    .update({ review_text: trimmed || null })
    .eq('id', ratingId)
  if (error) throw error
}
