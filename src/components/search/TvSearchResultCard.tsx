import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { tmdbImageUrl, type TmdbSearchTv } from '../../lib/tmdbClient'
import { addToTvWatchlist } from '../../lib/tvWatchlist'

type AddState = 'idle' | 'loading' | 'added' | 'already' | 'error'

function airYear(firstAirDate: string): string {
  return firstAirDate ? firstAirDate.slice(0, 4) : '—'
}

/**
 * TV's equivalent of SearchResultCard — a new, standalone component
 * rather than generalizing that one. No long-press action sheet or
 * shared-element poster transition for v1 (same scope call as
 * TvDetail/TvWatchlist), just poster + title + a plain Add button.
 */
export function TvSearchResultCard({ show }: { show: TmdbSearchTv }) {
  const { user } = useAuth()
  const [state, setState] = useState<AddState>('idle')
  const posterUrl = tmdbImageUrl(show.poster_path, 'w342')

  async function handleAdd() {
    if (!user || state === 'loading') return
    setState('loading')
    try {
      const result = await addToTvWatchlist(show.id, user.id)
      setState(result === 'added' ? 'added' : 'already')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        to={`/tv/${show.id}`}
        className="group flex flex-col gap-3 transition-transform duration-[var(--transition-base)] ease-[var(--ease-standard)] hover:-translate-y-1.5"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-poster bg-surface shadow-none transition-shadow duration-[var(--transition-base)] ease-[var(--ease-standard)] group-active:shadow-[var(--shadow-lift)]">
          {posterUrl ? (
            <img src={posterUrl} alt={show.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted">
              {show.name}
            </div>
          )}
          {show.vote_average > 0 && (
            <span className="absolute right-3 top-3 rounded-full bg-accent-warm px-2 py-0.5 font-mono text-[11px] font-medium text-bg">
              {show.vote_average.toFixed(1)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="line-clamp-2 min-h-[2.5em] font-ui text-[13px] leading-[1.25] font-semibold text-text" title={show.name}>
            {show.name}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-subtle">
            {airYear(show.first_air_date)}
          </span>
        </div>
      </Link>

      {state === 'already' ? (
        <div className="rounded-lg border border-border px-3 py-1.5 text-center font-ui text-xs text-muted">Already on your list</div>
      ) : state === 'added' ? (
        <div className="rounded-full border border-accent-warm/40 bg-accent-warm/10 px-3 py-1.5 text-center font-ui text-xs font-semibold text-accent-warm">
          Added ✓
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={state === 'loading'}
          className="btn-hero rounded-full px-3 py-1.5 font-ui text-xs font-semibold disabled:opacity-60"
        >
          {state === 'loading' ? 'Adding…' : state === 'error' ? "Couldn't add — retry" : 'Add to Watchlist'}
        </button>
      )}
    </div>
  )
}
