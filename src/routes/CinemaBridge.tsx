import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { SourceMoviePicker } from '../components/bridge/SourceMoviePicker'
import { TargetChips } from '../components/bridge/TargetChips'
import { DiscoverTabs } from '../components/layout/DiscoverTabs'
import type { MovieCache } from '../lib/database.types'
import { BridgeError, requestBridge, type BridgeMatch, type BridgeResult } from '../lib/bridgeClient'
import { formatRuntime } from '../lib/format'
import { posterLayoutId } from '../lib/sharedElement'
import { searchMovies, tmdbImageUrl, type TmdbSearchMovie } from '../lib/tmdbClient'
import { addToWatchlist, getOrCacheMovie } from '../lib/watchlist'

type Phase = 'form' | 'loading' | 'result' | 'no_matches' | 'error'
type AddState = 'idle' | 'loading' | 'added' | 'error'

interface ResolvedMatch extends BridgeMatch {
  movie: MovieCache
}

// DESIGN.md's own example ("Drishyam -> its Korean equivalent") plus two
// more varied ones, so the empty form state is never half-empty — tapping
// one resolves the title via TMDB search, fills the form, and submits.
const EXAMPLE_BRIDGES = [
  { title: 'Drishyam', target: 'Korean' },
  { title: 'Parasite', target: 'Bollywood' },
  { title: 'Whiplash', target: 'Tamil' },
] as const

