import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { MovieCache } from '../../lib/database.types'
import { formatRuntime } from '../../lib/format'
import { tmdbImageUrl } from '../../lib/tmdbClient'

export type PickSource = 'watchlist' | 'catalogue'
export type ResultActionState = 'idle' | 'pending' | 'added' | 'watched' | 'error'

interface ResultCardProps {
  movie: MovieCache
  reason: string
  coldStart: boolean
  source: PickSource
  actionState: ResultActionState
  /** Changes on every swap so the card replays its entrance for a new film. */
  swapKey: number
  reducedMotion: boolean
  onAdd: () => void
  onMarkWatched: () => void
  onNotThisOne: () => void
}

/**
 * The single confident answer. CLAUDE.md: "Pick For Me returns exactly one
 * primary result. Never a list. This is the product thesis."
 *
 * Live-review redesign: fills the screen with one poster-led answer rather
 * than sitting as a card in the middle of the viewport — a full-bleed
 * poster hero (the same visual language as Movie Detail's, not the same
 * component: this poster isn't a shared-element transition target, it just
 * appeared) with title/reason/actions on and below its scrim. Nothing about
 * it should read as "one of several".
 */
export function ResultCard({
  movie,
  reason,
  coldStart,
  source,
  actionState,
  swapKey,
  reducedMotion,
  onAdd,
  onMarkWatched,
  onNotThisOne,
}: ResultCardProps) {
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w500')
  const runtime = formatRuntime(movie.runtime_minutes)
  const settled = actionState === 'added' || actionState === 'watched'

  return (
    <motion.article
      key={swapKey}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full flex-col"
    >
      <div className="relative aspect-[2/3] max-h-[65vh] w-full overflow-hidden bg-surface">
        {posterUrl ? (
          <img src={posterUrl} alt={movie.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center font-ui text-sm text-muted">
            {movie.title}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/75 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-10 sm:pb-8">
          <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs uppercase tracking-widest text-accent-warm">Tonight's pick</span>
              {coldStart && (
                <span className="rounded-full border border-border bg-bg/70 px-2.5 py-0.5 font-ui text-xs text-muted backdrop-blur-sm">
                  Learning your taste
                </span>
              )}
              <span className="rounded-full border border-border bg-bg/70 px-2.5 py-0.5 font-ui text-xs text-muted backdrop-blur-sm">
                {source === 'watchlist' ? 'From your watchlist' : 'Not on your list yet'}
              </span>
            </div>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-5xl">{movie.title}</h2>
            <div className="flex flex-wrap items-center gap-2 font-ui text-sm text-muted">
              <span>{movie.release_year ?? '—'}</span>
              {runtime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{runtime}</span>
                </>
              )}
              {movie.genres && movie.genres.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0 truncate">{movie.genres.slice(0, 3).join(', ')}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6 sm:px-10">
        {/* The reason is the product, so it's set larger than the metadata
            and given its own quiet surface rather than reading as caption. */}
        <p className="rounded-lg border border-border bg-surface px-5 py-4 font-ui text-base leading-relaxed text-text sm:text-lg">
          {reason}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {source === 'catalogue' && actionState !== 'added' && (
            <button
              type="button"
              onClick={onAdd}
              disabled={actionState === 'pending'}
              className="btn-hero rounded-xl px-5 py-3 font-ui text-sm font-semibold"
            >
              {actionState === 'pending' ? 'Adding…' : 'Add to Watchlist'}
            </button>
          )}

          {source === 'watchlist' && actionState !== 'watched' && (
            <button
              type="button"
              onClick={onMarkWatched}
              disabled={actionState === 'pending'}
              className="btn-hero rounded-xl px-5 py-3 font-ui text-sm font-semibold"
            >
              {actionState === 'pending' ? 'Saving…' : 'Mark as Watched'}
            </button>
          )}

          {actionState === 'added' && (
            <span className="rounded-xl border border-accent-warm/40 bg-accent-warm/10 px-5 py-3 font-ui text-sm font-semibold text-accent-warm">
              Added to your watchlist ✓
            </span>
          )}

          {actionState === 'watched' && (
            <span className="rounded-xl border border-accent-warm/40 bg-accent-warm/10 px-5 py-3 font-ui text-sm font-semibold text-accent-warm">
              Marked as watched ✓
            </span>
          )}

          <Link
            to={`/movie/${movie.tmdb_id}`}
            className="rounded-full border border-border px-6 py-3 font-ui text-sm text-text transition-[border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-muted/40 active:scale-[0.97]"
          >
            {actionState === 'watched' ? 'Rate it' : 'Full details'}
          </Link>

          {/* Always available until they act on it — rejecting the last
              option is itself a meaningful answer, not a dead end. */}
          {!settled && (
            <button
              type="button"
              onClick={onNotThisOne}
              disabled={actionState === 'pending'}
              className="font-ui text-sm text-muted underline underline-offset-4 transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-text disabled:opacity-60"
            >
              Not this one
            </button>
          )}
        </div>

        {actionState === 'error' && <p className="font-ui text-sm text-accent-cold">That didn't save. Try again.</p>}
      </div>
    </motion.article>
  )
}
