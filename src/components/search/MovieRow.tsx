import type { TmdbSearchMovie } from '../../lib/tmdbClient'
import { PosterRowSkeleton } from '../ui/PosterGridSkeleton'
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

      {status === 'loading' && <PosterRowSkeleton />}

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
