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
    <Link to={`/movie/${movie.tmdb_id}`} className="flex flex-col gap-2">
      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-surface">
        {posterUrl ? (
          <img src={posterUrl} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted">
            {movie.title}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="truncate font-ui text-sm font-semibold text-text" title={movie.title}>
          {movie.title}
        </h3>
        <div className="flex items-center gap-2 font-ui text-xs text-muted">
          <span>{movie.release_year ?? '—'}</span>
          {runtime && <span>{runtime}</span>}
          {score !== null && <span className="text-accent-warm">★ {score}/10</span>}
        </div>
      </div>
    </Link>
  )
}
