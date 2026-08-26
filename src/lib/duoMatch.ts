import { getTrendingMovies } from './tmdbClient'
import { supabase } from './supabaseClient'
import type { DuoSession, DuoVote, Json } from './database.types'

/** One entry in a session's fixed candidate deck — a snapshot taken once
 *  at session creation (see the migration's own doc comment on why: TMDB's
 *  trending list shifts day to day, and both participants need to see the
 *  exact same deck regardless of when each of them opens it). */
export interface DuoCandidate {
  tmdb_id: number
  title: string
  poster_path: string | null
  release_year: number | null
}

const CANDIDATE_COUNT = 20

/** Builds a session's candidate deck from TMDB's trending list — no mood/
 *  genre input for v1 (Duo Match has no equivalent of Pick For Me's mood
 *  form), just "here's what's popular right now, swipe through it
 *  together." Filtered to posters that actually exist, since a poster-less
 *  card has nothing to swipe on. */
async function buildCandidateDeck(): Promise<DuoCandidate[]> {
  const trending = await getTrendingMovies()
  return trending
    .filter((movie) => movie.poster_path)
    .slice(0, CANDIDATE_COUNT)
    .map((movie) => ({
      tmdb_id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    }))
}

export class DuoMatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DuoMatchError'
  }
}

/**
 * Creates a new Duo Match session. Fully client-side apart from the plain
 * RLS-scoped insert — no server endpoint needed here at all, since
 * host_user_id = auth.uid() satisfies the insert policy directly, and the
 * candidate deck comes from TMDB the same way Search's own trending row
 * already does (CLAUDE.md: "TMDB (client-side)").
 *
 * The invite token is generated with crypto.randomUUID() — a browser
 * built-in, cryptographically random, no server round-trip required just
 * to mint one (unlike share_links' token, which is minted server-side
 * mainly because that endpoint already had to be a server call for other
 * reasons; this one doesn't).
 */
export async function createDuoSession(hostUserId: string): Promise<{ sessionId: string; inviteToken: string }> {
  const candidates = await buildCandidateDeck()
  if (candidates.length === 0) {
    throw new DuoMatchError("Couldn't load films to swipe on right now. Try again in a moment.")
  }

  const inviteToken = crypto.randomUUID()
  const { data, error } = await supabase
    .from('duo_sessions')
    // DuoCandidate[] is a plain JSON-serializable shape at runtime; it just
    // isn't structurally assignable to the generic Json index-signature
    // type without this cast — same situation as movies_cache's `credits`
    // column in getOrCacheMovie().
    .insert({ invite_token: inviteToken, host_user_id: hostUserId, candidates: candidates as unknown as Json })
    .select('id')
    .single()
  if (error) throw new DuoMatchError("Couldn't start a Duo Match. Try again.")

  return { sessionId: data.id, inviteToken }
}

export function duoInviteUrlFor(token: string): string {
  return `${window.location.origin}/duo/${token}`
}

/** Attaches the caller as the guest on a session, via the one server
 *  endpoint this feature needs (see api/duo-join.ts's own doc comment for
 *  why). Throws DuoMatchError with a message safe to show directly. */
export async function joinDuoSession(inviteToken: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) throw new DuoMatchError('Your session expired. Log in again.')

  const response = await fetch('/duo-join', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ token: inviteToken }),
  })
  let body: { session_id?: string; error?: string }
  try {
    body = await response.json()
  } catch {
    throw new DuoMatchError('Something went wrong. Try again.')
  }
  if (!response.ok || !body.session_id) {
    throw new DuoMatchError(body.error ?? 'Could not join this Duo Match.')
  }
  return body.session_id
}

export async function fetchDuoSession(sessionId: string): Promise<DuoSession> {
  const { data, error } = await supabase.from('duo_sessions').select('*').eq('id', sessionId).single()
  if (error) throw new DuoMatchError("Couldn't load this Duo Match.")
  return data
}

/** Every vote either participant has cast — RLS scopes this to sessions
 *  the caller actually belongs to, but within one session it deliberately
 *  returns BOTH people's votes (not just the caller's own), since
 *  computing a match requires seeing the partner's side too. */
export async function fetchDuoVotes(sessionId: string): Promise<DuoVote[]> {
  const { data, error } = await supabase.from('duo_votes').select('*').eq('session_id', sessionId)
  if (error) throw new DuoMatchError("Couldn't load votes for this Duo Match.")
  return data
}

