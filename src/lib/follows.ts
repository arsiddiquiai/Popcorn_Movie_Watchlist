import { supabase } from './supabaseClient'
import { fetchSharedList, type SharedList } from './shareLink'
import type { Follow } from './database.types'

/**
 * Social feed / following — v1 scope agreed before building: visibility is
 * limited to exactly what a person has already made public via their own
 * share link. Following someone IS saving the /w/{token} link they chose
 * to share; the feed re-displays the same live want-list api/share.ts's
 * public GET already returns. No new server code, no new privacy surface —
 * see the migration's own doc comment for the full reasoning.
 */

export class FollowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FollowError'
  }
}

/** Accepts either a bare token or a full https://…/w/{token} URL someone
 *  pasted in — people copy the whole link, not just the token. */
export function extractShareToken(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/\/w\/([^/?#\s]+)/)
  if (match) return match[1]
  // No "/w/" segment — treat the whole trimmed input as a bare token,
  // since that's still a valid thing to paste (e.g. from a QR code
  // decoder that only captured the path segment).
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
}

/** Validates the token actually resolves (via the same public endpoint the
 *  /w/{token} page itself uses) before saving a follow — rejects a
 *  mistyped or already-dead link immediately instead of silently saving
 *  something that will just show "this link isn't around any more" in the
 *  feed forever. */
export async function addFollow(userId: string, rawInput: string): Promise<void> {
  const token = extractShareToken(rawInput)
  if (!token) throw new FollowError("That doesn't look like a Popcorn share link.")

  const shared = await fetchSharedList(token).catch(() => {
    throw new FollowError("Couldn't check that link right now. Try again.")
  })
  if (!shared) throw new FollowError("That link isn't around any more.")

  const { error } = await supabase.from('follows').insert({ follower_user_id: userId, share_token: token })
  if (error) {
    if (error.code === '23505') throw new FollowError("You're already following this list.")
    throw new FollowError("Couldn't follow that list. Try again.")
  }
}

export async function removeFollow(followId: string): Promise<void> {
  const { error } = await supabase.from('follows').delete().eq('id', followId)
  if (error) throw new FollowError("Couldn't unfollow. Try again.")
}

export async function listFollows(userId: string): Promise<Follow[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new FollowError("Couldn't load your feed.")
  return data
}

export interface FeedEntry {
  follow: Follow
  /** null when the token no longer resolves (the person deleted their
   *  account, or — extremely unlikely, since tokens aren't reused — the
   *  link otherwise went stale). The feed screen shows this as a
   *  "this list is no longer available" row with an unfollow action,
   *  never a silent gap or a thrown error. */
  list: SharedList | null
}

/** One fetchSharedList call per followed row — the exact same request the
 *  public /w/{token} page makes, run once per person you follow. No batch
 *  endpoint exists (or is needed) since the follow list is expected to
 *  stay small for a v1 social feature. */
export async function fetchFeed(userId: string): Promise<FeedEntry[]> {
  const follows = await listFollows(userId)
  return Promise.all(
    follows.map(async (follow) => {
      try {
        const list = await fetchSharedList(follow.share_token)
        return { follow, list }
      } catch {
        return { follow, list: null }
      }
    }),
  )
}
