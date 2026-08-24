import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Section } from '../components/layout/Page'
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
  return Array.isArray(cast) ? cast.slice(0, 5).filter((member) => typeof member?.name === 'string') : []
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
  // Live slider value, lifted here so the poster below can react to it.
  const [liveScore, setLiveScore] = useState<number | null>(null)
  const [release, setRelease] = useState<PosterRelease>({ effect: null, token: 0 })
  const [retryKey, setRetryKey] = useState(0)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)

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

  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')
  const backdropUrl = tmdbImageUrl(movie.backdrop_path, 'w1280')
  const runtime = formatRuntime(movie.runtime_minutes)
  const topCast = getTopCast(movie.credits)

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero. The backdrop used to hard-cut into the page background, reading
          as two unrelated blocks stacked on each other. It now fades into --bg
          through a scrim, and the poster and title overlap that fade — the
          poster-forward treatment CLAUDE.md asks for, and what makes this read
          as a film page rather than a form. */}
      <header className="relative">
        {backdropUrl ? (
          <div className="relative aspect-[21/9] max-h-[52vh] w-full overflow-hidden bg-surface">
            <img src={backdropUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/10" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
          </div>
        ) : (
          <div className="h-28 w-full bg-surface" />
        )}

        <div className="mx-auto w-full max-w-5xl px-6 sm:px-10">
          <div className="-mt-24 flex flex-col gap-6 md:-mt-32 md:flex-row md:items-end">
            <ReactivePoster
              posterUrl={posterUrl}
              title={movie.title}
              score={liveScore}
              release={release}
              reducedMotion={reducedMotion}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
              <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-text sm:text-5xl">
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
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
        {movie.overview && (
          <p className="max-w-prose font-ui text-base leading-relaxed text-text">{movie.overview}</p>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {(!watchlistItem || watchlistItem.status === 'dropped') && (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => runAction(async () => void (await addToWatchlist(tmdbId, user!.id)))}
                className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold"
              >
                Add to Watchlist
              </button>
            )}

            {watchlistItem?.status === 'want' && (
              <button
                type="button"
                disabled={actionPending}
                onClick={() => runAction(() => markAsWatched(watchlistItem.id))}
                className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold"
              >
                Mark as Watched
              </button>
            )}

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

        {watchlistItem?.status === 'watched' && user && (
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
        )}

        {/* Trailer and cast sit side by side on wide screens. Previously every
            one of these blocks was trapped in the narrow column beside the
            poster, leaving a tall empty gutter underneath it. */}
        <div className={`grid gap-10 ${movie.trailer_key && topCast.length > 0 ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
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

          {topCast.length > 0 && (
            <Section title="Cast">
              <ul className="flex flex-col gap-2.5">
                {topCast.map((member, index) => (
                  <li key={index} className="font-ui text-sm leading-snug">
                    <span className="text-text">{member.name}</span>
                    {member.character && <span className="text-muted"> as {member.character}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <WatchProviders tmdbId={tmdbId} />
      </div>
    </div>
  )
}
