import { supabase } from './supabaseClient'

/**
 * Client for the `/ai` Netlify Function's `mode: "pick"`.
 *
 * The response shape here mirrors `netlify/functions/ai.ts` exactly. Two
 * things worth knowing, because they differ from the original spec:
 *
 * - There is no `source` field. `tier` carries it: 1 = the movie came from
 *   the user's own watchlist, 2 = from the wider TMDB catalogue. Alternates
 *   carry no source at all, so the screen resolves watchlist membership
 *   per-movie against Supabase instead of trusting the tier for them (it
 *   needs the watchlist_items row id for "Mark as Watched" regardless).
 * - The response only carries tmdb_ids, not movie metadata. Posters, titles,
 *   runtimes etc. are fetched separately via getOrCacheMovie().
 */

export type PickCompany = 'alone' | 'partner' | 'friends' | 'family'

export interface PickInput {
  mood_text: string
  energy_level: number
  minutes_available: number
  company: PickCompany
}

export interface PickAlternate {
  tmdb_id: number
  reason: string
}

export interface PickResult {
  tier: 1 | 2
  tmdb_id: number
  reason: string
  alternates: PickAlternate[]
  cold_start: boolean
  /** Null if the ai_sessions insert failed server-side (non-fatal there). */
  session_id: string | null
}

/** The function's honest "nothing fits" response — a 200, not an error. */
export interface PickNoCandidates {
  kind: 'no_candidates'
  message: string
}

export class PickError extends Error {
  /** True when retrying the same request could plausibly work. */
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'PickError'
    this.retryable = retryable
  }
}

interface ErrorBody {
  error?: string
  code?: string
  problems?: string[]
}

/**
 * Maps the function's error codes onto copy a person can act on. The raw
 * server strings are already user-facing, but a few cases (auth, config)
 * read better with app-specific wording.
 */
function messageForError(status: number, body: ErrorBody): { message: string; retryable: boolean } {
  switch (body.code) {
    case 'unauthenticated':
      return { message: 'Your session expired. Log in again to get a pick.', retryable: false }
    case 'not_configured':
      return { message: "The recommender isn't set up on the server yet.", retryable: false }
    case 'invalid_input':
      return {
        message: body.problems?.[0] ?? 'Something about that request was off. Adjust and try again.',
        retryable: false,
      }
    case 'rate_limited':
      return { message: 'The recommender is busy right now. Try again in a moment.', retryable: true }
    case 'upstream_timeout':
      return { message: 'That took too long. Try again.', retryable: true }
    default:
      return {
        message: body.error ?? `The recommender failed (${status}). Try again.`,
        retryable: status >= 500,
      }
  }
}

export async function requestPick(
  input: PickInput,
  signal?: AbortSignal,
): Promise<PickResult | PickNoCandidates> {
  // Read the token at call time rather than from React state: supabase-js
  // refreshes it in the background, and a token captured at render could
  // already be stale by the time the user submits.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    throw new PickError('Your session expired. Log in again to get a pick.', false)
  }

  let response: Response
  try {
    response = await fetch('/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'pick', ...input }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new PickError("Couldn't reach the recommender. Check your connection and try again.")
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new PickError('The recommender sent back something unreadable. Try again.')
  }

  if (!response.ok) {
    const { message, retryable } = messageForError(response.status, body as ErrorBody)
    throw new PickError(message, retryable)
  }

  // A 200 carrying `code: 'no_candidates'` is the function's honest
  // "nothing fits" answer, not a failure.
  const asError = body as ErrorBody
  if (asError.code === 'no_candidates') {
    return {
      kind: 'no_candidates',
      message: asError.error ?? "Couldn't find anything that fits right now.",
    }
  }

  const result = body as PickResult
  if (typeof result?.tmdb_id !== 'number' || typeof result?.reason !== 'string') {
    throw new PickError('The recommender sent back an unexpected result. Try again.')
  }

  return {
    tier: result.tier === 2 ? 2 : 1,
    tmdb_id: result.tmdb_id,
    reason: result.reason,
    alternates: Array.isArray(result.alternates) ? result.alternates.slice(0, 2) : [],
    cold_start: Boolean(result.cold_start),
    session_id: result.session_id ?? null,
  }
}

/**
 * Records whether the user acted on a pick. `true` when they add it or mark
 * it watched, `false` when they reject every option offered. Never throws —
 * a failed analytics write must not break the user's actual action.
 */
export async function setSessionAccepted(sessionId: string | null, accepted: boolean): Promise<void> {
  if (!sessionId) return
  const { error } = await supabase.from('ai_sessions').update({ accepted }).eq('id', sessionId)
  if (error) console.error('Failed to record pick outcome:', error.message)
}
