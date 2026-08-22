import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { WatchlistCard } from '../components/watchlist/WatchlistCard'
import { getRandomPopularMovie } from '../lib/tmdbClient'
import { fetchWatchlistByStatus, type WatchlistEntry } from '../lib/watchlist'

type Tab = 'want' | 'watched'

const tabs: { id: Tab; label: string }[] = [
  { id: 'want', label: 'Want to Watch' },
  { id: 'watched', label: 'Watched' },
]

export default function Watchlist() {
  const { user } = useAuth()
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
            className="rounded-lg border border-accent-warm/40 bg-accent-warm/10 px-4 py-1.5 font-ui text-sm font-semibold text-accent-warm transition-opacity duration-[var(--transition-fast)] disabled:opacity-60"
          >
            {surprising ? 'Picking…' : 'Surprise Me'}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1">
        {status === 'loading' && <p className="py-20 text-center font-ui text-sm text-muted">Loading…</p>}

        {status === 'error' && (
          <p className="py-20 text-center font-ui text-sm text-accent-cold">
            Couldn't load your watchlist. Try refreshing the page.
          </p>
        )}

        {status === 'success' && entries.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            {tab === 'want' ? (
              <>
                <p className="font-ui text-sm text-muted">Nothing here yet — search to add your first movie.</p>
                <Link
                  to="/search"
                  className="rounded-lg bg-accent-warm px-4 py-2 font-ui text-sm font-semibold text-bg transition-opacity duration-[var(--transition-fast)] hover:opacity-90"
                >
                  Search movies
                </Link>
              </>
            ) : (
              <p className="font-ui text-sm text-muted">
                Nothing watched yet — movies you mark as watched will show up here.
              </p>
            )}
          </div>
        )}

        {status === 'success' && entries.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {entries.map((entry) => (
              // decayLevel (visible ageing on "want" items) hooks in here in
              // a later prompt — not built yet.
              <WatchlistCard key={entry.item.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
