import { useEffect, useState } from 'react'
import { searchMovies, tmdbImageUrl, type TmdbSearchMovie } from '../../lib/tmdbClient'

interface SourceMoviePickerProps {
  selected: TmdbSearchMovie | null
  onSelect: (movie: TmdbSearchMovie | null) => void
}

/** Type-ahead search over TMDB, for picking the film to find an equivalent of. */
export function SourceMoviePicker({ selected, onSelect }: SourceMoviePickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbSearchMovie[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selected || !query.trim()) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const handle = setTimeout(() => {
      searchMovies(query, controller.signal)
        .then((movies) => setResults(movies.slice(0, 6)))
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [query, selected])

  if (selected) {
    const posterUrl = tmdbImageUrl(selected.poster_path, 'w92')
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
        {posterUrl ? (
          <img src={posterUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-14 w-10 shrink-0 rounded-md bg-surface-2" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-text">{selected.title}</p>
          <p className="font-mono text-[11px] text-muted-subtle">
            {selected.release_date ? selected.release_date.slice(0, 4) : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null)
            setQuery('')
          }}
          className="shrink-0 font-ui text-xs text-muted underline underline-offset-4 hover:text-text"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search for a film you love…"
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 font-ui text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] placeholder:text-muted-subtle focus:border-accent-warm"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lift)]">
          {results.map((movie) => {
            const posterUrl = tmdbImageUrl(movie.poster_path, 'w92')
            return (
              <li key={movie.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(movie)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-[var(--transition-fast)] hover:bg-surface-2"
                >
                  {posterUrl ? (
                    <img src={posterUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="h-14 w-10 shrink-0 rounded-md bg-surface-2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-ui text-sm text-text">{movie.title}</p>
                    <p className="font-mono text-[11px] text-muted-subtle">
                      {movie.release_date ? movie.release_date.slice(0, 4) : '—'}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
