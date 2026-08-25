import { useEffect, useState } from 'react'
import { FilterBar, DEFAULT_ADVANCED_FILTERS, hasActiveAdvancedFilters, type AdvancedFilters } from '../components/search/FilterBar'
import { DiscoverTabs } from '../components/layout/DiscoverTabs'
import { RefreshIcon } from '../components/layout/icons'
import { Page, PageHeader } from '../components/layout/Page'
import { LanguageChips } from '../components/search/LanguageChips'
import { MovieRow } from '../components/search/MovieRow'
import { SearchResultCard } from '../components/search/SearchResultCard'
import { PosterGridSkeleton } from '../components/ui/PosterGridSkeleton'
import { PullToRefresh } from '../components/ui/PullToRefresh'
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

  // Pull-to-refresh (DESIGN.md §5) and its visible tap equivalent both call
  // this — a self-contained re-fetch of whichever mode is currently
  // showing, rather than threading a shared abort-controller through the
  // three effects above (each already has its own careful race-condition
  // handling that isn't worth disturbing for this).
  async function refresh() {
    if (debouncedQuery) {
      setSearchStatus('loading')
      setSearchError(null)
      try {
        const movies = await searchMovies(debouncedQuery)
        const filtered = language === 'all' ? movies : movies.filter((m) => m.original_language === language)
        setSearchResults(filtered)
        setSearchStatus('success')
      } catch (err) {
        setSearchError(err instanceof TmdbError ? err.message : 'Something went wrong searching TMDB.')
        setSearchStatus('error')
      }
      return
    }

    if (!filtersActive) {
      setTrendingStatus('loading')
      setNowPlayingStatus('loading')
      const [trendingResult, nowPlayingResult] = await Promise.allSettled([getTrendingMovies(), getNowPlayingMovies()])
      if (trendingResult.status === 'fulfilled') {
        setTrending(trendingResult.value)
        setTrendingStatus('success')
      } else {
        setTrendingStatus('error')
      }
      if (nowPlayingResult.status === 'fulfilled') {
        setNowPlaying(nowPlayingResult.value)
        setNowPlayingStatus('success')
      } else {
        setNowPlayingStatus('error')
      }
      return
    }

    setDiscoverStatus('loading')
    try {
      const movies = await discoverMovies({
        language,
        genreIds: filters.genreIds,
        yearFrom: filters.yearFrom ?? undefined,
        yearTo: filters.yearTo ?? undefined,
        minRating: filters.minRating ?? undefined,
        sortBy: filters.sortBy,
      })
      setDiscoverResults(movies)
      setDiscoverStatus('success')
    } catch {
      setDiscoverStatus('error')
    }
  }

  return (
    <Page width="wide">
      {/* DiscoverTabs now carries the mode-specific subtitle that used to
          be a static PageHeader subtitle here (live-review fix) — keeping
          both would just repeat the same sentence twice. */}
      <PageHeader title="Discover" />

      <DiscoverTabs />

      {/* Pinned under the app bar (live-review redesign) — sticky at the
          same top-14 offset Watchlist's tabs use, so the search field is
          always reachable without scrolling back up. */}
      <div className="sticky top-14 z-30 -mx-6 -mt-4 bg-bg/80 px-6 py-2 backdrop-blur sm:-mx-10 sm:px-10 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="w-full max-w-2xl">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for a movie…"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface px-5 py-4 font-ui text-base text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-cold"
          />
        </div>
      </div>

      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <LanguageChips value={language} onChange={setLanguage} />
          </div>
          {/* Visible tap equivalent for pull-to-refresh (DESIGN.md §5). */}
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-surface hover:text-text"
          >
            <RefreshIcon />
          </button>
        </div>
        <FilterBar filters={filters} onChange={setFilters} disabled={Boolean(debouncedQuery)} />
      </div>

      <PullToRefresh onRefresh={refresh}>
      <div className="flex-1">
        {debouncedQuery ? (
          <>
            {searchStatus === 'loading' && <PosterGridSkeleton />}

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
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4">
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

            {discoverStatus === 'loading' && <PosterGridSkeleton />}

            {discoverStatus === 'error' && (
              <div className="mx-auto max-w-md rounded-lg border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 text-center font-ui text-sm text-accent-cold">
                Something went wrong loading movies.
              </div>
            )}

            {discoverStatus === 'success' && discoverResults.length === 0 && (
              <p className="py-20 text-center font-ui text-sm text-muted">No movies match these filters.</p>
            )}

            {discoverStatus === 'success' && discoverResults.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4">
                {discoverResults.map((movie) => (
                  <SearchResultCard key={movie.id} movie={movie} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      </PullToRefresh>
    </Page>
  )
}
