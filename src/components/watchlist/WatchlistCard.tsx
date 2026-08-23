import { useState } from 'react'
import { Link } from 'react-router-dom'
import { decayPosterStyle, DECAY_RESCUE_THRESHOLD } from '../../lib/decay'
import { formatRuntime } from '../../lib/format'
import { tmdbImageUrl } from '../../lib/tmdbClient'
import type { WatchlistEntry } from '../../lib/watchlist'
import { refreshAddedAt, removeFromWatchlist } from '../../lib/watchlist'
import { useTheme } from '../../theme/ThemeProvider'

/** Session-only dismissal for the rescue-or-bury prompt — "don't be naggy"
 *  per CLAUDE.md, but this doesn't need a new DB column: a browser tab
 *  restart is a reasonable point to ask again about something that's still
 *  sitting unwatched. */
const DISMISS_KEY_PREFIX = 'popcorn:decay-dismissed:'

function isDismissed(itemId: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY_PREFIX + itemId) === '1'
  } catch {
    return false
  }
}

function dismiss(itemId: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY_PREFIX + itemId, '1')
  } catch {
    // Storage can be unavailable (private mode, quota) — the prompt just
    // reappears next render in that case, which is a fine fallback.
  }
}

interface WatchlistCardProps {
  entry: WatchlistEntry
  /** 0 (fresh) to 1 (fully decayed) — only meaningful on the "want" tab.
   *  Undefined/0 renders identically to the pre-decay card. */
  decayLevel?: number
  /** Called after "Keep it" or "Remove" succeeds, so the parent list can
   *  update its source-of-truth entries (new added_at, or drop the item). */
  onDecayResolved?: (itemId: string, action: 'kept' | 'removed', newAddedAt?: string) => void
}

export function WatchlistCard({ entry, decayLevel = 0, onDecayResolved }: WatchlistCardProps) {
  const { movie, score, item } = entry
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')
  const runtime = formatRuntime(movie.runtime_minutes)
  const { reducedMotion } = useTheme()
  const [pending, setPending] = useState(false)
  const [dismissed, setDismissed] = useState(() => isDismissed(item.id))

  const decayed = decayLevel > 0
  const rescueEligible = decayLevel >= DECAY_RESCUE_THRESHOLD && !dismissed
  // Applied unconditionally (decayLevel 0 resolves to saturate(100%)/opacity
  // 1, visually identical to no style at all) rather than only when
  // decayed, so the filter/opacity/transition properties are already
  // present on the element when decayLevel changes — e.g. after "Keep it"
  // resets it to 0 — letting the transition actually animate between
  // values instead of the properties just disappearing.
  //
  // The decayed state itself stays visible regardless of reduced-motion —
  // it's a static state, not motion. Only the transition INTO/OUT OF it is
  // gated, per CLAUDE.md's reduced-motion rule.
  const posterStyle = {
    ...decayPosterStyle(decayLevel),
    transition: reducedMotion
      ? undefined
      : 'filter var(--transition-slow) var(--ease-standard), opacity var(--transition-slow) var(--ease-standard)',
  }

  async function handleKeep(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    setPending(true)
    try {
      const newAddedAt = await refreshAddedAt(item.id)
      dismiss(item.id)
      setDismissed(true)
      onDecayResolved?.(item.id, 'kept', newAddedAt)
    } finally {
      setPending(false)
    }
  }

  async function handleRemove(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    setPending(true)
    try {
      await removeFromWatchlist(item.id)
      dismiss(item.id)
      onDecayResolved?.(item.id, 'removed')
    } finally {
      setPending(false)
    }
  }

  function handleDismiss(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    dismiss(item.id)
    setDismissed(true)
  }

  return (
    <Link
      to={`/movie/${movie.tmdb_id}`}
      className="group flex flex-col gap-3 transition-transform duration-[var(--transition-base)] ease-[var(--ease-standard)] hover:-translate-y-1.5"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-sm)] transition-shadow duration-[var(--transition-base)] ease-[var(--ease-standard)] group-hover:shadow-[var(--shadow-glow)]">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover"
            style={posterStyle}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted"
            style={posterStyle}
          >
            {movie.title}
          </div>
        )}
        {score !== null && (
          <span className="absolute right-3 top-3 rounded-full bg-accent-warm px-2 py-0.5 font-mono text-[11px] font-medium text-bg">
            {score}/10
          </span>
        )}

        {rescueEligible && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-bg/90 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-ui text-xs leading-snug text-text">Still want to watch this?</p>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss"
                className="shrink-0 font-ui text-xs leading-none text-muted-subtle hover:text-text"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => void handleKeep(e)}
                disabled={pending}
                className="flex-1 rounded-full border border-accent-warm/50 bg-accent-warm/15 px-2 py-1 font-ui text-[11px] font-semibold text-accent-warm transition-colors duration-[var(--transition-fast)] hover:bg-accent-warm/25 disabled:opacity-60"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={(e) => void handleRemove(e)}
                disabled={pending}
                className="flex-1 rounded-full border border-border px-2 py-1 font-ui text-[11px] text-muted transition-colors duration-[var(--transition-fast)] hover:text-text disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3
          className={`truncate font-display text-base font-semibold transition-colors duration-[var(--transition-base)] ${decayed ? 'text-muted' : 'text-text'}`}
          title={movie.title}
        >
          {movie.title}
        </h3>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted-subtle">
          <span>{movie.release_year ?? '—'}</span>
          {runtime && (
            <>
              <span aria-hidden="true">·</span>
              <span>{runtime}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
