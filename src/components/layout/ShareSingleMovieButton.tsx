import { useState } from 'react'
import { readShareCardTheme, renderSingleMovieCard, shareOrDownloadCard } from '../../lib/shareCard'
import { tmdbImageUrl } from '../../lib/tmdbClient'

type State = 'idle' | 'working' | 'error'

interface ShareSingleMovieButtonProps {
  posterPath: string | null
  title: string
  /** Small caps line above the poster — "YOUR RATING" or "TONIGHT'S PICK". */
  eyebrow: string
  /** Caption under the title — the verdict word + score for a rating share,
   *  or the pick's own one-line reason for a Pick For Me share. */
  tagline: string
  /** Filename stem; ".png" is appended by the caller's context, not here —
   *  kept simple since this component only ever produces one file per
   *  click. */
  filename: string
  /** Visible label — callers phrase this to match their own context
   *  ("Share this rating" vs. "Share this pick") rather than this
   *  component guessing from `eyebrow`. */
  label: string
}

/**
 * Inline, dismissible share trigger for a single film — used after a 9/10
 * rating (RatingPanel) and after a Pick For Me result (ResultCard). Reuses
 * shareCard.ts's renderSingleMovieCard, defaulting to the 9:16 Story format
 * per the share-card brief (no format toggle here — that lives on the
 * fuller You-tab entry point; these are meant to be a quick, low-friction
 * nudge, not a second settings surface).
 */
export function ShareSingleMovieButton({ posterPath, title, eyebrow, tagline, filename, label }: ShareSingleMovieButtonProps) {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleShare() {
    if (state === 'working') return
    setState('working')
    setMessage(null)
    try {
      const posterUrl = tmdbImageUrl(posterPath, 'w500') ?? ''
      const blob = await renderSingleMovieCard({ url: posterUrl, title }, readShareCardTheme(), eyebrow, tagline)
      const outcome = await shareOrDownloadCard(blob, `${filename}.png`)
      if (outcome === 'downloaded') setMessage('Saved — check your downloads.')
      if (outcome === 'failed') setMessage("Couldn't generate the card. Try again.")
      setState(outcome === 'failed' ? 'error' : 'idle')
    } catch {
      setState('error')
      setMessage("Couldn't generate the card. Try again.")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={state === 'working'}
        className="rounded-full border border-border px-3 py-1.5 font-ui text-xs text-text transition-[border-color] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-muted/40 disabled:opacity-60"
      >
        {state === 'working' ? 'Making…' : label}
      </button>
      {message && <span className="font-ui text-xs text-muted">{message}</span>}
    </div>
  )
}
