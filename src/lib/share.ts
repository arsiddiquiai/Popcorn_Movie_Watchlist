/** Web Share for a rated movie — native share sheet where available, with a
 *  copy-to-clipboard fallback (desktop Safari, older browsers) rather than
 *  failing silently. Plain text only, no image. */

export interface ShareableRating {
  title: string
  year: number | null
  score: number
  verdict: string
}

function shareText({ title, year, score, verdict }: ShareableRating): string {
  const yearPart = year ? ` (${year})` : ''
  return `${title}${yearPart} — I rated it ${score}/10 on Popcorn. "${verdict}"`
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Tries navigator.share first; falls back to the Clipboard API if the
 * browser doesn't support sharing at all. A user cancelling the native
 * share sheet is reported as 'cancelled', not 'failed' — that's not an
 * error, and callers shouldn't show a failure message for it.
 */
export async function shareRating(rating: ShareableRating): Promise<ShareOutcome> {
  const text = shareText(rating)

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, title: rating.title })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Some browsers advertise navigator.share but reject in practice
      // (e.g. no share targets registered) — fall through to clipboard
      // rather than reporting failure outright.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'failed'
    }
  }

  return 'failed'
}
