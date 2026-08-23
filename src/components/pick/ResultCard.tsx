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
 * So this deliberately shares no visual DNA with SearchResultCard or
 * WatchlistCard — no 2:3 grid tile, no truncated title, no small type. It's
 * a wide single-column-on-mobile / two-column-on-desktop panel with a bloom
 * behind it, display-size title, and the reason set larger than the
 * metadata. Nothing about it should read as "one of several".
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
      initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative isolate mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-accent-warm/30 bg-surface p-6 sm:p-8"
    >
      {/* One large soft bloom, no fine detail — survives video compression. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_0%,var(--accent-warm)_0%,transparent_65%)] opacity-[0.13]"
      />

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-56">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-bg shadow-2xl">
            {posterUrl ? (
              <img src={posterUrl} alt={movie.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center font-ui text-sm text-muted">
                {movie.title}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xs uppercase tracking-widest text-accent-warm">Tonight's pick</span>
            {coldStart && (
              // Stated, not apologised for. The reason text itself already
              // says we don't know their taste yet; this just labels why.
              <span className="rounded-full border border-muted/30 px-2.5 py-0.5 font-ui text-xs text-muted">
                Learning your taste
              </span>
            )}
            <span className="rounded-full border border-muted/30 px-2.5 py-0.5 font-ui text-xs text-muted">
              {source === 'watchlist' ? 'From your watchlist' : 'Not on your list yet'}
            </span>
          </div>

          <div>
            <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">{movie.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-ui text-sm text-muted">
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

          {/* The reason is the product, so it's set larger than the metadata
              and given its own quiet surface rather than reading as caption. */}
          <p className="rounded-2xl border border-muted/15 bg-bg/60 px-5 py-4 font-ui text-base leading-relaxed text-text sm:text-lg">
            {reason}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {source === 'catalogue' && actionState !== 'added' && (
              <button
                type="button"
                onClick={onAdd}
                disabled={actionState === 'pending'}
                className="rounded-xl bg-accent-warm px-5 py-3 font-ui text-sm font-semibold text-bg transition-opacity duration-[var(--transition-fast)] disabled:opacity-60"
              >
                {actionState === 'pending' ? 'Adding…' : 'Add to Watchlist'}
              </button>
            )}

            {source === 'watchlist' && actionState !== 'watched' && (
              <button
                type="button"
                onClick={onMarkWatched}
                disabled={actionState === 'pending'}
                className="rounded-xl bg-accent-warm px-5 py-3 font-ui text-sm font-semibold text-bg transition-opacity duration-[var(--transition-fast)] disabled:opacity-60"
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
              className="rounded-xl border border-muted/25 px-5 py-3 font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] hover:border-muted/50"
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
                className="font-ui text-sm text-muted underline underline-offset-4 transition-colors duration-[var(--transition-fast)] hover:text-text disabled:opacity-60"
              >
                Not this one
              </button>
            )}
          </div>

          {actionState === 'error' && (
            <p className="font-ui text-sm text-accent-cold">That didn't save. Try again.</p>
          )}
        </div>
      </div>
    </motion.article>
  )
}
