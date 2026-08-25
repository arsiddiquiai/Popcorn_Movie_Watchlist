import { supabase } from './supabaseClient'
import { addToWatchlist } from './watchlist'

/** sessionStorage rather than a URL param carried through the whole auth
 *  flow — survives navigating around before signing up, cleared when the
 *  tab closes, and doesn't need every intermediate screen (Auth, the
 *  email-confirmation detour) to thread a query param through itself. */
const PENDING_SHARE_KEY = 'popcorn:pending-share-token'

export function setPendingShareToken(token: string): void {
  try {
    sessionStorage.setItem(PENDING_SHARE_KEY, token)
  } catch {
    // Private mode / quota — the import just doesn't happen post-signup in
    // that case, same fallback philosophy as this codebase's other
    // sessionStorage uses (decay-dismiss, subcopy-seen).
  }
}

function readPendingShareToken(): string | null {
  try {
    return sessionStorage.getItem(PENDING_SHARE_KEY)
  } catch {
    return null
  }
}

function clearPendingShareToken(): void {
  try {
    sessionStorage.removeItem(PENDING_SHARE_KEY)
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}

export interface SharedListMovie {
  tmdb_id: number
  title: string
  poster_path: string | null
  release_year: number | null
}

export interface SharedList {
  displayName: string | null
  movies: SharedListMovie[]
}

/** Returns the caller's own share link token, creating one on first call.
 *  Authenticated — reuses the same token on every subsequent call rather
 *  than minting a new one per share. */
export async function getOrCreateShareToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) throw new Error('Your session expired. Log in again.')

  const response = await fetch('/share', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Could not create a share link. Try again.')
  const body = (await response.json()) as { token?: string }
  if (!body.token) throw new Error('Could not create a share link. Try again.')
  return body.token
}

export function shareUrlFor(token: string): string {
  return `${window.location.origin}/w/${token}`
}

/** Public — no auth. Returns null for an invalid/expired token rather than
 *  throwing, so PublicShare.tsx can render its not-found state from a
 *  plain falsy check instead of a try/catch around every render path. */
export async function fetchSharedList(token: string): Promise<SharedList | null> {
  const response = await fetch(`/share?token=${encodeURIComponent(token)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Something went wrong loading this list.')
  const body = (await response.json()) as { display_name: string | null; movies: SharedListMovie[] }
  return { displayName: body.display_name, movies: body.movies }
}

/**
 * The signup-triggered import (DESIGN spec): every movie from a pending
 * shared list, added to the newly-signed-up user's own watchlist as
 * 'want'. Reuses addToWatchlist for every row — it already treats an
 * existing want/watched row as "leave it alone" and only a previously-
 * dropped row as "revive it", which is exactly "don't duplicate or
 * overwrite existing rows" for free, with no separate de-dup logic needed
 * here. Best-effort: one film failing to import (a stale tmdb_id, a
 * transient network blip) doesn't roll back the rest.
 */
export async function importPendingSharedList(newUserId: string): Promise<void> {
  const token = readPendingShareToken()
  if (!token) return
  clearPendingShareToken()

  try {
    const shared = await fetchSharedList(token)
    if (!shared) return
    await Promise.all(
      shared.movies.map((movie) =>
        addToWatchlist(movie.tmdb_id, newUserId).catch((err) => {
          console.error(`Failed to import tmdb_id ${movie.tmdb_id} from a shared list:`, err)
        }),
      ),
    )
  } catch (err) {
    console.error('Failed to import a pending shared list:', err)
  }
}
