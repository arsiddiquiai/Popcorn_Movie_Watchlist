import { useEffect, useState } from 'react'
import { SearchResultCard } from '../components/search/SearchResultCard'
import { searchMovies, TmdbError, type TmdbSearchMovie } from '../lib/tmdbClient'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function Search() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<TmdbSearchMovie[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Debounce the query by 400ms before it drives a search.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setStatus('idle')
      setErrorMessage(null)
      return
    }

    const controller = new AbortController()
    setStatus('loading')
    setErrorMessage(null)

    searchMovies(debouncedQuery, controller.signal)
      .then((movies) => {
        setResults(movies)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setErrorMessage(err instanceof TmdbError ? err.message : 'Something went wrong searching TMDB.')
        setStatus('error')
      })

    return () => controller.abort()
  }, [debouncedQuery])

  return (
    <div className="flex min-h-screen flex-col gap-6 px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a movie…"
          autoFocus
          className="w-full rounded-xl border border-muted/25 bg-surface px-4 py-3 font-ui text-sm text-text outline-none focus:border-accent-cold"
        />
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1">
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="font-ui text-sm text-muted">Search TMDB to find something to add to your watchlist.</p>
            {/* TODO(Prompt 7): trending movies grid renders here when the
                search query is empty. Not built yet. */}
          </div>
        )}

        {status === 'loading' && (
          <p className="py-20 text-center font-ui text-sm text-muted">Searching…</p>
        )}

        {status === 'error' && (
          <div className="mx-auto max-w-md rounded-lg border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 text-center font-ui text-sm text-accent-cold">
            {errorMessage}
          </div>
        )}

        {status === 'success' && results.length === 0 && (
          <p className="py-20 text-center font-ui text-sm text-muted">
            No results for "{debouncedQuery}". Try a different title.
          </p>
        )}

        {status === 'success' && results.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((movie) => (
              <SearchResultCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
