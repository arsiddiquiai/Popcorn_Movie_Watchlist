import type { AiProvider } from './database.types'
import { supabase } from './supabaseClient'

export class ByokError extends Error {}

async function authedFetch(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ByokError('You need to be signed in.')

  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ByokError("Couldn't reach the server. Check your connection and try again.")
  }

  let json: { ok?: boolean; error?: string; problems?: string[] } = {}
  try {
    json = (await response.json()) as typeof json
  } catch {
    throw new ByokError('Got back something unreadable. Try again.')
  }
  if (!response.ok || !json.ok) {
    throw new ByokError(json.problems?.[0] ?? json.error ?? 'Something went wrong. Try again.')
  }
  return json
}

/** Saves (replacing any existing) BYOK key. The key itself is never
 *  returned by the server — there is no read path for it at all. */
export async function saveApiKey(provider: AiProvider, apiKey: string, modelPref: string | null): Promise<void> {
  await authedFetch('/user-api-key', { action: 'save', provider, api_key: apiKey, model_pref: modelPref })
}

export async function deleteApiKey(): Promise<void> {
  await authedFetch('/user-api-key', { action: 'delete' })
}

export interface SavedKeyMeta {
  provider: AiProvider
  model_pref: string | null
  created_at: string
}

/** Ordinary RLS-scoped read straight from Supabase — no serverless function
 *  needed, since this is metadata only. encrypted_key is not a granted
 *  column for `authenticated` at the Postgres level (migration
 *  20260825093000), so there is no query shape that could return it here. */
export async function getSavedKeyMeta(): Promise<SavedKeyMeta | null> {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('provider, model_pref, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new ByokError("Couldn't check your saved key.")
  return data
}
