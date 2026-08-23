import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { downloadWatchlistCsv } from '../lib/exportData'
import { useTheme } from '../theme/ThemeProvider'
import type { Theme } from '../theme/types'

const themeOptions: { id: Theme; label: string; description: string }[] = [
  { id: 'nightcap', label: 'Nightcap', description: 'Dark and warm. The default.' },
  { id: 'daylight', label: 'Daylight', description: 'Light, bright, high contrast.' },
  { id: 'cinema', label: 'Cinema', description: 'Near-black, minimal chrome, poster-forward.' },
]

/** CLAUDE.md's "Parked" list, verbatim — a roadmap statement, not a
 *  promise with a date. No functionality behind any of these. */
const COMING_SOON = [
  { title: 'AI Movie Assistant', description: 'A conversational assistant for movie discovery.' },
  { title: 'TV shows, web series & anime', description: 'Extending Popcorn beyond movies.' },
  { title: 'Public share links', description: 'Read-only links to share your watchlist or ratings.' },
  { title: 'Social feed / following', description: 'See what friends are watching and rating.' },
  { title: 'Duo Match', description: 'Find something to watch together with a partner.' },
  { title: 'PDF export', description: 'Download your watchlist as a formatted document.' },
]

type ExportState = 'idle' | 'exporting' | 'error'

export default function Settings() {
  const { user } = useAuth()
  const { theme, setTheme, reducedMotion, setReducedMotion } = useTheme()
  const [exportState, setExportState] = useState<ExportState>('idle')

  async function handleExport() {
    if (!user || exportState === 'exporting') return
    setExportState('exporting')
    try {
      await downloadWatchlistCsv(user.id)
      setExportState('idle')
    } catch {
      setExportState('error')
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
      <header>
        <h1 className="font-display text-3xl text-text">Settings</h1>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xs uppercase tracking-wider text-muted">Theme</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const isActive = theme === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                aria-pressed={isActive}
                className={`flex flex-col items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors duration-[var(--transition-base)] ${
                  isActive ? 'border-accent-warm bg-accent-warm/10' : 'border-muted/20 bg-surface hover:border-muted/40'
                }`}
              >
                {/* Nested data-theme locally overrides the CSS variables
                    for this element only, so the swatch previews the real
                    theme colours without hardcoding any hex value. */}
                <span
                  data-theme={option.id}
                  aria-hidden="true"
                  className="flex h-8 w-14 overflow-hidden rounded-md border border-muted/30"
                >
                  <span className="h-full w-1/2 bg-bg" />
                  <span className="h-full w-1/2 bg-accent-warm" />
                </span>
                <span className="font-ui text-sm font-semibold text-text">{option.label}</span>
                <span className="font-ui text-xs text-muted">{option.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex items-center justify-between gap-4 rounded-xl border border-muted/20 bg-surface px-4 py-4">
        <div>
          <h2 className="font-ui text-sm font-semibold text-text">Reduced motion</h2>
          <p className="font-ui text-xs text-muted">Minimises animation and transition speed everywhere.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reducedMotion}
          onClick={() => setReducedMotion(!reducedMotion)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--transition-base)] ${
            reducedMotion ? 'bg-accent-warm' : 'bg-muted/30'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-bg transition-[left] duration-[var(--transition-base)] ${
              reducedMotion ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-muted/20 bg-surface px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-ui text-sm font-semibold text-text">Export your data</h2>
            <p className="font-ui text-xs text-muted">
              Download your watchlist as a CSV — title, status, dates, ratings, and notes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exportState === 'exporting'}
            className="shrink-0 rounded-full border border-border px-4 py-2 font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] hover:border-accent-warm/40 disabled:opacity-60"
          >
            {exportState === 'exporting' ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
        {exportState === 'error' && (
          <p className="font-ui text-xs text-accent-cold">Couldn't export your data. Try again.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xs uppercase tracking-wider text-muted">Coming Soon</h2>
        <div className="flex flex-col gap-2">
          {COMING_SOON.map((item) => (
            <div
              key={item.title}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-surface/50 px-4 py-3"
            >
              <div>
                <p className="font-ui text-sm text-muted">{item.title}</p>
                <p className="font-ui text-xs text-muted-subtle">{item.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-subtle">
                Planned
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-muted/15 pt-6">
        <p className="font-ui text-xs text-muted">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </div>
  )
}
