import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Section } from '../components/layout/Page'
import { BottomSheet } from '../components/ui/BottomSheet'
import { RatingPanel } from '../components/rating/RatingPanel'
import { Spinner } from '../components/ui/Spinner'
import type { Json, TvCache, TvWatchlistItem } from '../lib/database.types'
import type { Rating } from '../lib/database.types'
import { formatRuntime } from '../lib/format'
import { verdictFor } from '../lib/ratingScale'
import { saveTvReasonTags, saveTvReviewText, saveTvScore, getTvRating } from '../lib/tvRatings'
import { TmdbError, tmdbImageUrl } from '../lib/tmdbClient'
import {
  addToTvWatchlist,
  getOrCacheTvShow,
  getTvWatchlistItem,
  markTvAsWatched,
  removeFromTvWatchlist,
} from '../lib/tvWatchlist'

/**
 * TV/web-series/anime detail screen — CLAUDE.md's v1 Duo... no, v1 TV
 * scope: search + watchlist + rating only, adapted from MovieDetail.tsx's
 * structure rather than generalizing that file directly. A genuinely new,
 * standalone route, not a shared component with MovieDetail, on purpose:
 * MovieDetail is exercised by every current user every day, and a bug
 * introduced while generalizing it for TV would put that at risk for no
 * reason a brand-new, low-traffic screen doesn't already avoid on its own.
 *
 * Deliberately simpler than MovieDetail in two ways for v1:
 * - No ReactivePoster reuse (the poster-reacts-to-rating hero animation) —
 *   a plain poster header instead. That component has no mediaType-aware
 *   shared-element id, and wiring one in was judged not worth touching a
 *   component MovieDetail depends on for a first cut of TV support.
 * - No shared-element (layoutId) transition from search/watchlist grids
 *   into this screen, for the same reason.
 * RatingPanel itself, though, is fully reused — it already worked here
 * unchanged given tv_ratings' injectable save-functions (see RatingPanel's
 * own prop doc comments).
 */

interface StoredCastMember {
  name: string
  character?: string
}

function getTopCast(credits: Json | null): StoredCastMember[] {
  const cast = (credits as { cast?: StoredCastMember[] } | null)?.cast
  return Array.isArray(cast) ? cast.slice(0, 8).filter((member) => typeof member?.name === 'string') : []
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-6 text-center">{children}</div>
}

type ScreenStatus = 'loading' | 'not_found' | 'error' | 'ready'

