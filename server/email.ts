/**
 * Server-side email, shared by the feedback endpoint and api/ai.ts's error
 * alerting. Lives outside src/ on purpose: everything in src/lib is written
 * for the browser and several of those modules read import.meta.env, which
 * throws outside Vite — so server-only helpers can't live there.
 *
 * Both hosts import this: api/ (Vercel) and netlify/functions/ (the fallback
 * kept in place until the Vercel deploy is fully retired). One copy here
 * rather than two, so the pair can't drift the way api/ai.ts and
 * netlify/functions/ai.ts have to be manually kept in step.
 *
 * The Resend key is read from the server environment and never reaches the
 * browser — same rule as ANTHROPIC_API_KEY (CLAUDE.md non-negotiable #4).
 * Note there is deliberately no VITE_ fallback for either name.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const NOTIFICATION_EMAIL = process.env.MY_NOTIFICATION_EMAIL

/**
 * Resend requires a verified sender domain. Until one is set up, their shared
 * onboarding sender is the only address that works out of the box, and it can
 * only deliver to the account owner's own address — which is exactly what
 * MY_NOTIFICATION_EMAIL is. Override with RESEND_FROM once a domain is verified.
 */
const FROM = process.env.RESEND_FROM ?? 'Popcorn <onboarding@resend.dev>'

export interface SendResult {
  ok: boolean
  /** Present when ok === false. Safe to log; never surfaced to the client. */
  error?: string
  /** True when the send was skipped because email isn't configured at all. */
  skipped?: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Fire an email via Resend. Never throws: every caller treats email as a
 * side effect that must not take the user's request down with it. A feedback
 * submission that saved fine but failed to notify is still a successful
 * submission from the user's point of view.
 */
export async function sendEmail(subject: string, lines: string[]): Promise<SendResult> {
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
    console.warn('Email not configured (RESEND_API_KEY / MY_NOTIFICATION_EMAIL) — skipping send.')
    return { ok: false, skipped: true, error: 'not_configured' }
  }

  const html = lines
    .map((line) => (line === '' ? '<br/>' : `<p style="margin:0 0 10px">${escapeHtml(line)}</p>`))
    .join('')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [NOTIFICATION_EMAIL],
        subject,
        text: lines.join('\n'),
        html,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(`Resend failed (${response.status}): ${body.slice(0, 300)}`)
      return { ok: false, error: `resend_${response.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('Resend request threw:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'network' }
  }
}

// ---------------------------------------------------------------------------
// Error-alert throttling
// ---------------------------------------------------------------------------

/**
 * "Max 1 alert per error type per hour" so a repeating failure can't flood the
 * inbox.
 *
 * IMPORTANT CAVEAT, stated rather than glossed over: this is per warm
 * serverless instance, not global. Two concurrent instances can each send one
 * alert for the same error type in the same hour, and a cold start resets the
 * window. A genuinely global limit needs shared state (a small throttle table,
 * or Redis) — that is a real trade-off, chosen here because the brief asked
 * for something lightweight and because the failure mode is "a few duplicate
 * alerts", not "no alerts" or "unbounded alerts". A tight repeating error
 * still collapses from hundreds of emails to a handful.
 */
const ALERT_WINDOW_MS = 60 * 60 * 1000
const lastAlertAt = new Map<string, number>()

/** Returns true if an alert for this key may be sent now, and records it. */
export function shouldAlert(key: string, now: number = Date.now()): boolean {
  const previous = lastAlertAt.get(key)
  if (previous !== undefined && now - previous < ALERT_WINDOW_MS) return false
  lastAlertAt.set(key, now)
  return true
}

/** Test seam — resets the throttle window. Not used in production paths. */
export function _resetAlertThrottle(): void {
  lastAlertAt.clear()
}

/**
 * Alert on a genuine unexpected failure. Validation rejections and other
 * expected 4xx responses must NOT come through here — only real faults.
 */
export async function sendErrorAlert(params: {
  mode: string
  userId: string | null
  error: unknown
}): Promise<SendResult> {
  const { mode, userId, error } = params
  const name = error instanceof Error ? error.name : typeof error
  const message = error instanceof Error ? error.message : String(error)

  // Throttle on the shape of the failure (mode + error class + message), not
  // on the user — one broken code path shouldn't email once per affected user.
  const key = `${mode}:${name}:${message.slice(0, 120)}`
  if (!shouldAlert(key)) {
    console.warn(`Error alert suppressed by throttle: ${key.slice(0, 160)}`)
    return { ok: false, error: 'throttled' }
  }

  return sendEmail(`[Popcorn] error in mode:${mode} — ${name}`, [
    `Mode:    ${mode}`,
    `User:    ${userId ?? 'unauthenticated'}`,
    `When:    ${new Date().toISOString()}`,
    `Error:   ${name}: ${message}`,
    '',
    'Stack:',
    error instanceof Error && error.stack ? error.stack.slice(0, 2000) : '(no stack)',
  ])
}
