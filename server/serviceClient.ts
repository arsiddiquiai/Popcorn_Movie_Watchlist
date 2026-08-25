/**
 * Service-role Supabase client — bypasses RLS entirely. Used for exactly
 * three things in this codebase, all structurally impossible under the
 * anon key by design:
 *
 *   1. Reading a stored BYOK key to decrypt and use it (server/byok.ts).
 *      user_api_keys grants authenticated a SELECT policy for METADATA only
 *      (id/provider/model_pref/created_at, for the Settings "key saved"
 *      indicator) — encrypted_key is never a granted column, at the
 *      Postgres column-privilege level, for anyone but the service role.
 *      "Never expose the key to the client" means the browser can never
 *      read it back via its own JWT no matter what it selects, so the one
 *      legitimate server-side read of the actual ciphertext has to go
 *      around RLS/grants entirely.
 *   2. Deleting an auth.users row on account deletion (api/delete-account.ts)
 *      — only the admin API can do this; no RLS policy can grant a user
 *      their own account deletion.
 *   3. Serving the public /w/{token} share page (api/share.ts's GET) — the
 *      visitor is anonymous (no session at all, so no auth.uid() for any
 *      RLS policy to match), but the response needs the sharer's current
 *      display name and want-list, which are that OTHER user's rows. The
 *      token->user_id lookup and the display name (via
 *      auth.admin.getUserById, not a possibly-unsynced profiles row) both
 *      stay server-side; only display name + poster list ever reach the
 *      client, never the token's user_id itself.
 *
 * Never used for anything a JWT-scoped client can already do — every other
 * query in this codebase stays scoped to the caller's own JWT so RLS keeps
 * doing its job.
 */
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { Database } from '../src/lib/database.types.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let cached: ReturnType<typeof createClient<Database>> | null = null

export function getServiceClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.')
  }
  if (!cached) {
    cached = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    })
  }
  return cached
}
