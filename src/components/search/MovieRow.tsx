import type { TmdbSearchMovie } from '../../lib/tmdbClient'
import { SearchResultCard } from './SearchResultCard'

interface MovieRowProps {
  title: string
  status: 'loading' | 'success' | 'error'
  movies: TmdbSearchMovie[]
}

export function MovieRow({ title, status, movies }: MovieRowProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg text-text">{title}</h2>

      {status === 'loading' && (
        <div className="flex gap-4 overflow-x-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-lg bg-surface sm:w-40" />
          ))}
        </div>
      )}

      {status === 'error' && <p className="font-ui text-sm text-muted">Couldn't load these right now.</p>}

      {status === 'success' && movies.length === 0 && (
        <p className="font-ui text-sm text-muted">Nothing to show right now.</p>
      )}

      {status === 'success' && movies.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {movies.map((movie) => (
            <div key={movie.id} className="w-36 shrink-0 sm:w-40">
              <SearchResultCard movie={movie} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
