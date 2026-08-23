import { supabase } from './supabaseClient'

/** Client for the `/ai` Netlify Function's `mode: "assistant"` (AI Movie Assistant). */

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantResult {
  reply: string
  added_tmdb_id: number | null
  tool_calls_used: number
  session_id: string | null
}

export class AssistantError extends Error {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'AssistantError'
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
      return { message: "The assistant isn't set up on the server yet.", retryable: false }
    case 'invalid_input':
      return { message: body.error ?? 'Something about that message was off.', retryable: false }
    case 'rate_limited':
      return { message: 'Busy right now. Try again in a moment.', retryable: true }
    case 'upstream_timeout':
      return { message: 'That took too long. Try again.', retryable: true }
    default:
      return { message: body.error ?? `Something failed (${status}). Try again.`, retryable: status >= 500 }
  }
}

/** The daily-cap response is a normal 200 with a code, not an error — it's
 *  an honest "no capacity left today" answer, same pattern as pick's
 *  no_candidates and bridge's no_matches. */
export interface AssistantCapped {
  kind: 'capped'
  message: string
}

export async function sendAssistantMessage(
  message: string,
  history: AssistantMessage[],
  signal?: AbortSignal,
): Promise<AssistantResult | AssistantCapped> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new AssistantError('Your session expired. Log in again.', false)

  let response: Response
  try {
    response = await fetch('/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'assistant', message, history }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new AssistantError("Couldn't reach the server. Check your connection and try again.")
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new AssistantError('Got back something unreadable. Try again.')
  }

  if (!response.ok) {
    const { message: msg, retryable } = messageForError(response.status, body as ErrorBody)
    throw new AssistantError(msg, retryable)
  }

  const asError = body as ErrorBody
  if (asError.code === 'usage_cap_reached') {
    return { kind: 'capped', message: asError.error ?? "You've reached today's message limit." }
  }

  const result = body as AssistantResult
  if (typeof result?.reply !== 'string') {
    throw new AssistantError('Got back an unexpected result. Try again.')
  }
  return result
}
