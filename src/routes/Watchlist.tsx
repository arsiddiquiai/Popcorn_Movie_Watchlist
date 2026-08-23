import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PosterGridSkeleton } from '../components/ui/PosterGridSkeleton'
import { WatchlistCard } from '../components/watchlist/WatchlistCard'
import { decayLevelForAddedAt } from '../lib/decay'
import { getRandomPopularMovie } from '../lib/tmdbClient'
import { fetchWatchlistByStatus, type WatchlistEntry } from '../lib/watchlist'
import { useTheme } from '../theme/ThemeProvider'

type Tab = 'want' | 'watched'

const tabs: { id: Tab; label: string }[] = [
  { id: 'want', label: 'Want to Watch' },
  { id: 'watched', label: 'Watched' },
]

export default function Watchlist() {
  const { user } = useAuth()
  const { reducedMotion } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('want')
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [surprising, setSurprising] = useState(false)

  async function handleSurpriseMe() {
    if (surprising) return
    setSurprising(true)
    try {
      const movie = await getRandomPopularMovie()
      navigate(`/movie/${movie.id}`)
    } catch {
      setSurprising(false)
    }
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setStatus('loading')

    fetchWatchlistByStatus(user.id, tab)
      .then((result) => {
        if (cancelled) return
        setEntries(result)
        setStatus('success')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [user, tab])

  return (
    <div className="flex min-h-screen flex-col gap-6 px-6 py-10">
      <header className="mx-auto w-full max-w-6xl">
        <h1 className="mb-6 font-display text-3xl text-text">My Watchlist</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-muted/20 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-4 py-1.5 font-ui text-sm transition-colors duration-[var(--transition-fast)] ${
                  tab === t.id ? 'bg-surface font-semibold text-text' : 'text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleSurpriseMe()}
            disabled={surprising}
            className="rounded-full border border-accent-warm/40 bg-accent-warm/10 px-4 py-1.5 font-ui text-sm font-semibold text-accent-warm transition-colors duration-[var(--transition-fast)] hover:bg-accent-warm/20 disabled:opacity-60"
          >
            {surprising ? 'Picking…' : 'Surprise Me'}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1">
        {status === 'loading' && <PosterGridSkeleton />}

        {status === 'error' && (
          <p className="py-20 text-center font-ui text-sm text-accent-cold">
            Couldn't load your watchlist. Try refreshing the page.
          </p>
        )}

        {status === 'success' && entries.length === 0 && (
          <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface px-9 py-16 text-center">
            <motion.div
              aria-hidden="true"
              className="grid h-24 w-24 place-items-center rounded-xl border border-border bg-surface-2"
              animate={reducedMotion ? undefined : { y: [0, -6, 0] }}
              transition={reducedMotion ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="font-mono text-[11px] text-muted-subtle">art</span>
            </motion.div>

            {tab === 'want' ? (
              <>
                <div>
                  <p className="font-display text-xl font-semibold text-text">Nothing queued yet</p>
                  <p className="mt-2 max-w-sm font-ui text-sm text-muted">
                    Search to add your first movie.
                  </p>
                </div>
                <Link to="/search" className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold">
                  Search movies
                </Link>
              </>
            ) : (
              <p className="max-w-sm font-ui text-sm text-muted">
                Nothing watched yet — movies you mark as watched will show up here.
              </p>
            )}
          </div>
        )}

        {status === 'success' && entries.length > 0 && (
          <motion.div
            className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            initial={reducedMotion ? false : 'hidden'}
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.045 } } }}
          >
            {entries.map((entry) => (
              <motion.div
                key={entry.item.id}
                variants={reducedMotion ? undefined : { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <WatchlistCard
                  entry={entry}
                  // Decay only applies to "want" items — watched/dropped
                  // never decay, per spec.
                  decayLevel={tab === 'want' ? decayLevelForAddedAt(entry.item.added_at) : 0}
                  onDecayResolved={(itemId, action, newAddedAt) => {
                    setEntries((prev) =>
                      action === 'removed'
                        ? prev.filter((e) => e.item.id !== itemId)
                        : prev.map((e) =>
                            e.item.id === itemId && newAddedAt
                              ? { ...e, item: { ...e.item, added_at: newAddedAt } }
                              : e,
                          ),
                    )
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
