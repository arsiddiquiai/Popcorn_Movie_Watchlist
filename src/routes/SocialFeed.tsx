import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Page, PageHeader } from '../components/layout/Page'
import { Spinner } from '../components/ui/Spinner'
import { addFollow, fetchFeed, FollowError, removeFollow, type FeedEntry } from '../lib/follows'
import { tmdbImageUrl } from '../lib/tmdbClient'

type Status = 'loading' | 'ready' | 'error'

/** How many posters to show per followed person — a feed row, not a full
 *  watchlist page, so this stays a preview rather than the whole list
 *  (which the person's own /w/{token} page already shows in full). */
const PREVIEW_COUNT = 6

/**
 * Social feed / following — v1. Following someone is saving their
 * /w/{token} share link; this screen re-displays each followed person's
 * current want-list, exactly what their public share page already shows
 * to anyone with the link. No new privacy surface — see follows.ts and
 * its migration's own doc comments for the full reasoning.
 */
export default function SocialFeed() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>('loading')
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [followState, setFollowState] = useState<'idle' | 'following' | 'error'>('idle')
  const [followError, setFollowError] = useState<string | null>(null)

  async function load() {
    if (!user) return
    setStatus('loading')
    try {
      const feed = await fetchFeed(user.id)
      setEntries(feed)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleFollow() {
    if (!user || !linkInput.trim() || followState === 'following') return
    setFollowState('following')
    setFollowError(null)
    try {
      await addFollow(user.id, linkInput)
      setLinkInput('')
      setFollowState('idle')
      await load()
    } catch (err) {
      setFollowState('error')
      setFollowError(err instanceof FollowError ? err.message : "Couldn't follow that list. Try again.")
    }
  }

  async function handleUnfollow(followId: string) {
    // Optimistic — this is a low-stakes, easily-reversible action (just
    // re-add the link to follow again), so there's no confirmation step.
    setEntries((prev) => prev.filter((e) => e.follow.id !== followId))
    try {
      await removeFollow(followId)
    } catch {
      await load() // failed — resync with the real state rather than leave a lie on screen
    }
  }

  return (
    <Page>
      <PageHeader title="Feed" subtitle="See what friends are watching — anyone who's shared their list with you." />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={linkInput}
            onChange={(event) => setLinkInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleFollow()
            }}
            placeholder="Paste a friend's share link…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 font-ui text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-warm"
          />
          <button
            type="button"
            onClick={() => void handleFollow()}
            disabled={followState === 'following' || !linkInput.trim()}
            className="btn-hero shrink-0 rounded-full px-5 py-3 font-ui text-sm font-semibold disabled:opacity-60"
          >
            {followState === 'following' ? 'Following…' : 'Follow'}
          </button>
        </div>
        {followState === 'error' && followError && <p className="font-ui text-xs text-accent-cold">{followError}</p>}
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <Spinner label="Loading your feed" />
        </div>
      )}

      {status === 'error' && <p className="font-ui text-sm text-accent-cold">Couldn't load your feed. Try again.</p>}

      {status === 'ready' && entries.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-9 py-16 text-center">
          <p className="font-display text-lg font-semibold text-text">Not following anyone yet</p>
          <p className="max-w-sm font-ui text-sm text-muted">
            Ask a friend for their share link from their own You tab, and paste it above.
          </p>
        </div>
      )}

      {status === 'ready' &&
        entries.map(({ follow, list }) => (
          <div key={follow.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-base font-semibold text-text">
                {list ? (list.displayName ?? 'Someone') : 'This list is no longer available'}
              </p>
              <button
                type="button"
                onClick={() => void handleUnfollow(follow.id)}
                className="shrink-0 font-ui text-xs text-muted underline underline-offset-4 hover:text-text"
              >
                Unfollow
              </button>
            </div>

            {list && list.movies.length === 0 && (
              <p className="font-ui text-xs text-muted">Nothing on their list right now.</p>
            )}

            {list && list.movies.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {list.movies.slice(0, PREVIEW_COUNT).map((movie) => {
                  const posterUrl = tmdbImageUrl(movie.poster_path, 'w185')
                  return (
                    <div key={movie.tmdb_id} className="aspect-[2/3] overflow-hidden rounded-poster bg-bg">
                      {posterUrl ? (
                        <img src={posterUrl} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-1 text-center font-ui text-[9px] text-muted">
                          {movie.title}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
    </Page>
  )
}
