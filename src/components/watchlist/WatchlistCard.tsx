import { useState } from 'react'
import { Link } from 'react-router-dom'
import { decayHairlineWidth, decayPosterStyle, DECAY_RESCUE_THRESHOLD } from '../../lib/decay'
import { formatRuntime } from '../../lib/format'
import { isFavoriteScore, mix, rgbString } from '../../lib/ratingScale'
import { tmdbImageUrl } from '../../lib/tmdbClient'
import type { WatchlistEntry } from '../../lib/watchlist'
import { refreshAddedAt, removeFromWatchlist } from '../../lib/watchlist'
import { useTheme } from '../../theme/ThemeProvider'
import { useDecayColors } from './useDecayColors'

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
  /** 0 (fresh) to 1 (fully decayed) — only meaningful when decayEnabled.
   *  Undefined/0 renders identically to the pre-decay card. */
  decayLevel?: number
  /** Whether this card sits on the decay shelf at all (the "want" tab) —
   *  gates the hairline and the rescue-or-bury prompt, neither of which
   *  mean anything once a movie is watched. */
  decayEnabled?: boolean
  /** Called after "Keep it" or "Remove" succeeds, so the parent list can
   *  update its source-of-truth entries (new added_at, or drop the item). */
  onDecayResolved?: (itemId: string, action: 'kept' | 'removed', newAddedAt?: string) => void
}

export function WatchlistCard({ entry, decayLevel = 0, decayEnabled = false, onDecayResolved }: WatchlistCardProps) {
  const { movie, score, item } = entry
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')
  const runtime = formatRuntime(movie.runtime_minutes)
  const { reducedMotion } = useTheme()
  const decayColors = useDecayColors()
  const [pending, setPending] = useState(false)
  const [dismissed, setDismissed] = useState(() => isDismissed(item.id))

  const decayed = decayEnabled && decayLevel > 0
  const rescueEligible = decayEnabled && decayLevel >= DECAY_RESCUE_THRESHOLD && !dismissed
  const hairlineWidth = decayHairlineWidth(decayLevel)
  const hairlineColor = rgbString(mix(decayColors.fresh, decayColors.decayed, Math.min(1, Math.max(0, decayLevel))))
  // Applied unconditionally (decayLevel 0 resolves to the "fresh" no-op
  // filter) rather than only when decayed, so the filter/transition
  // properties are already present on the element when decayLevel changes
  // — e.g. after "Keep it" resets it to 0 — letting the transition actually
  // animate between values instead of the properties just disappearing.
  //
  // The decayed state itself stays visible regardless of reduced-motion —
  // it's a static state, not motion. Only the transition INTO/OUT OF it is
  // gated, per CLAUDE.md's reduced-motion rule.
  const posterStyle = {
    ...decayPosterStyle(decayLevel),
    transition: reducedMotion ? undefined : 'filter var(--transition-slow) var(--ease-standard)',
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
      <div className="relative aspect-[2/3] overflow-hidden rounded-poster bg-surface shadow-none transition-shadow duration-[var(--transition-base)] ease-[var(--ease-standard)] group-active:shadow-[var(--shadow-lift)]">
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
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent-warm px-2 py-0.5 font-mono text-[11px] font-medium text-bg">
            {isFavoriteScore(score) && (
              <span aria-label="Favorite" title="Favorite (9+)" className="leading-none">
                ★
              </span>
            )}
            {score}/10
          </span>
        )}

        {rescueEligible && (
          // A full-height gradient scrim rather than the hard-edged strip this
          // used to be: a solid box pasted across the poster's bottom third was
          // the roughest element on the watchlist. The gradient lets it read as
          // part of the poster, and gives the copy enough room to sit at a
          // legible size instead of 11px.
          <div className="absolute inset-0 flex flex-col justify-end gap-3 bg-gradient-to-t from-bg via-bg/85 via-45% to-transparent p-4">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Not now"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-lg leading-none text-muted-subtle transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-surface hover:text-text"
            >
              ×
            </button>

            <p className="font-display text-sm leading-snug font-semibold text-text">
              Still want to watch this?
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={(e) => void handleKeep(e)}
                disabled={pending}
                className="w-full rounded-full border border-accent-warm/50 bg-accent-warm/15 px-3 py-2 font-ui text-xs font-semibold text-accent-warm transition-[background-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/25 active:scale-[0.97] disabled:opacity-60"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={(e) => void handleRemove(e)}
                disabled={pending}
                className="w-full rounded-full border border-border px-3 py-2 font-ui text-xs text-muted transition-[color,border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-muted/40 hover:text-text active:scale-[0.97] disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {decayEnabled && (
          // The decay hairline (DESIGN.md §1) — no numbers, no tooltip, just
          // a line that shortens and cools as the movie sits unwatched.
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-px -translate-x-1/2 transition-[width,background-color] duration-[var(--transition-slow)] ease-[var(--ease-standard)]"
            style={{ width: `${hairlineWidth}%`, backgroundColor: hairlineColor }}
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3
          className={`line-clamp-2 font-ui text-[13px] leading-[1.25] font-semibold transition-colors duration-[var(--transition-base)] ease-[var(--ease-standard)] ${decayed ? 'text-muted' : 'text-text'}`}
          title={movie.title}
        >
          {movie.title}
        </h3>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-subtle">
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
