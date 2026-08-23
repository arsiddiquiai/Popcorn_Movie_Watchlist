import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { tmdbImageUrl, type TmdbSearchMovie } from '../../lib/tmdbClient'
import { addToWatchlist } from '../../lib/watchlist'

type AddState = 'idle' | 'loading' | 'added' | 'already' | 'error'

function releaseYear(releaseDate: string): string {
  return releaseDate ? releaseDate.slice(0, 4) : '—'
}

export function SearchResultCard({ movie }: { movie: TmdbSearchMovie }) {
  const { user } = useAuth()
  const [state, setState] = useState<AddState>('idle')
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')

  async function handleAdd() {
    if (!user || state === 'loading') return
    setState('loading')
    try {
      const result = await addToWatchlist(movie.id, user.id)
      setState(result === 'added' ? 'added' : 'already')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="group flex flex-col gap-3">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-sm)] transition-shadow duration-[var(--transition-base)] group-hover:shadow-[var(--shadow-glow)]">
        {posterUrl ? (
          <img src={posterUrl} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted">
            {movie.title}
          </div>
        )}
        {movie.vote_average > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-accent-warm px-2 py-0.5 font-mono text-[11px] font-medium text-bg">
            {movie.vote_average.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="truncate font-display text-base font-semibold text-text" title={movie.title}>
          {movie.title}
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-subtle">
          {releaseYear(movie.release_date)}
        </span>
      </div>

      <AddButton state={state} onClick={handleAdd} />
    </div>
  )
}

function AddButton({ state, onClick }: { state: AddState; onClick: () => void }) {
  if (state === 'already') {
    return (
      <div className="rounded-lg border border-muted/25 px-3 py-1.5 text-center font-ui text-xs text-muted">
        Already on your list
      </div>
    )
  }

  if (state === 'added') {
    return (
      <div className="rounded-full border border-accent-warm/40 bg-accent-warm/10 px-3 py-1.5 text-center font-ui text-xs font-semibold text-accent-warm">
        Added ✓
      </div>
    )
  }

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border border-accent-cold/40 bg-accent-cold/10 px-3 py-1.5 font-ui text-xs text-accent-cold transition-colors duration-[var(--transition-fast)]"
      >
        Couldn't add — retry
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'loading'}
      className="btn-hero rounded-full px-3 py-1.5 font-ui text-xs font-semibold disabled:opacity-60"
    >
      {state === 'loading' ? 'Adding…' : 'Add to Watchlist'}
    </button>
  )
}
