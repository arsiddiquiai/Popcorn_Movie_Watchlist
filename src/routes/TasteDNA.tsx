import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { AccountLinks } from '../components/layout/AccountLinks'
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

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Reading your taste" />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-4">
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
        <div className="w-full max-w-sm text-left">
          <AccountLinks />
        </div>
      </div>
    )
  }

  if (!result) return null

  if (result.cold_start) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="font-display text-3xl text-text">Taste DNA</h1>
          <p className="max-w-md font-ui text-sm text-muted">
            Rate a few more films and your taste profile will start taking shape — {result.total_rated}/5 so far.
          </p>
          <Link
            to="/"
            className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold"
          >
            Back to watchlist
          </Link>
        </div>
        <div className="w-full max-w-sm text-left">
          <AccountLinks />
        </div>
      </div>
    )
  }

  const genreData = result.genre_breakdown.slice(0, 8)
  const decadeData = result.decade_breakdown

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
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
                contentStyle={{ background: 'var(--surface-2)', border: `1px solid ${colors.border}`, borderRadius: 8 }}
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
                contentStyle={{ background: 'var(--surface-2)', border: `1px solid ${colors.border}`, borderRadius: 8 }}
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

      <AccountLinks />
    </div>
  )
}
