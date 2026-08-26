import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Page, PageHeader } from '../components/layout/Page'
import { TvSearchResultCard } from '../components/search/TvSearchResultCard'
import { PosterGridSkeleton } from '../components/ui/PosterGridSkeleton'
import { Spinner } from '../components/ui/Spinner'
import { fetchTvWatchlistByStatus, type TvWatchlistEntry } from '../lib/tvWatchlist'
import { searchTvShows, TmdbError, tmdbImageUrl, type TmdbSearchTv } from '../lib/tmdbClient'
import type { WatchlistStatus } from '../lib/database.types'

type Tab = Extract<WatchlistStatus, 'want' | 'watched'>
type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * My TV List — v1's watchlist screen for TV shows/anime, deliberately
 * simpler than the movie Watchlist.tsx: no swipe gestures, no long-press
 * action sheet, no decay shelf. Those are a lot of carefully-tuned
 * interaction code on a component real users touch every day; a plain
 * tap-to-detail grid is "working plain beats broken beautiful" for a
 * first cut of a brand-new content type, and can grow into gesture
 * parity later once TV usage is proven out.
 */
export default function TvWatchlist() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('want')
  const [entries, setEntries] = useState<TvWatchlistEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TmdbSearchTv[]>([])
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle')
  const [searchError, setSearchError] = useState<string | null>(null)
  // Bumped by TvSearchResultCard's onAdded — see the fetch effect below for
  // why this exists (real-device testing found the Want grid going stale
  // after an add via search).
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(handle)
  }, [query])

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
    searchTvShows(debouncedQuery, controller.signal)
      .then((shows) => {
        setSearchResults(shows)
        setSearchStatus('success')
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setSearchError(err instanceof TmdbError ? err.message : 'Something went wrong searching TMDB.')
        setSearchStatus('error')
      })
    return () => controller.abort()
  }, [debouncedQuery])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setStatus('loading')
    fetchTvWatchlistByStatus(user.id, tab)
      .then((rows) => {
        if (!cancelled) {
          setEntries(rows)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // refreshToken deliberately included: this effect otherwise only
    // depends on [user, tab], so adding a show via the search box above
    // (which doesn't touch either) left the grid showing stale ("Nothing
    // queued yet") data even after a genuinely successful add — found via
    // real-device testing, not a hypothetical.
  }, [user, tab, refreshToken])

  return (
    <Page>
      <PageHeader title="My TV List" subtitle="Shows and series you've saved or watched." />

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search for a show, series, or anime…"
        className="w-full max-w-2xl rounded-lg border border-border bg-surface px-5 py-4 font-ui text-base text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-cold"
      />

      {debouncedQuery ? (
        <div className="flex-1">
          {searchStatus === 'loading' && <PosterGridSkeleton />}

          {searchStatus === 'error' && (
            <div className="mx-auto max-w-md rounded-lg border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 text-center font-ui text-sm text-accent-cold">
              {searchError}
            </div>
          )}

          {searchStatus === 'success' && searchResults.length === 0 && (
            <p className="py-20 text-center font-ui text-sm text-muted">No results for "{debouncedQuery}". Try a different title.</p>
          )}

          {searchStatus === 'success' && searchResults.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4">
              {searchResults.map((show) => (
                <TvSearchResultCard key={show.id} show={show} onAdded={() => setRefreshToken((t) => t + 1)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
      <div role="tablist" aria-label="TV list" className="flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
        {(['want', 'watched'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 font-ui text-sm font-medium transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
              tab === id ? 'bg-accent-warm text-bg' : 'text-muted hover:text-text'
            }`}
          >
            {id === 'want' ? 'Want to Watch' : 'Watched'}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Loading your TV list" />
        </div>
      )}

      {status === 'error' && <p className="font-ui text-sm text-accent-cold">Couldn't load your TV list.</p>}

      {status === 'ready' && entries.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-9 py-16 text-center">
          <p className="font-display text-lg font-semibold text-text">
            {tab === 'want' ? 'Nothing queued yet' : 'Nothing watched yet'}
          </p>
          <p className="max-w-sm font-ui text-sm text-muted">
            Search for a show or series and add it to your list to see it here.
          </p>
          <Link to="/search" className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold">
            Search
          </Link>
        </div>
      )}

      {status === 'ready' && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4">
          {entries.map((entry) => {
            const posterUrl = tmdbImageUrl(entry.show.poster_path, 'w342')
            return (
              <Link key={entry.item.id} to={`/tv/${entry.item.tmdb_id}`} className="flex flex-col gap-1">
                <div className="aspect-[2/3] overflow-hidden rounded-poster bg-surface">
                  {posterUrl ? (
                    <img src={posterUrl} alt={entry.show.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center font-ui text-[11px] text-muted">
                      {entry.show.name}
                    </div>
                  )}
                </div>
                <p className="line-clamp-2 min-h-[2.5em] font-ui text-[13px] leading-[1.25] font-semibold text-text">
                  {entry.show.name}
                </p>
                {entry.score !== null && <p className="font-mono text-[11px] text-accent-warm">{entry.score}/10</p>}
              </Link>
            )
          })}
        </div>
      )}
        </>
      )}
    </Page>
  )
}
