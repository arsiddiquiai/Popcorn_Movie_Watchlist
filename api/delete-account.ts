/**
 * Self-service account deletion.
 *
 * Identity is verified through the caller's own JWT exactly like every other
 * endpoint in this codebase — the account deleted is always "whoever this
 * token belongs to," never an id read from the request body. The deletion
 * work itself needs the service-role client (server/serviceClient.ts),
 * because two of the required steps are structurally impossible under RLS
 * no matter who's asking: deleting the auth.users row (only the admin API
 * can do that), and anonymizing feedback / deleting profiles, neither of
 * which has a delete/update policy for the anon key by design.
 *
 * ORDERING AND THE "no broken half-deleted state" SAFEGUARD, spelled out
 * because it's the one thing in this file that most needs to be right:
 *
 * Every user-owned table already has `references auth.users (id) on delete
 * cascade` on its user_id column EXCEPT feedback, which uses
 * `on delete set null` on purpose (an anonymised feedback row is still
 * useful; a vanished one isn't). That means a single admin.deleteUser() call
 * would, on its own, atomically cascade-delete profiles / watchlist_items /
 * ratings / ai_sessions / user_api_keys and null out feedback.user_id — in
 * one Postgres transaction that cannot partially apply.
 *
 * This endpoint does NOT rely on that alone. It deletes each table
 * EXPLICITLY, in order, checking every result — partly because the brief
 * asks for it in that shape, and partly because failing fast on an
 * individual table (before touching auth.users at all) gives a strictly
 * safer failure mode than deleting auth.users first and hoping cascade
 * definitions never drift: if step 3 fails, steps 1-2's deletions already
 * committed are real, but the account is still fully logged-in and
 * functional — nothing about auth is touched yet, so the failure is exactly
 * "some data gone, retry the deletion" rather than "corrupted account."
 * auth.users is deleted LAST, and only once every prior step reports
 * success — and that deletion cascades as the final backstop for anything
 * a manual step above might have missed.
 *
 * If auth.users deletion itself fails (the one step this endpoint cannot
 * retry-and-recover from within the same request), the account is left
 * signed-in with all of its DATA already gone — never signed-out with
 * orphaned data. That is the safer of the two possible partial-failure
 * states: the user can immediately request deletion again to finish the
 * job, rather than being locked out of an account that still holds their
 * information.
 */
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { Database } from '../src/lib/database.types.ts'
import { getServiceClient } from '../server/serviceClient.ts'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export async function POST(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed. Use POST.' }, 405)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase environment variables are not set.')
    return json({ error: 'Not configured on the server.', code: 'not_configured' }, 503)
  }

  // Identity from the caller's own JWT — never from the request body.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Missing Authorization header.', code: 'unauthenticated' }, 401)

  const authed = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  })
  const { data: userData, error: userError } = await authed.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Invalid or expired session.', code: 'unauthenticated' }, 401)
  const userId = userData.user.id

  let service
  try {
    service = getServiceClient()
  } catch (err) {
    console.error('delete-account: service client unavailable:', err instanceof Error ? err.message : err)
    return json({ error: 'Account deletion is not configured on the server.', code: 'not_configured' }, 503)
  }

  // Ordered, explicit, checked at every step. Stops (without touching
  // auth.users) the first time anything fails.
  const steps: { label: string; run: () => PromiseLike<{ error: { message: string } | null }> }[] = [
    { label: 'ratings', run: () => service.from('ratings').delete().eq('user_id', userId) },
    { label: 'watchlist_items', run: () => service.from('watchlist_items').delete().eq('user_id', userId) },
    { label: 'ai_sessions', run: () => service.from('ai_sessions').delete().eq('user_id', userId) },
    { label: 'user_api_keys', run: () => service.from('user_api_keys').delete().eq('user_id', userId) },
    // Anonymize, not delete — feedback.user_id uses ON DELETE SET NULL, and
    // that same intent applies here: the message stays, the identity doesn't.
    { label: 'feedback (anonymize)', run: () => service.from('feedback').update({ user_id: null }).eq('user_id', userId) },
    { label: 'profiles', run: () => service.from('profiles').delete().eq('id', userId) },
  ]

  const completed: string[] = []
  for (const step of steps) {
    const { error } = await step.run()
    if (error) {
      console.error(`delete-account: step "${step.label}" failed for user ${userId}:`, error.message)
      return json(
        {
          error: "Couldn't fully delete your account. Nothing further was touched — try again, or contact support.",
          code: 'delete_failed',
          failed_step: step.label,
          // Told to the client mainly so a retry can be informed, not just
          // blind — every step above is idempotent (delete/update on rows
          // that may already be gone is a no-op, not an error).
          completed_steps: completed,
        },
        500,
      )
    }
    completed.push(step.label)
  }

  // The point of no return. Hard delete (Supabase's default — no
  // shouldSoftDelete flag), which is what actually fires the ON DELETE
  // CASCADE / SET NULL definitions on every table above as a backstop.
  const { error: deleteUserError } = await service.auth.admin.deleteUser(userId)
  if (deleteUserError) {
    console.error(`delete-account: auth.users deletion failed for user ${userId}:`, deleteUserError.message)
    return json(
      {
        error:
          'Your data was deleted, but removing the account itself failed. Please try again — nothing else will be re-deleted.',
        code: 'auth_delete_failed',
        completed_steps: completed,
      },
      500,
    )
  }

  return json({ ok: true })
}
