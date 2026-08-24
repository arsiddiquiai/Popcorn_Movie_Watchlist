/**
 * Feedback submission endpoint.
 *
 * Goes through a serverless function rather than inserting straight from the
 * browser for two reasons: the Resend key is server-side only, and the brief
 * requires the notification to fire "inline in the same function that handles
 * the feedback submission" — so the insert and the email have to share a
 * request. The feedback table is also deliberately insert-only under RLS with
 * no select policy, so nothing here reads rows back.
 *
 * Identity comes from the verified Supabase JWT, never the request body —
 * same rule as api/ai.ts.
 */
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { Database } from '../src/lib/database.types.js'
import { sendEmail } from '../server/email.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

const MESSAGE_MAX_CHARS = 4000
const EMAIL_MAX_CHARS = 320

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface FeedbackInput {
  message: string
  contactEmail: string | null
}

function validate(raw: unknown): { input: FeedbackInput } | { problems: string[] } {
  const problems: string[] = []
  const body = (raw ?? {}) as Record<string, unknown>

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    problems.push('message is required and must be a non-empty string.')
  } else if (message.length > MESSAGE_MAX_CHARS) {
    problems.push(`message must be ${MESSAGE_MAX_CHARS} characters or fewer.`)
  }

  let contactEmail: string | null = null
  if (body.contact_email !== undefined && body.contact_email !== null && body.contact_email !== '') {
    if (typeof body.contact_email !== 'string') {
      problems.push('contact_email must be a string if provided.')
    } else {
      const trimmed = body.contact_email.trim()
      if (trimmed.length > EMAIL_MAX_CHARS) {
        problems.push(`contact_email must be ${EMAIL_MAX_CHARS} characters or fewer.`)
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        problems.push("contact_email doesn't look like an email address.")
      } else {
        contactEmail = trimmed
      }
    }
  }

  if (problems.length > 0) return { problems }
  return { input: { message, contactEmail } }
}

export async function POST(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed. Use POST.' }, 405)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase environment variables are not set.')
    return json({ error: 'Feedback is not configured on the server.', code: 'not_configured' }, 503)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Request body must be valid JSON.', code: 'invalid_json' }, 400)
  }

  const validated = validate(body)
  if ('problems' in validated) {
    return json({ error: 'Invalid request body.', code: 'invalid_input', problems: validated.problems }, 400)
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Missing Authorization header.', code: 'unauthenticated' }, 401)

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return json({ error: 'Invalid or expired session.', code: 'unauthenticated' }, 401)
  }
  const user = userData.user

  const { error: insertError } = await supabase.from('feedback').insert({
    user_id: user.id,
    message: validated.input.message,
    contact_email: validated.input.contactEmail,
  })

  if (insertError) {
    console.error('feedback insert failed:', insertError.message)
    return json({ error: "Couldn't save your feedback. Try again.", code: 'insert_failed' }, 500)
  }

  // Inline, per the brief. Deliberately awaited but non-fatal: the row is
  // already saved, so a mail failure must not turn a successful submission
  // into an error for the user. It is reported in the response so the client
  // could surface a soft note if it ever wants to.
  const mail = await sendEmail('[Popcorn] New feedback', [
    `From:    ${user.email ?? '(no account email)'}`,
    `Reply to: ${validated.input.contactEmail ?? '(not provided)'}`,
    `User id: ${user.id}`,
    `When:    ${new Date().toISOString()}`,
    '',
    'Message:',
    validated.input.message,
  ])

  if (!mail.ok) console.error('feedback notification email failed:', mail.error)

  return json({ ok: true, notified: mail.ok })
}
