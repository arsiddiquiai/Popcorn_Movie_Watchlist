import { supabase } from './supabaseClient'

/** Client for the `/ai` Netlify Function's `mode: "taste"` (Taste DNA). */

export interface GenreCount {
  genre: string
  count: number
}

export interface DecadeCount {
  decade: string
  count: number
}

export interface BlindSpot {
  genre: string
  tmdb_id: number
  title: string
  reason: string
}

export interface TasteResult {
  cold_start: boolean
  total_rated: number
  personality_label: string | null
  personality_description: string | null
  genre_breakdown: GenreCount[]
  decade_breakdown: DecadeCount[]
  avg_runtime_minutes: number | null
  blind_spots: BlindSpot[]
  session_id: string | null
}

export class TasteError extends Error {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'TasteError'
    this.retryable = retryable
  }
}

interface ErrorBody {
  error?: string
  code?: string
}

function messageForError(status: number, body: ErrorBody): { message: string; retryable: boolean } {
  switch (body.code) {
    case 'unauthenticated':
      return { message: 'Your session expired. Log in again.', retryable: false }
    case 'not_configured':
      return { message: "Taste DNA isn't set up on the server yet.", retryable: false }
    case 'rate_limited':
      return { message: 'Busy right now. Try again in a moment.', retryable: true }
    case 'upstream_timeout':
      return { message: 'That took too long. Try again.', retryable: true }
    default:
      return { message: body.error ?? `Something failed (${status}). Try again.`, retryable: status >= 500 }
  }
}

export async function requestTaste(signal?: AbortSignal): Promise<TasteResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new TasteError('Your session expired. Log in again.', false)

  let response: Response
  try {
    response = await fetch('/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'taste' }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new TasteError("Couldn't reach the server. Check your connection and try again.")
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new TasteError('Got back something unreadable. Try again.')
  }

  if (!response.ok) {
    const { message, retryable } = messageForError(response.status, body as ErrorBody)
    throw new TasteError(message, retryable)
  }

  const result = body as TasteResult
  if (typeof result?.cold_start !== 'boolean' || !Array.isArray(result?.genre_breakdown)) {
    throw new TasteError('Got back an unexpected result. Try again.')
  }
  return result
}
