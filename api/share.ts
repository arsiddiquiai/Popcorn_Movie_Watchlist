/**
 * Public shareable watchlist links (/w/{token}).
 *
 * POST (authenticated, JWT-scoped like every other endpoint): returns the
 * caller's existing token if they already have one, otherwise generates a
 * new opaque one and stores the token -> user_id mapping. One token per
 * user — sharing again reuses the same link rather than proliferating new
 * ones every time the card is generated.
 *
 * GET ?token=... (public, no Authorization header at all — the visitor on
 * /w/{token} has no session): looks up the token via the service-role
 * client (server/serviceClient.ts) and returns only display name + the
 * sharer's CURRENT status='want' list — a live view, not a snapshot
 * captured at share time (see the migration's own comment for why that
 * was the simpler choice given this schema). An unknown/invalid token
 * returns 404 with a friendly shape, not a raw error — the client renders
 * a "not found" state from that, never an error page.
 *
 * What never reaches the client, on either path: the token's user_id, the
 * sharer's email, their ratings, their watched list, or anything from
 * profiles beyond a display name.
 */
import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { Database } from '../src/lib/database.types.js'
import { getServiceClient } from '../server/serviceClient.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** 18 random bytes -> 24 base64url characters. Not sequential, not
 *  derived from the row id or a timestamp — genuinely unguessable, unlike
 *  e.g. a UUID v1 or an incrementing id would be. */
function generateToken(): string {
  return randomBytes(18).toString('base64url')
}

async function handlePost(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase environment variables are not set.')
    return json({ error: 'Not configured on the server.', code: 'not_configured' }, 503)
  }

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

  const { data: existing, error: selectError } = await authed
    .from('share_links')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle()
  if (selectError) {
    console.error('share_links select failed:', selectError.message)
    return json({ error: 'Something went wrong.', code: 'internal_error' }, 500)
  }
  if (existing) return json({ token: existing.token })

  const shareToken = generateToken()
  const { error: insertError } = await authed.from('share_links').insert({ token: shareToken, user_id: userId })
  if (insertError) {
    console.error('share_links insert failed:', insertError.message)
    return json({ error: 'Something went wrong.', code: 'internal_error' }, 500)
  }
  return json({ token: shareToken })
}

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()
  if (!token) return json({ error: 'Missing token.', code: 'invalid_input' }, 400)

  let service: ReturnType<typeof getServiceClient>
  try {
    service = getServiceClient()
  } catch (err) {
    console.error('Service client unavailable:', err instanceof Error ? err.message : err)
    return json({ error: 'Not configured on the server.', code: 'not_configured' }, 503)
  }

  const { data: link, error: linkError } = await service
    .from('share_links')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()
  if (linkError) {
    console.error('share_links lookup failed:', linkError.message)
    return json({ error: 'Something went wrong.', code: 'internal_error' }, 500)
  }
  if (!link) return json({ error: 'This link is invalid or has expired.', code: 'not_found' }, 404)

  // display_name comes from auth's own user_metadata (set at signup, the
  // same field the app's share-card title already reads client-side) —
  // not a profiles-table column that may or may not be kept in sync by a
  // trigger this codebase doesn't control. Falls back to "Someone" if
  // never set; the caller's email is never read into this response at all.
  const { data: userResult, error: userLookupError } = await service.auth.admin.getUserById(link.user_id)
  if (userLookupError) console.error('auth.admin.getUserById failed:', userLookupError.message)
  const rawName = userResult?.user?.user_metadata?.display_name
  const displayName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null

  const { data: wantItems, error: itemsError } = await service
    .from('watchlist_items')
    .select('tmdb_id')
    .eq('user_id', link.user_id)
    .eq('status', 'want')
  if (itemsError) {
    console.error('watchlist_items lookup failed:', itemsError.message)
    return json({ error: 'Something went wrong.', code: 'internal_error' }, 500)
  }

  const tmdbIds = wantItems.map((row) => row.tmdb_id)
  let movies: { tmdb_id: number; title: string; poster_path: string | null; release_year: number | null }[] = []
  if (tmdbIds.length > 0) {
    const { data: movieRows, error: moviesError } = await service
      .from('movies_cache')
      .select('tmdb_id, title, poster_path, release_year')
      .in('tmdb_id', tmdbIds)
    if (moviesError) {
      console.error('movies_cache lookup failed:', moviesError.message)
      return json({ error: 'Something went wrong.', code: 'internal_error' }, 500)
    }
    movies = movieRows
  }

  return json({ display_name: displayName, movies })
}

export async function GET(req: Request): Promise<Response> {
  return handleGet(req)
}

export async function POST(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed. Use POST.' }, 405)
  return handlePost(req)
}
