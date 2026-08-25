import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Section } from '../components/layout/Page'
import { BottomSheet } from '../components/ui/BottomSheet'
import { RatingPanel } from '../components/rating/RatingPanel'
import { ReactivePoster, type PosterRelease } from '../components/rating/ReactivePoster'
import { WatchProviders } from '../components/movie/WatchProviders'
import { Spinner } from '../components/ui/Spinner'
import type { Json, MovieCache, Rating, WatchlistItem } from '../lib/database.types'
import { formatRuntime } from '../lib/format'
import { getRating } from '../lib/ratings'
import { releaseEffectFor, verdictFor } from '../lib/ratingScale'
import { shareRating } from '../lib/share'
import { TmdbError, tmdbImageUrl } from '../lib/tmdbClient'
import { addToWatchlist, getOrCacheMovie, getWatchlistItem, markAsWatched, removeFromWatchlist } from '../lib/watchlist'
import { useTheme } from '../theme/ThemeProvider'

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

export default function MovieDetail() {
  const { tmdbId: tmdbIdParam } = useParams<{ tmdbId: string }>()
  const { user } = useAuth()
  const tmdbId = Number(tmdbIdParam)
  const isValidId = Number.isFinite(tmdbId) && tmdbId > 0

  const { reducedMotion } = useTheme()
  const [screenStatus, setScreenStatus] = useState<ScreenStatus>('loading')
  const [movie, setMovie] = useState<MovieCache | null>(null)
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null)
  const [rating, setRating] = useState<Rating | null>(null)
  // Live slider value, lifted here so the poster hero above can react to
  // it — only meaningful while the rating bottom sheet is open.
  const [liveScore, setLiveScore] = useState<number | null>(null)
  const [release, setRelease] = useState<PosterRelease>({ effect: null, token: 0 })
  const [retryKey, setRetryKey] = useState(0)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [ratingSheetOpen, setRatingSheetOpen] = useState(false)

  useEffect(() => {
    if (!isValidId) {
      setScreenStatus('not_found')
      return
    }
    if (!user) return

    let cancelled = false
    setScreenStatus('loading')

    // The rating is fetched up front rather than after the status resolves,
    // so the poster's first paint already reflects an existing score
    // instead of visibly transitioning into it.
    Promise.all([getOrCacheMovie(tmdbId), getWatchlistItem(user.id, tmdbId), getRating(user.id, tmdbId)])
      .then(([movieData, item, ratingData]) => {
        if (cancelled) return
        setMovie(movieData)
        setWatchlistItem(item)
        setRating(ratingData)
        setLiveScore(item?.status === 'watched' ? (ratingData?.score ?? null) : null)
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

  async function handleShare() {
    if (!movie || !rating) return
    const outcome = await shareRating({
      title: movie.title,
      year: movie.release_year,
      score: rating.score,
      verdict: verdictFor(rating.score),
    })
    if (outcome === 'copied') {
      setShareMessage('Copied!')
      setTimeout(() => setShareMessage(null), 2500)
    } else if (outcome === 'failed') {
      setShareMessage("Couldn't share — try again")
      setTimeout(() => setShareMessage(null), 2500)
    }
    // 'shared' and 'cancelled' need no message — the native share sheet (or
    // the user backing out of it) is already its own feedback.
  }

  async function runAction(action: () => Promise<void>) {
    if (actionPending || !user) return
    setActionPending(true)
    setActionError(null)
    try {
      await action()
      setWatchlistItem(await getWatchlistItem(user.id, tmdbId))
    } catch {
      setActionError("Something went wrong. Try again.")
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
          <p className="font-ui text-sm text-muted">Movie not found.</p>
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
          <p className="font-ui text-sm text-accent-cold">Couldn't load this movie.</p>
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

  if (!movie) return null

  const posterUrl = tmdbImageUrl(movie.poster_path, 'w500')
  const runtime = formatRuntime(movie.runtime_minutes)
  const topCast = getTopCast(movie.credits)

  // The one pinned .btn-hero action (live-review redesign) — mutually
  // exclusive with the watchlist status, so there's only ever one. Once
  // watched, rating replaces add/mark-watched as the primary thing left to
  // do, and opens the bottom sheet rather than rendering inline.
  const primaryAction =
    !watchlistItem || watchlistItem.status === 'dropped'
      ? { label: 'Add to Watchlist', onClick: () => runAction(async () => void (await addToWatchlist(tmdbId, user!.id))) }
      : watchlistItem.status === 'want'
        ? { label: 'Mark as Watched', onClick: () => runAction(() => markAsWatched(watchlistItem.id)) }
        : {
            label: rating ? `Your rating: ${rating.score}/10 · ${verdictFor(rating.score)}` : 'Rate this film',
            onClick: () => setRatingSheetOpen(true),
          }

  return (
    <div className="flex min-h-screen flex-col pb-28 lg:pb-14">
      {/* Full-bleed poster hero with a gradient scrim into --bg, title/
          metadata overlaid on the scrim (live-review redesign — this used
          to be a 21:9 backdrop with a small poster overlapping below it).
          The poster itself is ReactivePoster, which carries the shared
          layoutId transition from wherever the user tapped in. */}
      <header className="relative">
        <ReactivePoster
          tmdbId={tmdbId}
          posterUrl={posterUrl}
          title={movie.title}
          score={liveScore}
          release={release}
          reducedMotion={reducedMotion}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-10 sm:pb-10">
          <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-3">
            <h1 className="font-display text-3xl leading-[1.05] font-bold tracking-tight text-text sm:text-5xl">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs tracking-wide text-muted uppercase">
              <span>{movie.release_year ?? '—'}</span>
              {runtime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{runtime}</span>
                </>
              )}
              {typeof movie.tmdb_rating === 'number' && movie.tmdb_rating > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-accent-warm">TMDB {movie.tmdb_rating.toFixed(1)}</span>
                </>
              )}
            </div>

            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {movie.genres.map((genre) => (
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
        {movie.overview && (
          <p className="max-w-prose font-ui text-base leading-relaxed text-text">{movie.overview}</p>
        )}

        {/* Secondary actions — the one primary action lives in the pinned
            bar below (mobile) / inline button (desktop) instead. */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Desktop has no pinned bar to clear, so the primary action
                also renders inline here — same `primaryAction` data, not a
                second implementation of it. */}
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
                onClick={() => runAction(() => removeFromWatchlist(watchlistItem.id))}
                className="rounded-full border border-accent-cold/40 bg-accent-cold/10 px-6 py-3 font-ui text-sm text-accent-cold transition-[background-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-cold/20 active:scale-[0.97] disabled:opacity-60"
              >
                Remove from list
              </button>
            )}

            {rating && (
              <button
                type="button"
                onClick={() => void handleShare()}
                className="rounded-full border border-border px-6 py-3 font-ui text-sm text-text transition-[border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40 active:scale-[0.97]"
              >
                Share rating
              </button>
            )}
            {shareMessage && <span className="font-ui text-xs text-muted">{shareMessage}</span>}
          </div>

          {actionError && <p className="font-ui text-xs text-accent-cold">{actionError}</p>}
        </div>

        {movie.trailer_key && (
          <Section title="Trailer">
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface">
              <iframe
                src={`https://www.youtube.com/embed/${movie.trailer_key}`}
                title={`${movie.title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </Section>
        )}

        {/* Cast and Watch Providers are horizontally scrollable rows now
            (live-review redesign) rather than a stacked wall of full-width
            blocks — same treatment MovieRow already uses for Trending/Now
            Playing on Search. */}
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

        <WatchProviders tmdbId={tmdbId} />
      </div>

      {/* The one pinned .btn-hero action, mobile only — sits above the
          TabBar (64px + safe-area, already reserved by AppShell's own
          bottom padding on <main>) rather than inline in the page body. */}
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

      {/* Rating panel — a bottom sheet now instead of sitting inline in the
          page body (live-review redesign). RatingPanel itself is
          completely untouched: same save-on-release behaviour, same
          cold->warm colour interpolation, same why-chips/review note.
          Capped at 60vh (vs. the default ~85vh) so the reactive poster
          hero stays visible above it while rating — the verdict word,
          score, slider and pulse line all fit well within that; why-chips
          and the review note (only shown after a first save) can scroll
          if needed rather than force the sheet taller. */}
      {watchlistItem?.status === 'watched' && user && (
        <BottomSheet
          open={ratingSheetOpen}
          onClose={() => setRatingSheetOpen(false)}
          title="Rate this film"
          maxHeightVh={60}
        >
          <RatingPanel
            tmdbId={tmdbId}
            userId={user.id}
            existingRating={rating}
            onScoreChange={setLiveScore}
            onRelease={(score) =>
              setRelease((prev) => ({ effect: releaseEffectFor(score), token: prev.token + 1 }))
            }
            onRatingSaved={setRating}
          />
        </BottomSheet>
      )}
    </div>
  )
}