export default function TvDetail() {
  const { tmdbId: tmdbIdParam } = useParams<{ tmdbId: string }>()
  const { user } = useAuth()
  const tmdbId = Number(tmdbIdParam)
  const isValidId = Number.isFinite(tmdbId) && tmdbId > 0

  const [screenStatus, setScreenStatus] = useState<ScreenStatus>('loading')
  const [show, setShow] = useState<TvCache | null>(null)
  const [watchlistItem, setWatchlistItem] = useState<TvWatchlistItem | null>(null)
  const [rating, setRating] = useState<Rating | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [ratingSheetOpen, setRatingSheetOpen] = useState(false)

  useEffect(() => {
    if (!isValidId) {
      setScreenStatus('not_found')
      return
    }
    if (!user) return

    let cancelled = false
    setScreenStatus('loading')

    Promise.all([getOrCacheTvShow(tmdbId), getTvWatchlistItem(user.id, tmdbId), getTvRating(user.id, tmdbId)])
      .then(([showData, item, ratingData]) => {
        if (cancelled) return
        setShow(showData)
        setWatchlistItem(item)
        setRating(ratingData)
        setScreenStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setScreenStatus(err instanceof TmdbError && err.status === 404 ? 'not_found' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [user, tmdbId, isValidId, retryKey])

  async function runAction(action: () => Promise<void>) {
    if (actionPending || !user) return
    setActionPending(true)
    setActionError(null)
    try {
      await action()
      setWatchlistItem(await getTvWatchlistItem(user.id, tmdbId))
    } catch {
      setActionError('Something went wrong. Try again.')
    } finally {
      setActionPending(false)
    }
  }

  if (screenStatus === 'loading') {
    return (
      <CenteredMessage>
        <Spinner />
      </CenteredMessage>
    )
  }

  if (screenStatus === 'not_found') {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-3">
          <p className="font-ui text-sm text-muted">Show not found.</p>
          <Link to="/search" className="font-ui text-sm text-accent-cold underline">
            Back to Search
          </Link>
        </div>
      </CenteredMessage>
    )
  }

  if (screenStatus === 'error') {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-3">
          <p className="font-ui text-sm text-accent-cold">Couldn't load this show.</p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-lg border border-border px-4 py-2 font-ui text-sm text-text"
          >
            Retry
          </button>
        </div>
      </CenteredMessage>
    )
  }

  if (!show) return null

  const posterUrl = tmdbImageUrl(show.poster_path, 'w500')
  const runtime = formatRuntime(show.episode_run_minutes)
  const topCast = getTopCast(show.credits)

  const primaryAction =
    !watchlistItem || watchlistItem.status === 'dropped'
      ? { label: 'Add to Watchlist', onClick: () => runAction(async () => void (await addToTvWatchlist(tmdbId, user!.id))) }
      : watchlistItem.status === 'want'
        ? { label: 'Mark as Watched', onClick: () => runAction(() => markTvAsWatched(watchlistItem.id)) }
        : {
            label: rating ? `Your rating: ${rating.score}/10 · ${verdictFor(rating.score)}` : 'Rate this show',
            onClick: () => setRatingSheetOpen(true),
          }

  return (
    <div className="flex min-h-screen flex-col pb-28 lg:pb-14">
      <header className="relative aspect-[2/3] max-h-[70vh] w-full overflow-hidden bg-surface sm:aspect-[16/9]">
        {posterUrl ? (
          <img src={posterUrl} alt={show.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center font-ui text-sm text-muted">
            {show.name}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/75 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-10 sm:pb-10">
          <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent-warm">TV / Series</span>
            <h1 className="font-display text-3xl leading-[1.05] font-bold tracking-tight text-text sm:text-5xl">
              {show.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs tracking-wide text-muted uppercase">
              <span>{show.first_air_year ?? '—'}</span>
              {runtime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{runtime}/ep</span>
                </>
              )}
              {typeof show.tmdb_rating === 'number' && show.tmdb_rating > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-accent-warm">TMDB {show.tmdb_rating.toFixed(1)}</span>
                </>
              )}
            </div>

            {show.genres && show.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {show.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-border bg-surface/70 px-3 py-1 font-ui text-xs text-muted backdrop-blur-sm"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
        {show.overview && <p className="max-w-prose font-ui text-base leading-relaxed text-text">{show.overview}</p>}

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={actionPending}
              onClick={primaryAction.onClick}
              className="btn-hero hidden rounded-full px-6 py-3 font-ui text-sm font-semibold lg:inline-flex"
            >
              {primaryAction.label}
            </button>

            {(watchlistItem?.status === 'want' || watchlistItem?.status === 'watched') && (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => runAction(() => removeFromTvWatchlist(watchlistItem.id))}
                className="rounded-full border border-accent-cold/40 bg-accent-cold/10 px-6 py-3 font-ui text-sm text-accent-cold transition-[background-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-cold/20 active:scale-[0.97] disabled:opacity-60"
              >
                Remove from list
              </button>
            )}
          </div>

          {actionError && <p className="font-ui text-xs text-accent-cold">{actionError}</p>}
        </div>

        {show.trailer_key && (
          <Section title="Trailer">
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface">
              <iframe
                src={`https://www.youtube.com/embed/${show.trailer_key}`}
                title={`${show.name} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </Section>
        )}

        {topCast.length > 0 && (
          <Section title="Cast">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {topCast.map((member, index) => (
                <div
                  key={index}
                  className="flex w-40 shrink-0 flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5"
                >
                  <span className="truncate font-ui text-sm font-medium text-text" title={member.name}>
                    {member.name}
                  </span>
                  {member.character && (
                    <span className="truncate font-ui text-xs text-muted" title={member.character}>
                      {member.character}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div
        className="fixed inset-x-0 z-30 border-t border-border bg-bg/90 px-6 py-3 backdrop-blur lg:hidden"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          disabled={actionPending}
          onClick={primaryAction.onClick}
          className="btn-hero w-full rounded-full py-3.5 font-ui text-sm font-semibold disabled:opacity-60"
        >
          {primaryAction.label}
        </button>
      </div>

      {watchlistItem?.status === 'watched' && user && (
        <BottomSheet open={ratingSheetOpen} onClose={() => setRatingSheetOpen(false)} title="Rate this show" maxHeightVh={60}>
          <RatingPanel
            tmdbId={tmdbId}
            userId={user.id}
            movieTitle={show.name}
            posterPath={show.poster_path}
            existingRating={rating}
            onScoreChange={() => {}}
            onRelease={() => {}}
            onRatingSaved={setRating}
            saveScoreFn={saveTvScore}
            saveReasonTagsFn={saveTvReasonTags}
            saveReviewTextFn={saveTvReviewText}
          />
        </BottomSheet>
      )}
    </div>
  )
}
