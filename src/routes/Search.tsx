import { useEffect, useState } from 'react'
import { FilterBar, DEFAULT_ADVANCED_FILTERS, hasActiveAdvancedFilters, type AdvancedFilters } from '../components/search/FilterBar'
import { LanguageChips } from '../components/search/LanguageChips'
import { MovieRow } from '../components/search/MovieRow'
import { SearchResultCard } from '../components/search/SearchResultCard'
import {
  discoverMovies,
  getNowPlayingMovies,
  getTrendingMovies,
  searchMovies,
  TmdbError,
  type TmdbSearchMovie,
} from '../lib/tmdbClient'

type RowStatus = 'loading' | 'success' | 'error'

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS)

  // Text-search mode.
  const [searchResults, setSearchResults] = useState<TmdbSearchMovie[]>([])
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [searchError, setSearchError] = useState<string | null>(null)

  // Browse mode (empty query): curated rows, or one filtered grid once any
  // filter is active — see the note above the render logic below.
  const [trending, setTrending] = useState<TmdbSearchMovie[]>([])
  const [trendingStatus, setTrendingStatus] = useState<RowStatus>('loading')
  const [nowPlaying, setNowPlaying] = useState<TmdbSearchMovie[]>([])
  const [nowPlayingStatus, setNowPlayingStatus] = useState<RowStatus>('loading')
  const [discoverResults, setDiscoverResults] = useState<TmdbSearchMovie[]>([])
  const [discoverStatus, setDiscoverStatus] = useState<RowStatus>('loading')

  const filtersActive = language !== 'all' || hasActiveAdvancedFilters(filters)

  // Debounce the query by 400ms before it drives anything.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(handle)
  }, [query])

  // Text-search mode. TMDB's /search/movie has no language filter param, so
  // the language chip is applied client-side to whatever page 1 returns —
  // the only way to make it "combine" with search at all, per TMDB's API.
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([])
      setSearchStatus('idle')
      setSearchError(null)
      return
    }

    const controller = new AbortController()
    setSearchStatus('loading')
    setSearchError(null)

    searchMovies(debouncedQuery, controller.signal)
      .then((movies) => {
        const filtered = language === 'all' ? movies : movies.filter((m) => m.original_language === language)
        setSearchResults(filtered)
        setSearchStatus('success')
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setSearchError(err instanceof TmdbError ? err.message : 'Something went wrong searching TMDB.')
        setSearchStatus('error')
      })

    return () => controller.abort()
  }, [debouncedQuery, language])

  // Browse mode. /trending and /now_playing don't accept Discover-style
  // filters (language, genre, year, rating, sort) at all, so as soon as any
  // of those are active, both rows are replaced by a single /discover/movie
  // grid carrying the filters instead — see the summary for the full
  // reasoning on why this collapses to one grid rather than keeping two.
  useEffect(() => {
    if (debouncedQuery) return
    const controller = new AbortController()

    if (!filtersActive) {
      setTrendingStatus('loading')
      getTrendingMovies(controller.signal)
        .then((movies) => {
          setTrending(movies)
          setTrendingStatus('success')
        })
        .catch((err: unknown) => {
          if (!isAbortError(err)) setTrendingStatus('error')
        })

      setNowPlayingStatus('loading')
      getNowPlayingMovies(controller.signal)
        .then((movies) => {
          setNowPlaying(movies)
          setNowPlayingStatus('success')
        })
        .catch((err: unknown) => {
          if (!isAbortError(err)) setNowPlayingStatus('error')
        })
    } else {
      setDiscoverStatus('loading')
      discoverMovies(
        {
          language,
          genreIds: filters.genreIds,
          yearFrom: filters.yearFrom ?? undefined,
          yearTo: filters.yearTo ?? undefined,
          minRating: filters.minRating ?? undefined,
          sortBy: filters.sortBy,
        },
        controller.signal,
      )
        .then((movies) => {
          setDiscoverResults(movies)
          setDiscoverStatus('success')
        })
        .catch((err: unknown) => {
          if (!isAbortError(err)) setDiscoverStatus('error')
        })
    }

    return () => controller.abort()
  }, [debouncedQuery, filtersActive, language, filters])

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

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <LanguageChips value={language} onChange={setLanguage} />
        <FilterBar filters={filters} onChange={setFilters} disabled={Boolean(debouncedQuery)} />
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1">
        {debouncedQuery ? (
          <>
            {searchStatus === 'loading' && <p className="py-20 text-center font-ui text-sm text-muted">Searching…</p>}

            {searchStatus === 'error' && (
              <div className="mx-auto max-w-md rounded-lg border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 text-center font-ui text-sm text-accent-cold">
                {searchError}
              </div>
            )}

            {searchStatus === 'success' && searchResults.length === 0 && (
              <p className="py-20 text-center font-ui text-sm text-muted">
                No results for "{debouncedQuery}". Try a different title.
              </p>
            )}

            {searchStatus === 'success' && searchResults.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {searchResults.map((movie) => (
                  <SearchResultCard key={movie.id} movie={movie} />
                ))}
              </div>
            )}
          </>
        ) : !filtersActive ? (
          <div className="flex flex-col gap-10">
            <MovieRow title="Trending This Week" status={trendingStatus} movies={trending} />
            <MovieRow title="Now Playing" status={nowPlayingStatus} movies={nowPlaying} />
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg text-text">Results</h2>

            {discoverStatus === 'loading' && <p className="py-20 text-center font-ui text-sm text-muted">Loading…</p>}

            {discoverStatus === 'error' && (
              <div className="mx-auto max-w-md rounded-lg border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 text-center font-ui text-sm text-accent-cold">
                Something went wrong loading movies.
              </div>
            )}

            {discoverStatus === 'success' && discoverResults.length === 0 && (
              <p className="py-20 text-center font-ui text-sm text-muted">No movies match these filters.</p>
            )}

            {discoverStatus === 'success' && discoverResults.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {discoverResults.map((movie) => (
                  <SearchResultCard key={movie.id} movie={movie} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
