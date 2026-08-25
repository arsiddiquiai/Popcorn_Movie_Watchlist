import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useAppBarAction } from '../components/layout/AppShell'
import { DiceIcon, RefreshIcon } from '../components/layout/icons'
import { KernelMark } from '../components/layout/Logo'
import { Page, PageHeader } from '../components/layout/Page'
import { PosterGridSkeleton } from '../components/ui/PosterGridSkeleton'
import { PullToRefresh } from '../components/ui/PullToRefresh'
import { UndoToast } from '../components/watchlist/UndoToast'
import { WatchlistCard, type SwipeAction } from '../components/watchlist/WatchlistCard'
import { decayLevelForAddedAt } from '../lib/decay'
import { getRandomPopularMovie } from '../lib/tmdbClient'
import { fetchWatchlistByStatus, type WatchlistEntry } from '../lib/watchlist'
import { useTheme } from '../theme/ThemeProvider'

const UNDO_WINDOW_MS = 5000

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

export default function Watchlist() {
  const { user } = useAuth()
  const { reducedMotion } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('want')
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [surprising, setSurprising] = useState(false)
  const [subcopySeen] = useState(hasSeenSubcopy)
  // Whether the page's own h1 has scrolled up under the sticky app bar —
  // DESIGN.md §3's "h1 collapses into the app bar on scroll". Tracked via
  // IntersectionObserver against the header block itself rather than a
  // raw scrollY threshold, so it stays correct regardless of header height.
  const [compact, setCompact] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  // The 5s undo toast for swipe/long-press actions (DESIGN.md §5). Only
  // one at a time — a second swipe while a toast is showing replaces it,
  // clearing the previous action's own timer.
  const [toastAction, setToastAction] = useState<SwipeAction | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(SUBCOPY_SEEN_KEY, '1')
    } catch {
      // Private mode / quota — subcopy just shows again next load, fine.
    }
  }, [])

  const showSubcopy = !subcopySeen || (status === 'success' && entries.length === 0)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    // rootMargin's top offset matches the sticky app bar's own height
    // (h-14 = 56px) — the header counts as "collapsed" once it scrolls
    // up underneath the bar, not merely off the top of the viewport.
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      rootMargin: '-56px 0px 0px 0px',
      threshold: 0,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
  // The same slot also carries the collapsed title once `compact` flips —
  // the app bar only has room for a short label next to the Logo and dice,
  // so it reads "Watchlist" rather than the full "My Watchlist".
  useAppBarAction(
    <div className="flex items-center gap-2">
      {compact && (
        <span className="max-w-[110px] truncate font-display text-[17px] font-semibold text-text">
          Watchlist
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleSurpriseMe()}
        disabled={surprising}
        aria-label={surprising ? 'Picking a surprise' : 'Surprise me'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-accent-warm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/10 disabled:opacity-60"
      >
        <DiceIcon />
      </button>
    </div>,
  )

  // Extracted so pull-to-refresh and the manual Refresh button (its
  // required non-gesture equivalent, DESIGN.md §5) can both re-run the
  // exact same fetch the initial load uses, rather than each inventing
  // their own. `silent` skips the full-page skeleton — a refresh of a
  // list you're already looking at shouldn't blank it first.
  const loadEntries = useCallback(
    async (silent = false) => {
      if (!user) return
      if (!silent) setStatus('loading')
      try {
        const result = await fetchWatchlistByStatus(user.id, tab)
        setEntries(result)
        setStatus('success')
      } catch {
        if (!silent) setStatus('error')
      }
    },
    [user, tab],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await loadEntries()
    })()
    return () => {
      cancelled = true
    }
    // loadEntries already depends on [user, tab] itself — this effect just
    // needs to re-run on the same pair, not on loadEntries' own identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab])

  function clearToastTimer() {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current)
      toastTimer.current = null
    }
  }

  function handleSwipeAction(action: SwipeAction) {
    setEntries((prev) => prev.filter((e) => e.item.id !== action.entry.item.id))
    clearToastTimer()
    setToastAction(action)
    toastTimer.current = setTimeout(() => {
      setToastAction(null)
      toastTimer.current = null
    }, UNDO_WINDOW_MS)
  }

  async function handleUndo() {
    if (!toastAction) return
    clearToastTimer()
    const action = toastAction
    setToastAction(null)
    try {
      await action.revert()
      setEntries((prev) => [action.entry, ...prev])
    } catch {
      // The revert call failing is rare (a transient network error) and
      // there's no toast left to retry from — the item just stays wherever
      // the original action left it; a manual refresh picks up the truth.
    }
  }

  useEffect(() => clearToastTimer, [])

  return (
    <Page width="wide">
      <div
        ref={headerRef}
        className={`transition-opacity duration-[var(--transition-fast)] ease-[var(--ease-standard)] lg:opacity-100 ${compact ? 'opacity-0' : 'opacity-100'}`}
      >
        <PageHeader
          title="My Watchlist"
          subtitle={showSubcopy ? "Everything you've saved — and everything quietly ageing out of it." : undefined}
          actions={
            <button
              type="button"
              onClick={() => void handleSurpriseMe()}
              disabled={surprising}
              className="hidden rounded-full border border-accent-warm/40 bg-accent-warm/10 px-4 py-2 font-ui text-sm font-semibold text-accent-warm transition-[background-color,border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/20 active:scale-[0.97] disabled:opacity-60 lg:inline-flex"
            >
              {surprising ? 'Picking…' : 'Surprise Me'}
            </button>
          }
        />
      </div>

      <div className="sticky top-14 z-30 -mt-4 flex flex-wrap items-center justify-between gap-3 bg-bg/80 py-2 backdrop-blur lg:static lg:bg-transparent lg:py-0 lg:backdrop-blur-none">
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

          {/* Visible tap equivalent for pull-to-refresh (DESIGN.md §5). */}
          <button
            type="button"
            onClick={() => void loadEntries(true)}
            aria-label="Refresh"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-surface hover:text-text"
          >
            <RefreshIcon />
          </button>
      </div>

      <PullToRefresh onRefresh={() => loadEntries(true)}>
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
                  onSwipeAction={handleSwipeAction}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      </PullToRefresh>

      <AnimatePresence>
        {toastAction && (
          <UndoToast
            key={toastAction.entry.item.id}
            message={toastAction.kind === 'watched' ? 'Marked as watched' : 'Buried'}
            onUndo={() => void handleUndo()}
            onDismiss={() => {
              clearToastTimer()
              setToastAction(null)
            }}
          />
        )}
      </AnimatePresence>
    </Page>
  )
}
