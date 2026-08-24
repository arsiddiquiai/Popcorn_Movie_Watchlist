/**
 * BYOK save/delete endpoint.
 *
 * Runs server-side for one reason that has nothing to do with RLS: the key
 * must be AES-256-GCM encrypted (server/crypto.ts) before it ever touches the
 * database, using a server secret (BYOK_ENCRYPTION_KEY) the browser must
 * never see. The insert/delete themselves are otherwise ordinary
 * JWT-scoped operations that RLS alone would already permit.
 *
 * There is no GET here — reading saved-key METADATA (which provider, when)
 * goes straight from the client to Supabase via its own SELECT policy
 * (migration 20260825093000), since that's an ordinary RLS-scoped read with
 * nothing secret in it. The actual ciphertext (encrypted_key) is a
 * different story: it is not a granted column for authenticated at all, at
 * the Postgres column-privilege level, so no query — from this endpoint or
 * anywhere else under the anon key — can ever return it. The only server
 * code that reads it back is server/byok.ts, at the moment a
 * Claude/OpenAI/Gemini call actually needs it, via the service-role client.
 *
 * "Replace" is delete-then-insert, not update: user_api_keys has no update
 * policy or grant either (same write-only posture), and the unique
 * (user_id, provider) constraint means a naive insert-over-existing would
 * just fail. The client always sends the FULL desired state (provider + key
 * + model_pref); this endpoint clears any existing row for that user (all
 * providers — see design note below) and inserts the new one in one request.
 *
 * DESIGN DECISION, flagged rather than left implicit: the brief describes a
 * single "provider selector alongside the key field" in Settings, which
 * reads as one active BYOK configuration at a time, not multiple
 * simultaneously-saved provider keys with no way to pick among them. So
 * "save" here deletes ALL of the user's existing rows (any provider) before
 * inserting the new one, keeping user_api_keys at 0 or 1 rows per user by
 * construction. loadUserProviderPreference's defensive multi-row handling
 * exists in case that invariant is ever revisited, not because this
 * endpoint intends to allow it.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { AiProvider, Database } from '../src/lib/database.types.ts'
import { encryptSecret } from '../server/crypto.ts'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

const PROVIDERS: AiProvider[] = ['anthropic', 'openai', 'gemini']
const KEY_MAX_CHARS = 400
const MODEL_PREF_MAX_CHARS = 100

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

type AuthedClientResult =
  | { ok: false; error: Response }
  | { ok: true; supabase: SupabaseClient<Database>; userId: string }

async function getAuthedClient(req: Request): Promise<AuthedClientResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, error: json({ error: 'Not configured.', code: 'not_configured' }, 503) }
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return { ok: false, error: json({ error: 'Missing Authorization header.', code: 'unauthenticated' }, 401) }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  })
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { ok: false, error: json({ error: 'Invalid or expired session.', code: 'unauthenticated' }, 401) }
  }

  return { ok: true, supabase, userId: data.user.id }
}

export async function POST(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed. Use POST.' }, 405)

  const auth = await getAuthedClient(req)
  if (!auth.ok) return auth.error
  const { supabase, userId } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body must be valid JSON.', code: 'invalid_json' }, 400)
  }
  const { action } = (body ?? {}) as { action?: unknown }

  if (action === 'delete') {
    const { error } = await supabase.from('user_api_keys').delete().eq('user_id', userId)
    if (error) {
      console.error('user_api_keys delete failed:', error.message)
      return json({ error: "Couldn't remove your key. Try again.", code: 'delete_failed' }, 500)
    }
    return json({ ok: true })
  }

  if (action !== 'save') {
    return json({ error: 'action must be "save" or "delete".', code: 'invalid_input' }, 400)
  }

  const { provider, api_key: apiKey, model_pref: modelPrefRaw } = body as Record<string, unknown>
  const problems: string[] = []

  if (typeof provider !== 'string' || !PROVIDERS.includes(provider as AiProvider)) {
    problems.push(`provider must be one of: ${PROVIDERS.join(', ')}.`)
  }
  const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : ''
  if (!trimmedKey) problems.push('api_key is required and must be a non-empty string.')
  else if (trimmedKey.length > KEY_MAX_CHARS) problems.push(`api_key must be ${KEY_MAX_CHARS} characters or fewer.`)

  let modelPref: string | null = null
  if (modelPrefRaw !== undefined && modelPrefRaw !== null && modelPrefRaw !== '') {
    if (typeof modelPrefRaw !== 'string') problems.push('model_pref must be a string if provided.')
    else if (modelPrefRaw.length > MODEL_PREF_MAX_CHARS) problems.push(`model_pref must be ${MODEL_PREF_MAX_CHARS} characters or fewer.`)
    else modelPref = modelPrefRaw.trim() || null
  }

  if (problems.length > 0) return json({ error: 'Invalid request body.', code: 'invalid_input', problems }, 400)

  // Delete-then-insert, not upsert: see the file-level note on why this
  // table has no update policy, and why "save" always clears prior rows.
  const { error: delError } = await supabase.from('user_api_keys').delete().eq('user_id', userId)
  if (delError) {
    console.error('user_api_keys pre-save delete failed:', delError.message)
    return json({ error: "Couldn't save your key. Try again.", code: 'save_failed' }, 500)
  }

  const { error: insError } = await supabase.from('user_api_keys').insert({
    user_id: userId,
    provider: provider as AiProvider,
    encrypted_key: encryptSecret(trimmedKey),
    model_pref: modelPref,
  })
  if (insError) {
    console.error('user_api_keys insert failed:', insError.message)
    return json({ error: "Couldn't save your key. Try again.", code: 'save_failed' }, 500)
  }

  return json({ ok: true, provider, model_pref: modelPref })
}
