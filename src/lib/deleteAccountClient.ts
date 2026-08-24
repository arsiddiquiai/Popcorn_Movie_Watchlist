import { supabase } from './supabaseClient'

export class DeleteAccountError extends Error {}

/**
 * Runs the server-side deletion, then signs out locally. Does NOT redirect —
 * the caller (Settings) owns navigation, since it's the one that knows where
 * the confirmation screen lives.
 */
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new DeleteAccountError('You need to be signed in.')

  let response: Response
  try {
    response = await fetch('/delete-account', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })
  } catch {
    throw new DeleteAccountError("Couldn't reach the server. Check your connection and try again.")
  }

  let json: { ok?: boolean; error?: string } = {}
  try {
    json = (await response.json()) as typeof json
  } catch {
    throw new DeleteAccountError('Got back something unreadable. Try again.')
  }

  if (!response.ok || !json.ok) {
    throw new DeleteAccountError(json.error ?? "Couldn't delete your account. Try again.")
  }

  // The account (and its JWT's backing row) no longer exists server-side;
  // this just clears the locally-cached session so the app's own state
  // reflects that immediately rather than waiting for the next failed call.
  await supabase.auth.signOut()
}
