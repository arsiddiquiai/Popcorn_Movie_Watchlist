import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Page, PageHeader } from '../components/layout/Page'
import { Spinner } from '../components/ui/Spinner'
import type { DuoSession as DuoSessionRow, DuoVote } from '../lib/database.types'
import {
  computeDuoMatches,
  duoInviteUrlFor,
  castDuoVote,
  DuoMatchError,
  fetchDuoSession,
  fetchDuoVotes,
  type DuoCandidate,
} from '../lib/duoMatch'
import { tmdbImageUrl } from '../lib/tmdbClient'

type Status = 'loading' | 'ready' | 'error'

/** Refetch cadence while a session screen is open. Polling, not Supabase
 *  Realtime channels — this project has no existing live-subscription
 *  infrastructure to build on (the `ws` transport wired into every
 *  Supabase client here exists only to satisfy the Realtime constructor on
 *  Node, nothing actually subscribes to a channel anywhere), and a v1 Duo
 *  Match session is two people looking at their phones for a few minutes,
 *  not a latency-sensitive experience. Upgradeable to real-time later
 *  without changing anything this screen's own logic depends on. */
const POLL_INTERVAL_MS = 4_000

export default function DuoSession() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<DuoSessionRow | null>(null)
  const [votes, setVotes] = useState<DuoVote[]>([])
  const [voting, setVoting] = useState(false)

  const load = useCallback(async () => {
    if (!sessionId) return
    try {
      const [sessionRow, voteRows] = await Promise.all([fetchDuoSession(sessionId), fetchDuoVotes(sessionId)])
      setSession(sessionRow)
      setVotes(voteRows)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof DuoMatchError ? err.message : "Couldn't load this Duo Match.")
      setStatus('error')
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  // Polling only once the first load has succeeded — no point refetching a
  // session that already failed to load at all.
  useEffect(() => {
    if (status !== 'ready') return
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [status, load])

  const candidates = useMemo<DuoCandidate[]>(() => {
    if (!session) return []
    return Array.isArray(session.candidates) ? (session.candidates as unknown as DuoCandidate[]) : []
  }, [session])

  const myVotedIds = useMemo(() => new Set(votes.filter((v) => v.user_id === user?.id).map((v) => v.tmdb_id)), [votes, user])
  const nextCandidate = candidates.find((c) => !myVotedIds.has(c.tmdb_id)) ?? null
  const matches = useMemo(() => (session ? computeDuoMatches(session, votes) : []), [session, votes])
  const matchedCandidates = candidates.filter((c) => matches.includes(c.tmdb_id))

  async function handleVote(liked: boolean) {
    if (!session || !user || !nextCandidate || voting) return
    setVoting(true)
    try {
      await castDuoVote(session.id, user.id, nextCandidate.tmdb_id, liked)
      await load()
    } catch (err) {
      setError(err instanceof DuoMatchError ? err.message : "Couldn't save your vote.")
    } finally {
      setVoting(false)
    }
  }

  if (status === 'loading') {
    return (
      <Page>
        <div className="flex flex-1 items-center justify-center py-20">
          <Spinner label="Loading Duo Match" />
        </div>
      </Page>
    )
  }

  if (status === 'error' || !session || !user) {
    return (
      <Page>
        <PageHeader title="Duo Match" />
        <p className="font-ui text-sm text-accent-cold">{error ?? 'Something went wrong.'}</p>
      </Page>
    )
  }

  const isHost = session.host_user_id === user.id
  const waitingForPartner = !session.guest_user_id

  return (
    <Page>
      <PageHeader title="Duo Match" subtitle="Swipe through the same list — a match is something you both liked." />

      {waitingForPartner && isHost && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-5">
          <p className="font-ui text-sm font-medium text-text">Waiting for your partner to join</p>
          <p className="font-ui text-xs text-muted">Send them this link — swiping starts once they've joined.</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-text">{duoInviteUrlFor(session.invite_token)}</code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(duoInviteUrlFor(session.invite_token))}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 font-ui text-xs text-text hover:border-accent-warm/40"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {matchedCandidates.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent-warm/40 bg-accent-warm/10 px-5 py-4">
          <p className="font-display text-sm font-semibold text-accent-warm">
            {matchedCandidates.length} match{matchedCandidates.length === 1 ? '' : 'es'}!
          </p>
          <div className="flex flex-wrap gap-2">
            {matchedCandidates.map((c) => (
              <span key={c.tmdb_id} className="rounded-full border border-accent-warm/40 bg-bg px-3 py-1 font-ui text-xs text-text">
                {c.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {!waitingForPartner && nextCandidate && (
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-poster bg-surface">
            {tmdbImageUrl(nextCandidate.poster_path, 'w500') ? (
              <img
                src={tmdbImageUrl(nextCandidate.poster_path, 'w500') ?? ''}
                alt={nextCandidate.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center font-ui text-sm text-muted">
                {nextCandidate.title}
              </div>
            )}
          </div>
          <p className="text-center font-display text-lg font-semibold text-text">
            {nextCandidate.title}
            {nextCandidate.release_year ? ` (${nextCandidate.release_year})` : ''}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => void handleVote(false)}
              disabled={voting}
              className="rounded-full border border-border px-6 py-3 font-ui text-sm font-semibold text-muted transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-cold/40 hover:text-accent-cold disabled:opacity-60"
            >
              Pass
            </button>
            <button
              type="button"
              onClick={() => void handleVote(true)}
              disabled={voting}
              className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold disabled:opacity-60"
            >
              Like
            </button>
          </div>
        </div>
      )}

      {!waitingForPartner && !nextCandidate && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="font-display text-lg font-semibold text-text">You've been through the whole list</p>
          <p className="font-ui text-sm text-muted">
            {matchedCandidates.length > 0
              ? 'Check the matches above.'
              : "No matches yet — they'll show up here once your partner catches up."}
          </p>
        </div>
      )}
    </Page>
  )
}
