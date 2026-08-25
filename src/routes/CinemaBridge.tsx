import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { SourceMoviePicker } from '../components/bridge/SourceMoviePicker'
import { TargetChips } from '../components/bridge/TargetChips'
import { DiscoverTabs } from '../components/layout/DiscoverTabs'
import type { MovieCache } from '../lib/database.types'
import { BridgeError, requestBridge, type BridgeMatch, type BridgeResult } from '../lib/bridgeClient'
import { formatRuntime } from '../lib/format'
import { tmdbImageUrl, type TmdbSearchMovie } from '../lib/tmdbClient'
import { addToWatchlist, getOrCacheMovie } from '../lib/watchlist'

type Phase = 'form' | 'loading' | 'result' | 'no_matches' | 'error'
type AddState = 'idle' | 'loading' | 'added' | 'error'

interface ResolvedMatch extends BridgeMatch {
  movie: MovieCache
}

export default function CinemaBridge() {
  const { user } = useAuth()
  const [sourceMovie, setSourceMovie] = useState<TmdbSearchMovie | null>(null)
  const [target, setTarget] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(true)
  const [matches, setMatches] = useState<ResolvedMatch[]>([])
  const [addState, setAddState] = useState<Record<number, AddState>>({})

  const canSubmit = Boolean(sourceMovie) && target.trim().length > 0

  async function handleSubmit() {
    if (!sourceMovie || !target.trim() || !user) return
    setPhase('loading')
    setErrorMessage(null)
    setAddState({})

    try {
      const result = await requestBridge({ source_tmdb_id: sourceMovie.id, target: target.trim() })
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
      <div className="w-full max-w-xl">
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-text sm:text-4xl">Cinema Bridge</h1>
        <p className="mt-2 font-ui text-sm text-muted">
          Loved a film? Find its equivalent in another industry or language.
        </p>
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

      {phase === 'result' && (
        <div className="flex w-full max-w-2xl flex-col gap-4">
          {matches.map((match) => {
            const posterUrl = tmdbImageUrl(match.movie.poster_path, 'w185')
            const runtime = formatRuntime(match.movie.runtime_minutes)
            const state = addState[match.tmdb_id] ?? 'idle'
            return (
              <div
                key={match.tmdb_id}
                className="flex gap-4 rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-lg bg-bg sm:w-24">
                  {posterUrl ? (
                    <img src={posterUrl} alt={match.movie.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-1 text-center font-ui text-[10px] text-muted">
                      {match.movie.title}
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h3 className="font-display text-lg font-semibold text-text">{match.movie.title}</h3>
                  <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted-subtle">
                    <span>{match.movie.release_year ?? '—'}</span>
                    {runtime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{runtime}</span>
                      </>
                    )}
                  </div>
                  <p className="font-ui text-sm leading-relaxed text-muted">{match.reason}</p>
                  <div className="mt-1 flex items-center gap-3">
                    {state === 'added' ? (
                      <span className="font-ui text-xs font-semibold text-accent-warm">Added ✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleAdd(match.tmdb_id)}
                        disabled={state === 'loading'}
                        className="rounded-full border border-accent-warm/40 bg-accent-warm/10 px-3 py-1.5 font-ui text-xs font-semibold text-accent-warm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/20 disabled:opacity-60"
                      >
                        {state === 'loading' ? 'Adding…' : state === 'error' ? 'Retry add' : 'Add to Watchlist'}
                      </button>
                    )}
                    <Link
                      to={`/movie/${match.tmdb_id}`}
                      className="font-ui text-xs text-muted underline underline-offset-4 hover:text-text"
                    >
                      Full details
                    </Link>
                  </div>
                </div>
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
