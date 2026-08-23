import { supabase } from './supabaseClient'

/** Client for the `/ai` Netlify Function's `mode: "bridge"` (Cinema Bridge). */

export interface BridgeInput {
  source_tmdb_id: number
  target: string
}

export interface BridgeMatch {
  tmdb_id: number
  reason: string
}

export interface BridgeResult {
  source_tmdb_id: number
  target: string
  matches: BridgeMatch[]
  session_id: string | null
}

export interface BridgeNoMatches {
  kind: 'no_matches'
  message: string
}

export class BridgeError extends Error {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'BridgeError'
    this.retryable = retryable
  }
}

interface ErrorBody {
  error?: string
  code?: string
  problems?: string[]
}

function messageForError(status: number, body: ErrorBody): { message: string; retryable: boolean } {
  switch (body.code) {
    case 'unauthenticated':
      return { message: 'Your session expired. Log in again to try this.', retryable: false }
    case 'not_configured':
      return { message: "Cinema Bridge isn't set up on the server yet.", retryable: false }
    case 'invalid_input':
      return {
        message: body.problems?.[0] ?? 'Something about that request was off. Adjust and try again.',
        retryable: false,
      }
    case 'source_not_found':
      return { message: "Couldn't find that film on TMDB.", retryable: false }
    case 'unknown_target':
      return { message: body.error ?? "Couldn't work out that industry/language.", retryable: false }
    case 'rate_limited':
      return { message: 'Busy right now. Try again in a moment.', retryable: true }
    case 'upstream_timeout':
      return { message: 'That took too long. Try again.', retryable: true }
    default:
      return { message: body.error ?? `Something failed (${status}). Try again.`, retryable: status >= 500 }
  }
}

export async function requestBridge(
  input: BridgeInput,
  signal?: AbortSignal,
): Promise<BridgeResult | BridgeNoMatches> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new BridgeError('Your session expired. Log in again to try this.', false)

  let response: Response
  try {
    response = await fetch('/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'bridge', ...input }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new BridgeError("Couldn't reach the server. Check your connection and try again.")
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new BridgeError('Got back something unreadable. Try again.')
  }

  if (!response.ok) {
    const { message, retryable } = messageForError(response.status, body as ErrorBody)
    throw new BridgeError(message, retryable)
  }

  const asError = body as ErrorBody
  if (asError.code === 'no_matches') {
    return { kind: 'no_matches', message: asError.error ?? "Couldn't find a good match." }
  }

  const result = body as BridgeResult
  if (!Array.isArray(result?.matches)) {
    throw new BridgeError('Got back an unexpected result. Try again.')
  }
  return result
}