export default function CinemaBridge() {
  const { user } = useAuth()
  const [sourceMovie, setSourceMovie] = useState<TmdbSearchMovie | null>(null)
  const [target, setTarget] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(true)
  const [matches, setMatches] = useState<ResolvedMatch[]>([])
  const [addState, setAddState] = useState<Record<number, AddState>>({})
  const [exampleLoading, setExampleLoading] = useState<string | null>(null)

  const canSubmit = Boolean(sourceMovie) && target.trim().length > 0

  // Accepts explicit overrides so an example-bridge tap can submit
  // immediately with the film/target it just resolved, rather than reading
  // sourceMovie/target from state that setSourceMovie/setTarget haven't
  // actually applied yet (React state updates aren't synchronous).
  async function handleSubmit(overrideSource?: TmdbSearchMovie, overrideTarget?: string) {
    const source = overrideSource ?? sourceMovie
    const targetValue = overrideTarget ?? target
    if (!source || !targetValue.trim() || !user) return
    setPhase('loading')
    setErrorMessage(null)
    setAddState({})

    try {
      const result = await requestBridge({ source_tmdb_id: source.id, target: targetValue.trim() })
      if ('kind' in result) {
        setErrorMessage((result as { message: string }).message)
        setPhase('no_matches')
        return
      }

      const bridgeResult = result as BridgeResult
      const resolved = await Promise.all(
        bridgeResult.matches.map(async (match) => {
          try {
            const movie = await getOrCacheMovie(match.tmdb_id)
            return { ...match, movie }
          } catch {
            return null
          }
        }),
      )
      const clean = resolved.filter((r): r is ResolvedMatch => r !== null)

      if (clean.length === 0) {
        setErrorMessage("Couldn't load the matches that came back. Try again.")
        setRetryable(true)
        setPhase('error')
        return
      }

      setMatches(clean)
      setPhase('result')
    } catch (err) {
      setErrorMessage(err instanceof BridgeError ? err.message : 'Something went wrong.')
      setRetryable(err instanceof BridgeError ? err.retryable : true)
      setPhase('error')
    }
  }

  async function handleExampleTap(example: (typeof EXAMPLE_BRIDGES)[number]) {
    if (exampleLoading) return
    setExampleLoading(example.title)
    try {
      const results = await searchMovies(example.title)
      const movie = results[0]
      if (!movie) return
      setSourceMovie(movie)
      setTarget(example.target)
      await handleSubmit(movie, example.target)
    } finally {
      setExampleLoading(null)
    }
  }

  async function handleAdd(tmdbId: number) {
    if (!user || addState[tmdbId] === 'loading') return
    setAddState((prev) => ({ ...prev, [tmdbId]: 'loading' }))
    try {
      await addToWatchlist(tmdbId, user.id)
      setAddState((prev) => ({ ...prev, [tmdbId]: 'added' }))
    } catch {
      setAddState((prev) => ({ ...prev, [tmdbId]: 'error' }))
    }
  }

  function startOver() {
    setPhase('form')
    setSourceMovie(null)
    setTarget('')
    setMatches([])
    setErrorMessage(null)
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-10 px-6 py-10 sm:px-10 sm:py-14">
      {/* DiscoverTabs' own subtitle now carries this line (live-review
          fix) — keeping a static duplicate here just repeated it. */}
      <div className="w-full max-w-xl">
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-text sm:text-4xl">Cinema Bridge</h1>
      </div>

      <DiscoverTabs />

      {(phase === 'form' || phase === 'loading') && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) void handleSubmit()
          }}
          className="flex w-full max-w-xl flex-col gap-6"
        >
          <div className="flex flex-col gap-2">
            <label className="font-ui text-sm font-semibold text-text">Starting from</label>
            <SourceMoviePicker selected={sourceMovie} onSelect={setSourceMovie} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-ui text-sm font-semibold text-text">Find the equivalent in</label>
            <TargetChips value={target} onChange={setTarget} />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || phase === 'loading'}
            className="btn-hero rounded-xl px-6 py-3.5 font-display text-base disabled:opacity-40"
          >
            {phase === 'loading' ? 'Finding the bridge…' : 'Find the equivalent'}
          </button>
        </form>
      )}

      {/* Tappable example bridges so the empty form is never half-empty
          (DESIGN.md §8's own "Drishyam -> its Korean equivalent" example,
          plus two more) — hidden once a source film is picked, since at
          that point they'd just be redundant with the form above. */}
      {phase === 'form' && !sourceMovie && (
        <div className="flex w-full max-w-xl flex-col gap-3">
          <p className="font-ui text-xs text-muted">Or try one of these</p>
          <div className="flex flex-col gap-2">
            {EXAMPLE_BRIDGES.map((example) => (
              <button
                key={example.title}
                type="button"
                onClick={() => void handleExampleTap(example)}
                disabled={Boolean(exampleLoading)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40 disabled:opacity-60"
              >
                <span>
                  {example.title} <span className="text-muted">→ its {example.target} equivalent</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-muted">
                  {exampleLoading === example.title ? '…' : '→'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="flex w-full max-w-2xl flex-col gap-4">
          {matches.map((match) => {
            const sourcePosterUrl = sourceMovie ? tmdbImageUrl(sourceMovie.poster_path, 'w185') : null
            const resultPosterUrl = tmdbImageUrl(match.movie.poster_path, 'w185')
            const runtime = formatRuntime(match.movie.runtime_minutes)
            const state = addState[match.tmdb_id] ?? 'idle'
            return (
              // Side-by-side comparison (live-review redesign) rather than
              // a single poster next to a text block — source and result
              // posters bookending the reasoning is the actual point of a
              // "bridge", so the layout should read as one now.
              <div
                key={match.tmdb_id}
                className="grid grid-cols-[1fr_1.3fr_1fr] items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-bg">
                    {sourcePosterUrl ? (
                      <img src={sourcePosterUrl} alt={sourceMovie?.title ?? ''} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-1 text-center font-ui text-[10px] text-muted">
                        {sourceMovie?.title}
                      </div>
                    )}
                  </div>
                  <span className="truncate text-center font-ui text-[11px] text-muted-subtle" title={sourceMovie?.title}>
                    {sourceMovie?.title}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 pt-4 text-center">
                  <span aria-hidden="true" className="font-display text-lg text-accent-warm">
                    →
                  </span>
                  <p className="font-ui text-xs leading-relaxed text-muted">{match.reason}</p>
                  <div className="mt-1 flex flex-col items-center gap-2">
                    {state === 'added' ? (
                      <span className="font-ui text-xs font-semibold text-accent-warm">Added ✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleAdd(match.tmdb_id)}
                        disabled={state === 'loading'}
                        className="rounded-full border border-accent-warm/40 bg-accent-warm/10 px-3 py-1.5 font-ui text-xs font-semibold text-accent-warm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/20 disabled:opacity-60"
                      >
                        {state === 'loading' ? 'Adding…' : state === 'error' ? 'Retry add' : 'Add'}
                      </button>
                    )}
                  </div>
                </div>

                <Link to={`/movie/${match.tmdb_id}`} className="group flex flex-col gap-1.5">
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-bg transition-transform duration-[var(--transition-base)] ease-[var(--ease-standard)] group-hover:-translate-y-1">
                    {resultPosterUrl ? (
                      <motion.img
                        layoutId={posterLayoutId(match.tmdb_id)}
                        src={resultPosterUrl}
                        alt={match.movie.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-1 text-center font-ui text-[10px] text-muted">
                        {match.movie.title}
                      </div>
                    )}
                  </div>
                  <span className="truncate text-center font-ui text-[11px] text-text" title={match.movie.title}>
                    {match.movie.title}
                  </span>
                  {runtime && (
                    <span className="text-center font-mono text-[10px] uppercase tracking-wide text-muted-subtle">
                      {match.movie.release_year ?? '—'} · {runtime}
                    </span>
                  )}
                </Link>
              </div>
            )
          })}

          <button
            type="button"
            onClick={startOver}
            className="mt-2 self-center font-ui text-sm text-muted underline underline-offset-4 transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-text"
          >
            Try a different film
          </button>
        </div>
      )}

      {(phase === 'no_matches' || phase === 'error') && (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="max-w-md font-display text-xl leading-tight text-text">
            {phase === 'no_matches' ? errorMessage : "That didn't work."}
          </p>
          {phase === 'error' && errorMessage && (
            <p className="max-w-md font-ui text-sm text-muted">{errorMessage}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {phase === 'error' && retryable && (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={startOver}
              className="rounded-full border border-border px-6 py-3 font-ui text-sm text-text transition-[border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-muted/40 active:scale-[0.97]"
            >
              Change what you told me
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
