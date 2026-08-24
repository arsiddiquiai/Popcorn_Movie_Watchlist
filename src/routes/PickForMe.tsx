import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { MoodForm } from '../components/pick/MoodForm'
import { ResultCard, type PickSource, type ResultActionState } from '../components/pick/ResultCard'
import { TransformationOverlay } from '../components/pick/TransformationOverlay'
import type { MovieCache, WatchlistItem } from '../lib/database.types'
import { energyVisuals } from '../lib/energyScale'
import {
  PickError,
  requestPick,
  setSessionAccepted,
  type PickInput,
  type PickResult,
} from '../lib/pickClient'
import { useRatingColors } from '../components/rating/useRatingColors'
import { addToWatchlist, getOrCacheMovie, getWatchlistItem, markAsWatched } from '../lib/watchlist'
import { useTheme } from '../theme/ThemeProvider'

type Phase = 'form' | 'transforming' | 'result' | 'exhausted' | 'no_candidates' | 'error'

/** One option the user can be shown, with everything needed to render it. */
interface Candidate {
  tmdb_id: number
  reason: string
  movie: MovieCache
  item: WatchlistItem | null
}

const DEFAULT_INPUT: PickInput = {
  mood_text: '',
  energy_level: 3,
  minutes_available: 90,
  company: 'alone',
}

function sourceOf(item: WatchlistItem | null): PickSource {
  // A 'dropped' row means they removed it — effectively not on their list,
  // and addToWatchlist() already knows how to revive it.
  return item && item.status !== 'dropped' ? 'watchlist' : 'catalogue'
}

function initialActionState(item: WatchlistItem | null): ResultActionState {
  return item?.status === 'watched' ? 'watched' : 'idle'
}

