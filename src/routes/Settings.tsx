import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Page, PageHeader, Section } from '../components/layout/Page'
import { ByokError, deleteApiKey, getSavedKeyMeta, saveApiKey, type SavedKeyMeta } from '../lib/byokClient'
import { DeleteAccountError, deleteAccount } from '../lib/deleteAccountClient'
import type { AiProvider } from '../lib/database.types'
import { downloadWatchlistCsv } from '../lib/exportData'
import { useTheme } from '../theme/ThemeProvider'
import type { Theme } from '../theme/types'

const themeOptions: { id: Theme; label: string; description: string }[] = [
  { id: 'nightcap', label: 'Nightcap', description: 'Dark and warm. The default.' },
  { id: 'daylight', label: 'Daylight', description: 'Light, bright, high contrast.' },
  { id: 'neon', label: 'Neon', description: 'Marquee magenta and cyan on violet-black.' },
]

const PROVIDER_LABELS: Record<AiProvider, string> = { anthropic: 'Anthropic (Claude)', openai: 'OpenAI', gemini: 'Google Gemini' }
const MODEL_PLACEHOLDERS: Record<AiProvider, string> = {
  anthropic: 'e.g. claude-sonnet-5 (optional — defaults to Haiku)',
  openai: 'e.g. gpt-5.6 (optional — defaults to the cheapest tier)',
  gemini: 'e.g. gemini-3.7-pro (optional — defaults to Flash)',
}

