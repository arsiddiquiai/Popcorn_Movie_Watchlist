import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useAppBarAction } from '../components/layout/AppShell'
import { KernelMark } from '../components/layout/Logo'
import { Page, PageHeader } from '../components/layout/Page'
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

/** Session-only "have they seen this before" flag (same reasoning as the
 *  decay dismiss key in WatchlistCard — a browser restart is a fine point
 *  to re-earn the subcopy, no DB column needed). Gates the subtitle per
 *  DESIGN.md §3: visible only when the list is empty or on first visit. */
const SUBCOPY_SEEN_KEY = 'popcorn:watchlist-subcopy-seen'

function hasSeenSubcopy(): boolean {
  try {
    return sessionStorage.getItem(SUBCOPY_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function DiceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="8.25" cy="8.25" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.75" cy="8.25" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="8.25" cy="15.75" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.75" cy="15.75" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function Watchlist() {
  const { user } = useAuth()
  const { reducedMotion } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('want')
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [surprising, setSurprising] = useState(false)
  const [subcopySeen] = useState(hasSeenSubcopy)

  useEffect(() => {
    try {
      sessionStorage.setItem(SUBCOPY_SEEN_KEY, '1')
    } catch {
      // Private mode / quota — subcopy just shows again next load, fine.
    }
  }, [])

  const showSubcopy = !subcopySeen || (status === 'success' && entries.length === 0)

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

  // Mobile: Surprise Me moves off the page body and into the app bar as an
  // icon-button (DESIGN.md §3). Desktop keeps the labelled button below,
  // since the sidebar layout has no app bar for this slot to live in.
  useAppBarAction(
    <button
      type="button"
      onClick={() => void handleSurpriseMe()}
      disabled={surprising}
      aria-label={surprising ? 'Picking a surprise' : 'Surprise me'}
      className="grid h-9 w-9 place-items-center rounded-lg text-accent-warm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/10 disabled:opacity-60"
    >
      <DiceIcon />
    </button>,
  )

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
    <Page width="wide">
      <PageHeader
        title="My Watchlist"
        subtitle={showSubcopy ? "Everything you've saved — and everything quietly ageing out of it." : undefined}
        actions={
          <button
            type="button"
            onClick={() => void handleSurpriseMe()}
            disabled={surprising}
            className="hidden rounded-full border border-accent-warm/40 bg-accent-warm/10 px-4 py-2 font-ui text-sm font-semibold text-accent-warm transition-[background-color,border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/20 active:scale-[0.97] disabled:opacity-60 md:inline-flex"
          >
            {surprising ? 'Picking…' : 'Surprise Me'}
          </button>
        }
      />

      <div className="sticky top-14 z-30 -mt-4 flex flex-wrap items-center justify-between gap-3 bg-bg/80 py-2 backdrop-blur md:static md:bg-transparent md:py-0 md:backdrop-blur-none">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-4 py-1 font-ui text-sm transition-[background-color,color] duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
                  tab === t.id ? 'bg-surface font-semibold text-text shadow-sm' : 'text-muted hover:text-text'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

      </div>

      <div className="flex-1">
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
              <KernelMark size={34} fill="var(--muted-subtle)" />
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
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4"
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
                  decayEnabled={tab === 'want'}
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
    </Page>
  )
}