export default function PickForMe() {
  const { user } = useAuth()
  const { reducedMotion } = useTheme()
  const { cold, neutral, warm } = useRatingColors()

  const [input, setInput] = useState<PickInput>(DEFAULT_INPUT)
  const [phase, setPhase] = useState<Phase>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(true)

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [index, setIndex] = useState(0)
  const [coldStart, setColdStart] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [actionState, setActionState] = useState<ResultActionState>('idle')

  // Guards against a stale in-flight request resolving over a newer one
  // (or after unmount). Incremented on every submit.
  const runIdRef = useRef(0)
  useEffect(() => () => void (runIdRef.current += 1), [])

  /** Resolves a tmdb_id into the metadata and watchlist state the card needs. */
  const loadCandidate = useCallback(
    async (tmdb_id: number, reason: string, userId: string): Promise<Candidate | null> => {
      try {
        const [movie, item] = await Promise.all([getOrCacheMovie(tmdb_id), getWatchlistItem(userId, tmdb_id)])
        return { tmdb_id, reason, movie, item }
      } catch {
        // One unresolvable alternate shouldn't sink the whole result — it's
        // dropped from the list instead.
        return null
      }
    },
    [],
  )

  async function handleSubmit() {
    if (!user) return
    const runId = (runIdRef.current += 1)

    setPhase('transforming')
    setErrorMessage(null)
    setActionState('idle')
    setIndex(0)
    setCandidates([])

    // The transformation must not resolve early and leave an awkward gap
    // before the result lands, so the reveal waits on both the real request
    // and a minimum on-screen time. Reduced motion skips the floor entirely
    // — there's no animation to protect, so waiting would just be latency.
    const minMs = reducedMotion ? 0 : energyVisuals(input.energy_level, cold, neutral, warm).minDurationSeconds * 1000
    const floor = new Promise<void>((resolve) => setTimeout(resolve, minMs))

    const work = (async () => {
      const result = await requestPick(input)
      if ('kind' in result) return result

      const pick = result as PickResult
      const loaded = await Promise.all([
        loadCandidate(pick.tmdb_id, pick.reason, user.id),
        ...pick.alternates.map((alt) => loadCandidate(alt.tmdb_id, alt.reason, user.id)),
      ])
      return { pick, candidates: loaded.filter((c): c is Candidate => c !== null) }
    })()

    try {
      const [outcome] = await Promise.all([work, floor])
      if (runIdRef.current !== runId) return

      if ('kind' in outcome) {
        setErrorMessage(outcome.message)
        setPhase('no_candidates')
        return
      }
      if (outcome.candidates.length === 0) {
        setErrorMessage("Couldn't load the movie behind that pick. Try again.")
        setRetryable(true)
        setPhase('error')
        return
      }

      setCandidates(outcome.candidates)
      setColdStart(outcome.pick.cold_start)
      setSessionId(outcome.pick.session_id)
      setActionState(initialActionState(outcome.candidates[0].item))
      setPhase('result')
    } catch (err) {
      if (runIdRef.current !== runId) return
      setErrorMessage(err instanceof PickError ? err.message : 'Something went wrong finding your pick.')
      setRetryable(err instanceof PickError ? err.retryable : true)
      setPhase('error')
    }
  }

  const current = candidates[index] ?? null

  async function runAction(action: () => Promise<void>, settledState: ResultActionState) {
    if (!user || !current || actionState === 'pending') return
    setActionState('pending')
    try {
      await action()
      setActionState(settledState)
      // Acting on a pick is the signal this feature exists to measure.
      void setSessionAccepted(sessionId, true)
      // Refresh the row so the card's source/state stays truthful if they
      // keep browsing alternates afterwards.
      const item = await getWatchlistItem(user.id, current.tmdb_id)
      setCandidates((prev) => prev.map((c, i) => (i === index ? { ...c, item } : c)))
    } catch {
      setActionState('error')
    }
  }

  function handleNotThisOne() {
    const next = index + 1
    if (next < candidates.length) {
      setIndex(next)
      setActionState(initialActionState(candidates[next].item))
      return
    }
    // Every option offered was turned down — that's a real signal, not a
    // non-event, so it's recorded as an explicit rejection.
    void setSessionAccepted(sessionId, false)
    setPhase('exhausted')
  }

  function startOver() {
    runIdRef.current += 1
    setPhase('form')
    setCandidates([])
    setIndex(0)
    setActionState('idle')
    setErrorMessage(null)
    setSessionId(null)
  }

  if (phase === 'transforming') {
    return <TransformationOverlay energy={input.energy_level} reducedMotion={reducedMotion} />
  }

  if (phase === 'form') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <MoodForm value={input} onChange={setInput} onSubmit={() => void handleSubmit()} />
      </div>
    )
  }

  if (phase === 'error' || phase === 'no_candidates') {
    return (
      <CenteredPanel>
        <p className="max-w-md font-display text-xl leading-tight text-text">
          {phase === 'no_candidates' ? errorMessage : "That didn't work."}
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
      </CenteredPanel>
    )
  }

  if (phase === 'exhausted') {
    return (
      <CenteredPanel>
        <p className="max-w-md font-display text-xl leading-tight text-text">
          That's everything I had for this mood.
        </p>
        <p className="max-w-md font-ui text-sm text-muted">
          Tell me something different about tonight and I'll go again.
        </p>
        <button
          type="button"
          onClick={startOver}
          className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold"
        >
          Start over
        </button>
      </CenteredPanel>
    )
  }

  if (!current) return null

  return (
    <div className="flex min-h-screen flex-col justify-center gap-6 px-6 py-12">
      <ResultCard
        movie={current.movie}
        reason={current.reason}
        coldStart={coldStart}
        source={sourceOf(current.item)}
        actionState={actionState}
        swapKey={index}
        reducedMotion={reducedMotion}
        onAdd={() => void runAction(() => addToWatchlist(current.tmdb_id, user!.id).then(() => undefined), 'added')}
        onMarkWatched={() =>
          void runAction(async () => {
            // "Mark as Watched" only renders for a watchlist-sourced pick,
            // which by definition has a row — but a catalogue pick that was
            // just added is handled too rather than assumed away.
            const item = current.item ?? (await getWatchlistItem(user!.id, current.tmdb_id))
            if (!item) throw new Error('No watchlist row to mark watched.')
            await markAsWatched(item.id)
          }, 'watched')
        }
        onNotThisOne={handleNotThisOne}
      />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={startOver}
          className="font-ui text-sm text-muted underline underline-offset-4 transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-text"
        >
          Ask again with a different mood
        </button>
      </div>
    </div>
  )
}

function CenteredPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>
  )
}