type ExportState = 'idle' | 'exporting' | 'error'
const DELETE_CONFIRM_PHRASE = 'DELETE'

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()
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

  // ---- BYOK ----
  const [savedKey, setSavedKey] = useState<SavedKeyMeta | null | 'loading'>('loading')
  const [byokProvider, setByokProvider] = useState<AiProvider>('anthropic')
  const [byokKey, setByokKey] = useState('')
  const [byokModelPref, setByokModelPref] = useState('')
  const [byokState, setByokState] = useState<'idle' | 'saving' | 'removing'>('idle')
  const [byokError, setByokError] = useState<string | null>(null)

  useEffect(() => {
    getSavedKeyMeta()
      .then((meta) => setSavedKey(meta))
      .catch(() => setSavedKey(null))
  }, [])

  async function handleSaveKey(event: React.FormEvent) {
    event.preventDefault()
    if (!byokKey.trim() || byokState !== 'idle') return
    setByokState('saving')
    setByokError(null)
    try {
      await saveApiKey(byokProvider, byokKey.trim(), byokModelPref.trim() || null)
      setSavedKey({ provider: byokProvider, model_pref: byokModelPref.trim() || null, created_at: new Date().toISOString() })
      setByokKey('')
      setByokModelPref('')
    } catch (err) {
      setByokError(err instanceof ByokError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setByokState('idle')
    }
  }

  async function handleRemoveKey() {
    if (byokState !== 'idle') return
    setByokState('removing')
    setByokError(null)
    try {
      await deleteApiKey()
      setSavedKey(null)
    } catch (err) {
      setByokError(err instanceof ByokError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setByokState('idle')
    }
  }

  // ---- Danger zone: account deletion ----
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteStep, setDeleteStep] = useState<'closed' | 'confirming' | 'deleting'>('closed')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteReady = deleteConfirmText === DELETE_CONFIRM_PHRASE

  async function handleConfirmDelete() {
    if (!deleteReady || deleteStep === 'deleting') return
    setDeleteStep('deleting')
    setDeleteError(null)
    try {
      await deleteAccount()
      navigate('/account-deleted', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof DeleteAccountError ? err.message : 'Something went wrong. Try again.')
      setDeleteStep('confirming')
    }
  }

  return (
    <Page>
      <PageHeader title="Settings" subtitle="Appearance, motion, your data, and your AI provider." />

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
                {/* A live miniature of the theme, not an abstract two-tone
                    chip: three poster rectangles, a text line and an accent
                    pill, all reading their own colours through the nested
                    data-theme scope. That scoping is exactly why the tokens
                    were kept out of :root-only scope in index.css. */}
                <span
                  data-theme={option.id}
                  aria-hidden="true"
                  className="flex h-12 w-[72px] flex-col justify-between overflow-hidden rounded-md border border-border bg-bg p-1.5"
                >
                  <span className="flex gap-1">
                    <span className="h-4 w-1/3 rounded-xs bg-surface-2" />
                    <span className="h-4 w-1/3 rounded-xs bg-surface-2" />
                    <span className="h-4 w-1/3 rounded-xs bg-surface-2" />
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1 flex-1 rounded-full bg-text/70" />
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent-warm" />
                  </span>
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

      <Section title="Your own AI key">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface px-5 py-5">
          <p className="max-w-prose font-ui text-xs leading-relaxed text-muted">
            Popcorn's AI features (Pick For Me, Cinema Bridge, Taste DNA, the Movie Assistant) run on a shared key by
            default, so they work for everyone immediately — this is entirely optional. Adding your own key routes
            those calls through your own account instead, useful for heavier usage or to pick a more capable model.
            If your key ever fails, Popcorn quietly falls back to the shared key rather than breaking the feature.
          </p>

          {savedKey === 'loading' ? (
            <p className="font-ui text-xs text-muted-subtle">Checking…</p>
          ) : savedKey ? (
            <div className="flex items-center justify-between gap-4 rounded-md border border-accent-warm/30 bg-accent-warm/5 px-4 py-3">
              <div>
                <p className="font-ui text-sm font-semibold text-text">
                  Key saved •••• <span className="text-muted">({PROVIDER_LABELS[savedKey.provider]})</span>
                </p>
                <p className="mt-0.5 font-ui text-xs text-muted-subtle">
                  {savedKey.model_pref ? `Model: ${savedKey.model_pref} · ` : ''}
                  Added {new Date(savedKey.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleRemoveKey()}
                disabled={byokState !== 'idle'}
                className="shrink-0 rounded-full border border-border px-4 py-2 font-ui text-xs text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-cold/40 disabled:opacity-60"
              >
                {byokState === 'removing' ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSaveKey(e)} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  value={byokProvider}
                  onChange={(e) => setByokProvider(e.target.value as AiProvider)}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5 font-ui text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] focus:border-accent-warm"
                >
                  {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
                <input
                  type="password"
                  value={byokKey}
                  onChange={(e) => setByokKey(e.target.value)}
                  placeholder="Paste your API key"
                  autoComplete="off"
                  className="rounded-lg border border-border bg-surface px-3 py-2.5 font-ui text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-warm sm:col-span-2"
                />
              </div>
              <input
                type="text"
                value={byokModelPref}
                onChange={(e) => setByokModelPref(e.target.value)}
                placeholder={MODEL_PLACEHOLDERS[byokProvider]}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 font-ui text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-warm"
              />
              {byokError && <p className="font-ui text-xs text-accent-cold">{byokError}</p>}
              <button
                type="submit"
                disabled={byokState !== 'idle' || !byokKey.trim()}
                className="self-start rounded-full border border-border px-5 py-2.5 font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40 disabled:opacity-60"
              >
                {byokState === 'saving' ? 'Saving…' : 'Save key'}
              </button>
            </form>
          )}
        </div>
      </Section>

      {/* Danger zone — visually separated (accent-cold border, its own
          background tint) so it never reads as just another settings row. */}
      <Section title="Danger zone">
        <div className="flex flex-col gap-4 rounded-lg border border-accent-cold/40 bg-accent-cold/5 px-5 py-5">
          <div>
            <h3 className="font-ui text-sm font-semibold text-text">Delete my account</h3>
            <p className="mt-1 max-w-prose font-ui text-xs leading-relaxed text-muted">
              Permanently deletes your profile, watchlist, ratings, AI history, and any saved API key. This cannot be
              undone.
            </p>
          </div>

          {deleteStep === 'closed' && (
            <button
              type="button"
              onClick={() => setDeleteStep('confirming')}
              className="self-start rounded-full border border-accent-cold/50 bg-accent-cold/10 px-5 py-2.5 font-ui text-sm font-semibold text-accent-cold transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-cold/20"
            >
              Delete my account
            </button>
          )}

          {deleteStep !== 'closed' && (
            <div className="flex flex-col gap-3 rounded-md border border-accent-cold/30 bg-bg/40 px-4 py-4">
              <p className="font-ui text-xs leading-relaxed text-text">
                Type <span className="font-mono font-semibold">{DELETE_CONFIRM_PHRASE}</span> to confirm. There is no
                undo.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deleteStep === 'deleting'}
                placeholder={DELETE_CONFIRM_PHRASE}
                className="w-full max-w-xs rounded-lg border border-accent-cold/40 bg-surface px-3 py-2.5 font-mono text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] focus:border-accent-cold disabled:opacity-60"
              />
              {deleteError && <p className="font-ui text-xs text-accent-cold">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleConfirmDelete()}
                  disabled={!deleteReady || deleteStep === 'deleting'}
                  className="rounded-full bg-accent-cold px-5 py-2.5 font-ui text-sm font-semibold text-bg transition-opacity duration-[var(--transition-fast)] ease-[var(--ease-standard)] disabled:opacity-40"
                >
                  {deleteStep === 'deleting' ? 'Deleting…' : 'Permanently delete my account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStep('closed')
                    setDeleteConfirmText('')
                    setDeleteError(null)
                  }}
                  disabled={deleteStep === 'deleting'}
                  className="rounded-full border border-border px-5 py-2.5 font-ui text-sm text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-muted/40 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-6">
        <p className="font-ui text-xs text-muted">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </Page>
  )
}
