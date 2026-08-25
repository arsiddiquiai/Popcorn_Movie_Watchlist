import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRuntime } from '../../lib/format'
import { tmdbImageUrl } from '../../lib/tmdbClient'
import { restoreDropped, type WatchlistEntry } from '../../lib/watchlist'

interface BuriedCardProps {
  entry: WatchlistEntry
  onRestored: (itemId: string) => void
}

/**
 * The Buried tab's card (live-review fix — DESIGN.md never specified a
 * screen for status='dropped' items, and swiping/long-press-Bury now
 * reaches that status far more often than the one rare "Remove from list"
 * button that used to be the only path to it, so it needed one). Simpler
 * than WatchlistCard on purpose: no swipe, no long-press, no decay — a
 * buried item's only two things to do are look at it or bring it back, and
 * "bring it back" is a plain visible button, not another gesture.
 */
export function BuriedCard({ entry, onRestored }: BuriedCardProps) {
  const { movie, item } = entry
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')
  const runtime = formatRuntime(movie.runtime_minutes)
  const [pending, setPending] = useState(false)

  async function handleRestore() {
    if (pending) return
    setPending(true)
    try {
      await restoreDropped(item.id)
      onRestored(item.id)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Link to={`/movie/${movie.tmdb_id}`} className="group flex flex-col gap-3">
        <div className="relative aspect-[2/3] overflow-hidden rounded-poster bg-surface opacity-70 grayscale-[0.4]">
          {posterUrl ? (
            <img src={posterUrl} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted">
              {movie.title}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="line-clamp-2 min-h-[2.5em] font-ui text-[13px] leading-[1.25] font-semibold text-muted" title={movie.title}>
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

      <button
        type="button"
        onClick={() => void handleRestore()}
        disabled={pending}
        className="w-full rounded-full border border-accent-warm/40 bg-accent-warm/10 px-3 py-1.5 font-ui text-xs font-semibold text-accent-warm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/20 disabled:opacity-60"
      >
        {pending ? 'Restoring…' : 'Restore'}
      </button>
    </div>
  )
}
