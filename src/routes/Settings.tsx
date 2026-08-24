import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Page, PageHeader, Section } from '../components/layout/Page'
import { downloadWatchlistCsv } from '../lib/exportData'
import { useTheme } from '../theme/ThemeProvider'
import type { Theme } from '../theme/types'

const themeOptions: { id: Theme; label: string; description: string }[] = [
  { id: 'nightcap', label: 'Nightcap', description: 'Dark and warm. The default.' },
  { id: 'daylight', label: 'Daylight', description: 'Light, bright, high contrast.' },
  { id: 'cinema', label: 'Cinema', description: 'Near-black, minimal chrome, poster-forward.' },
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
    <Page>
      <PageHeader title="Settings" subtitle="Appearance, motion, and your data." />

      <Section title="Theme">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const isActive = theme === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                aria-pressed={isActive}
                className={`flex flex-col items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors duration-[var(--transition-base)] ease-[var(--ease-standard)] ${
                  isActive ? 'border-accent-warm bg-accent-warm/10' : 'border-border bg-surface hover:border-muted/40'
                }`}
              >
                {/* Nested data-theme locally overrides the CSS variables
                    for this element only, so the swatch previews the real
                    theme colours without hardcoding any hex value. */}
                <span
                  data-theme={option.id}
                  aria-hidden="true"
                  className="flex h-8 w-14 overflow-hidden rounded-md border border-border"
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
      </Section>

      <Section title="Motion">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-5 py-4">
        <div>
          <h3 className="font-ui text-sm font-semibold text-text">Reduced motion</h3>
          <p className="mt-1 font-ui text-xs leading-relaxed text-muted">Minimises animation and transition speed everywhere.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reducedMotion}
          onClick={() => setReducedMotion(!reducedMotion)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--transition-base)] ease-[var(--ease-standard)] ${
            reducedMotion ? 'bg-accent-warm' : 'bg-muted/30'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-bg transition-[left] duration-[var(--transition-base)] ease-[var(--ease-standard)] ${
              reducedMotion ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>
      </Section>

      <Section title="Your data">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-ui text-sm font-semibold text-text">Export your data</h3>
            <p className="mt-1 font-ui text-xs leading-relaxed text-muted">
              Download your watchlist as a CSV — title, status, dates, ratings, and notes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exportState === 'exporting'}
            className="shrink-0 rounded-full border border-border px-4 py-2 font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40 disabled:opacity-60"
          >
            {exportState === 'exporting' ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
        {exportState === 'error' && (
          <p className="font-ui text-xs text-accent-cold">Couldn't export your data. Try again.</p>
        )}
      </div>
      </Section>

      <footer className="border-t border-border pt-6">
        <p className="font-ui text-xs text-muted">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </Page>
  )
}
