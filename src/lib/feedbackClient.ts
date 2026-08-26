import { supabase } from './supabaseClient'

export class FeedbackError extends Error {}

/**
 * Submits feedback through the serverless function rather than inserting
 * directly, because the notification email has to fire in the same request
 * (and the Resend key is server-side only). The feedback table has no select
 * policy, so nothing is ever read back.
 */
export async function submitFeedback(
  message: string,
  contactEmail: string | null,
  signal?: AbortSignal,
): Promise<{ notified: boolean }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new FeedbackError('You need to be signed in to send feedback.')

  let response: Response
  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, contact_email: contactEmail }),
      signal,
    })
  } catch {
    throw new FeedbackError("Couldn't reach the server. Check your connection and try again.")
  }

  let body: { ok?: boolean; notified?: boolean; error?: string; problems?: string[] } = {}
  try {
    body = (await response.json()) as typeof body
  } catch {
    throw new FeedbackError('Got back something unreadable. Try again.')
  }

  if (!response.ok || !body.ok) {
    throw new FeedbackError(body.problems?.[0] ?? body.error ?? "Couldn't send your feedback. Try again.")
  }

  return { notified: Boolean(body.notified) }
}
