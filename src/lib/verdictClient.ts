import { supabase } from './supabaseClient'

/** Client for the `/ai` function's `mode: "verdict"` — the share card's
 *  cached one-line list description. Failure here should never block
 *  generating a share card (the verdict line is decorative), so callers are
 *  expected to catch VerdictError and proceed without it rather than
 *  surface it as a blocking error — see ShareWatchlistCard.tsx. */

export interface VerdictResult {
  verdict_text: string
  cached: boolean
}

export class VerdictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VerdictError'
  }
}

export async function requestVerdict(signal?: AbortSignal): Promise<VerdictResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new VerdictError('Your session expired.')

  let response: Response
  try {
    response = await fetch('/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'verdict' }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new VerdictError("Couldn't reach the server.")
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new VerdictError('Got back something unreadable.')
  }

  if (!response.ok) {
    throw new VerdictError((body as { error?: string })?.error ?? `Verdict generation failed (${response.status}).`)
  }

  const result = body as VerdictResult
  if (typeof result?.verdict_text !== 'string') throw new VerdictError('Got back an unexpected result.')
  return result
}