export async function castDuoVote(sessionId: string, userId: string, tmdbId: number, liked: boolean): Promise<void> {
  const { error } = await supabase.from('duo_votes').insert({ session_id: sessionId, user_id: userId, tmdb_id: tmdbId, liked })
  // A unique-violation (23505) means this exact vote already exists —
  // treat re-tapping the same card as a no-op rather than an error; the
  // vote itself is final once cast (no update policy, per the migration).
  if (error && error.code !== '23505') throw new DuoMatchError("Couldn't save your vote.")
}

/** A match: a tmdb_id where BOTH the host and the guest voted liked=true.
 *  Pure function — no Supabase/DOM — same shape as tasteBadge.ts. */
export function computeDuoMatches(session: DuoSession, votes: DuoVote[]): number[] {
  if (!session.guest_user_id) return []
  const likedBy = new Map<number, Set<string>>()
  for (const vote of votes) {
    if (!vote.liked) continue
    const voters = likedBy.get(vote.tmdb_id) ?? new Set<string>()
    voters.add(vote.user_id)
    likedBy.set(vote.tmdb_id, voters)
  }
  return [...likedBy.entries()]
    .filter(([, voters]) => voters.has(session.host_user_id) && voters.has(session.guest_user_id as string))
    .map(([tmdbId]) => tmdbId)
}

// ---------------------------------------------------------------------------
// Pending-join across signup — same pattern as shareLink.ts's pending-share
// token, since an invite recipient who isn't signed in yet has to finish
// auth before the join (an authenticated JWT) can happen at all.
// ---------------------------------------------------------------------------

const PENDING_DUO_JOIN_KEY = 'popcorn:pending-duo-join'

export function setPendingDuoJoinToken(token: string): void {
  try {
    sessionStorage.setItem(PENDING_DUO_JOIN_KEY, token)
  } catch {
    // Private mode / quota — the auto-join just doesn't happen post-signup
    // in that case; the invite link itself still works if visited again.
  }
}

function readPendingDuoJoinToken(): string | null {
  try {
    return sessionStorage.getItem(PENDING_DUO_JOIN_KEY)
  } catch {
    return null
  }
}

function clearPendingDuoJoinToken(): void {
  try {
    sessionStorage.removeItem(PENDING_DUO_JOIN_KEY)
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}

/**
 * AuthProvider (where this is called from, mirroring importPendingSharedList)
 * sits OUTSIDE the router in App.tsx, so it has no useNavigate() to send
 * the guest to their new session screen once the join finishes. This
 * stashes the result for ProtectedLayout — which every authenticated route
 * mounts inside the router — to pick up on its next render and redirect,
 * then clear. Same sessionStorage-relay shape as the pending-token itself,
 * just carrying the join's result across the same component boundary.
 */
const JUST_JOINED_SESSION_KEY = 'popcorn:duo-just-joined-session'

function setJustJoinedDuoSession(sessionId: string): void {
  try {
    sessionStorage.setItem(JUST_JOINED_SESSION_KEY, sessionId)
  } catch {
    // The join itself already succeeded server-side at this point — a
    // failure here only costs the automatic redirect, not the join. The
    // guest can still navigate to the session from wherever it's listed.
  }
}

/** Read once, by ProtectedLayout, and cleared immediately — this is a
 *  one-shot relay, not a persistent "current session" pointer. */
export function readAndClearJustJoinedDuoSession(): string | null {
  try {
    const id = sessionStorage.getItem(JUST_JOINED_SESSION_KEY)
    if (id) sessionStorage.removeItem(JUST_JOINED_SESSION_KEY)
    return id
  } catch {
    return null
  }
}

/** Called from AuthProvider's SIGNED_IN handler, exactly like
 *  importPendingSharedList — a no-op whenever there's no pending token,
 *  which is the normal case for every sign-in that isn't completing a Duo
 *  Match invite. */
export async function completePendingDuoJoin(): Promise<void> {
  const token = readPendingDuoJoinToken()
  if (!token) return
  clearPendingDuoJoinToken()
  try {
    const sessionId = await joinDuoSession(token)
    setJustJoinedDuoSession(sessionId)
  } catch (err) {
    console.error('Failed to complete a pending Duo Match join:', err)
  }
}
