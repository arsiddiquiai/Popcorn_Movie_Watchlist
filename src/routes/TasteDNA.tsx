import { useEffect, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link, NavLink } from 'react-router-dom'
import { AccountFooterLinks } from '../components/layout/AccountFooterLinks'
import { AccountHeader } from '../components/layout/AccountHeader'
import { PrimaryAccountActions } from '../components/layout/PrimaryAccountActions'
import { ShareWatchlistCard } from '../components/layout/ShareWatchlistCard'
import { Spinner } from '../components/ui/Spinner'
import { requestTaste, TasteError, type TasteResult } from '../lib/tasteClient'
import { useTheme } from '../theme/ThemeProvider'

type Phase = 'loading' | 'ready' | 'error'

/** Reads live theme colours the same way ratingScale's callers do, so the
 *  charts stay in sync with the active theme instead of a hardcoded hex. */
function useChartColors() {
  const { theme } = useTheme()
  const [colors, setColors] = useState({ accent: '#d4a24c', muted: '#a89a8c', border: '#3a2e29' })

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    setColors({
      accent: styles.getPropertyValue('--accent-warm').trim() || '#d4a24c',
      muted: styles.getPropertyValue('--muted').trim() || '#a89a8c',
      border: styles.getPropertyValue('--border').trim() || '#3a2e29',
    })
  }, [theme])

  return colors
}

/** A single row teasing the roadmap, not a full duplicate of ComingSoon's
 *  own preview cards (that content lives at /coming-soon and stays there —
 *  this is a link, not a re-render of it). */
function ComingSoonTeaser() {
  return (
    <NavLink
      to="/coming-soon"
      end
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 px-5 py-4 font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/30 lg:hidden"
    >
      <span>
        <span className="block font-medium">What's coming next</span>
        <span className="mt-0.5 block text-xs text-muted">TV shows, sharing, Duo Match, and more.</span>
      </span>
      <span aria-hidden="true" className="text-muted">
        →
      </span>
    </NavLink>
  )
}

export default function TasteDNA() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<TasteResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryable, setRetryable] = useState(true)
  const colors = useChartColors()

  async function load() {
    setPhase('loading')
    setErrorMessage(null)
    try {
      const data = await requestTaste()
      setResult(data)
      setPhase('ready')
    } catch (err) {
      setErrorMessage(err instanceof TasteError ? err.message : 'Something went wrong.')
      setRetryable(err instanceof TasteError ? err.retryable : true)
      setPhase('error')
    }
  }

  useEffect(() => {
    void load()
    // Deliberately once on mount — this reads the user's rating history as
    // it stands right now; it doesn't need to react to anything else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // DESIGN.md live-review fix (§7 restructure): account identity and the
  // two most-used actions (Settings, Feedback) used to be pushed to the
  // very bottom of this page, past everything else including "coming
  // soon" previews. They're now a fixed header above whatever this phase
  // renders, so they're immediately visible regardless of load state —
  // including cold_start, which a new user with no ratings yet can sit in
  // for a while.
  let body: ReactNode = null

  if (phase === 'loading') {
    body = (
      <div className="flex items-center justify-center py-16">
        <Spinner label="Reading your taste" />
      </div>
    )
  } else if (phase === 'error') {
    body = (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="max-w-md font-display text-xl text-text">That didn't load.</p>
        <p className="max-w-md font-ui text-sm text-muted">{errorMessage}</p>
        {retryable && (
          <button
            type="button"
            onClick={() => void load()}
            className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold"
          >
            Try again
          </button>
        )}
      </div>
    )
  } else if (result?.cold_start) {
    body = (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <h1 className="font-display text-3xl text-text">Taste DNA</h1>
        <p className="max-w-md font-ui text-sm text-muted">
          Rate a few more films and your taste profile will start taking shape — {result.total_rated}/5 so far.
        </p>
        <Link to="/" className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold">
          Back to watchlist
        </Link>
      </div>
    )
  } else if (result) {
    const genreData = result.genre_breakdown.slice(0, 8)
    const decadeData = result.decade_breakdown

    body = (
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-accent-warm">
            {result.total_rated} films rated
          </span>
          {result.personality_label && (
            <h1 className="font-display text-4xl leading-tight text-text">{result.personality_label}</h1>
          )}
          {result.personality_description && (
            <p className="max-w-xl font-ui text-base leading-relaxed text-muted">{result.personality_description}</p>
          )}
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 font-ui text-sm font-semibold text-text">Genres</h2>
            <ResponsiveContainer width="100%" height={Math.max(180, genreData.length * 34)}>
              <BarChart data={genreData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={colors.border} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: colors.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="genre"
                  width={90}
                  tick={{ fill: colors.muted, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: colors.border, opacity: 0.3 }}
                  contentStyle={{ background: 'var(--surface-2)', border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-sm)' }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="count" fill={colors.accent} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 font-ui text-sm font-semibold text-text">Decades</h2>
            <ResponsiveContainer width="100%" height={Math.max(180, 220)}>
              <BarChart data={decadeData} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke={colors.border} />
                <XAxis dataKey="decade" tick={{ fill: colors.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: colors.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: colors.border, opacity: 0.3 }}
                  contentStyle={{ background: 'var(--surface-2)', border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-sm)' }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="count" fill={colors.accent} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>

        {result.avg_runtime_minutes && (
          <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
            <span className="font-display text-3xl text-accent-warm">{result.avg_runtime_minutes}</span>
            <span className="font-ui text-sm text-muted">average minutes per film you've rated</span>
          </section>
        )}

        {result.blind_spots.length > 0 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="font-display text-xl text-text">Blind Spots</h2>
              <p className="font-ui text-sm text-muted">Genres you haven't explored yet — here's where to start.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {result.blind_spots.map((spot) => (
                <Link
                  key={spot.tmdb_id}
                  to={`/movie/${spot.tmdb_id}`}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40"
                >
                  <span className="font-mono text-[11px] uppercase tracking-wide text-accent-warm">{spot.genre}</span>
                  <span className="font-display text-base font-semibold text-text">{spot.title}</span>
                  <span className="font-ui text-xs leading-relaxed text-muted">{spot.reason}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10">
      <AccountHeader />
      <PrimaryAccountActions />
      <ShareWatchlistCard />

      {/* v1 TV entry point — no room on the fixed 5-item TabBar, and Search
          deliberately wasn't given a Movies/TV toggle (too much interacting
          effect logic there to risk for a first cut of TV support), so
          this link is the way in for now. */}
      <NavLink
        to="/tv"
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/30"
      >
        <span>
          <span className="block font-medium">My TV List</span>
          <span className="mt-0.5 block text-xs text-muted">Shows, series & anime — search, save, rate.</span>
        </span>
        <span aria-hidden="true" className="text-muted">
          →
        </span>
      </NavLink>

      {body}

      <ComingSoonTeaser />
      <AccountFooterLinks />
    </div>
  )
}
