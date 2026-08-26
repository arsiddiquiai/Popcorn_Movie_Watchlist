/**
 * Duo Match's one server-touch: attaching a guest to a session by invite
 * token. Every other read/write for this feature (creating a session,
 * voting, reading the candidate deck and votes) goes through the caller's
 * own JWT-scoped Supabase client directly from the browser under the RLS
 * policies in supabase/migrations/20260826120000_create_duo_match.sql —
 * this endpoint exists only because a brand-new guest, at the moment they
 * try to join, is neither the host nor an already-recorded participant, so
 * no owner-based RLS predicate can authorize that first write for them.
 *
 * Authenticated (the guest's own JWT, verified below) — this is NOT the
 * public unauthenticated shape api/share.ts's GET has. A visitor who isn't
 * signed in yet is sent to sign-in/signup first (src/routes/DuoInvite.tsx),
 * exactly like the pending-share-token flow.
 */
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { Database } from '../src/lib/database.types.js'
import { getServiceClient } from '../server/serviceClient.js'

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

  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!authHeader) return json({ error: 'Missing Authorization header.', code: 'unauthenticated' }, 401)

  const authed = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${authHeader}` } },
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  })
  const { data: userData, error: userError } = await authed.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Invalid or expired session.', code: 'unauthenticated' }, 401)
  const guestId = userData.user.id

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body must be valid JSON.', code: 'invalid_json' }, 400)
  }
  const inviteToken = typeof (body as { token?: unknown })?.token === 'string' ? (body as { token: string }).token.trim() : ''
  if (!inviteToken) return json({ error: 'Missing token.', code: 'invalid_input' }, 400)

  let service: ReturnType<typeof getServiceClient>
  try {
    service = getServiceClient()
  } catch (err) {
    console.error('Service client unavailable:', err instanceof Error ? err.message : err)
    return json({ error: 'Not configured on the server.', code: 'not_configured' }, 503)
  }

  const { data: session, error: sessionError } = await service
    .from('duo_sessions')
    .select('id, host_user_id, guest_user_id')
    .eq('invite_token', inviteToken)
    .maybeSingle()
  if (sessionError) {
    console.error('duo_sessions lookup failed:', sessionError.message)
    return json({ error: 'Something went wrong.', code: 'internal_error' }, 500)
  }
  if (!session) return json({ error: 'This invite is invalid or has expired.', code: 'not_found' }, 404)

  if (session.host_user_id === guestId) {
    return json({ error: "You can't join your own Duo Match.", code: 'own_session' }, 400)
  }

  // Already the guest on this session — idempotent, not an error. Lets a
  // page refresh or a re-tapped invite link land on the same session
  // instead of failing.
  if (session.guest_user_id === guestId) return json({ session_id: session.id })

  if (session.guest_user_id !== null) {
    return json({ error: 'This Duo Match already has two people in it.', code: 'session_full' }, 409)
  }

  // .is('guest_user_id', null) makes this a compare-and-swap: if two
  // people tap the same invite link at nearly the same moment, only the
  // request that finds the row still unclaimed at WRITE time (not just at
  // the read above, a moment earlier) actually updates it — otherwise the
  // second writer would silently overwrite the first guest with no error
  // to either of them.
  const { data: updated, error: updateError } = await service
    .from('duo_sessions')
    .update({ guest_user_id: guestId })
    .eq('id', session.id)
    .is('guest_user_id', null)
    .select('id')
    .maybeSingle()
  if (updateError) {
    console.error('duo_sessions guest attach failed:', updateError.message)
    return json({ error: 'Something went wrong.', code: 'internal_error' }, 500)
  }
  if (!updated) {
    return json({ error: 'This Duo Match already has two people in it.', code: 'session_full' }, 409)
  }

  return json({ session_id: session.id })
}
