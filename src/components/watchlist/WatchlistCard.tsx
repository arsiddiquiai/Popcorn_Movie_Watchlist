import { Link } from 'react-router-dom'
import { formatRuntime } from '../../lib/format'
import { tmdbImageUrl } from '../../lib/tmdbClient'
import type { WatchlistEntry } from '../../lib/watchlist'

interface WatchlistCardProps {
  entry: WatchlistEntry
  // Hook for the decay/greyscale treatment on ageing "want" items — not
  // built yet (later prompt). Accepted but unused for now.
  decayLevel?: number
}

export function WatchlistCard({ entry }: WatchlistCardProps) {
  const { movie, score } = entry
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')
  const runtime = formatRuntime(movie.runtime_minutes)

  return (
    <Link
      to={`/movie/${movie.tmdb_id}`}
      className="group flex flex-col gap-3 transition-transform duration-[var(--transition-base)] ease-[var(--ease-standard)] hover:-translate-y-1.5"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-sm)] transition-shadow duration-[var(--transition-base)] ease-[var(--ease-standard)] group-hover:shadow-[var(--shadow-glow)]">
        {posterUrl ? (
          <img src={posterUrl} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted">
            {movie.title}
          </div>
        )}
        {score !== null && (
          <span className="absolute right-3 top-3 rounded-full bg-accent-warm px-2 py-0.5 font-mono text-[11px] font-medium text-bg">
            {score}/10
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="truncate font-display text-base font-semibold text-text" title={movie.title}>
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
