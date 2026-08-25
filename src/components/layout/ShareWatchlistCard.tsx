import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { fetchWatchlistByStatus } from '../../lib/watchlist'
import { renderShareCard, shareOrDownloadCard, type ShareCardPoster } from '../../lib/shareCard'
import { tmdbImageUrl } from '../../lib/tmdbClient'
import { useTheme } from '../../theme/ThemeProvider'

const POSTER_COUNT = 9

type State = 'idle' | 'working' | 'error'

function readThemeColors() {
  const styles = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    bg: get('--bg', '#161211'),
    surface: get('--surface', '#211b19'),
    text: get('--text', '#f2e9de'),
    muted: get('--muted', '#a89a8c'),
    accentWarm: get('--accent-warm', '#d4a24c'),
    hero: get('--hero', '#c8442d'),
  }
}

/**
 * Entry point for the shareable watchlist card (live-review redesign) —
 * lives on the You tab. Pulls the user's top-rated posters (falling back to
 * their "want" list for a cold-start account with nothing rated yet),
 * renders the canvas card themed to whichever theme is active right now,
 * and hands it to the Web Share API with a PNG-download fallback.
 */
export function ShareWatchlistCard() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleShare() {
    if (!user || state === 'working') return
    setState('working')
    setMessage(null)

    try {
      const watched = await fetchWatchlistByStatus(user.id, 'watched')
      const ranked = watched
        .filter((entry) => entry.score !== null && entry.movie.poster_path)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

      let source = ranked
      let statLine = `${ranked.length} film${ranked.length === 1 ? '' : 's'} rated`

      if (source.length < 3) {
        const want = await fetchWatchlistByStatus(user.id, 'want')
        source = want.filter((entry) => entry.movie.poster_path)
        statLine = `${source.length} film${source.length === 1 ? '' : 's'} on the watchlist`
      }

      if (source.length === 0) {
        setState('error')
        setMessage('Add a few films first — nothing to put on the card yet.')
        return
      }

      const posters: ShareCardPoster[] = source.slice(0, POSTER_COUNT).map((entry) => ({
        url: tmdbImageUrl(entry.movie.poster_path, 'w342') ?? '',
        title: entry.movie.title,
      }))

      const blob = await renderShareCard(posters, readThemeColors(), statLine)
      const outcome = await shareOrDownloadCard(blob)

      if (outcome === 'downloaded') setMessage('Saved — check your downloads.')
      if (outcome === 'failed') setMessage("Couldn't generate the card. Try again.")
      setState(outcome === 'failed' ? 'error' : 'idle')
    } catch {
      setState('error')
      setMessage("Couldn't generate the card. Try again.")
    }
  }

  return (
    // Unlike AccountHeader/PrimaryAccountActions/AccountFooterLinks, this
    // has no desktop equivalent anywhere else (Nav.tsx's sidebar doesn't
    // carry it) — so it renders on every breakpoint, not lg:hidden.
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
      <div className="min-w-0">
        <p className="font-ui text-sm font-medium text-text">Share your watchlist</p>
        <p className="mt-0.5 font-ui text-xs text-muted">
          A card of your top posters, themed to {theme}.
          {message && <span className="ml-1 text-accent-cold">{message}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={state === 'working'}
        className="btn-hero shrink-0 rounded-full px-4 py-2 font-ui text-xs font-semibold disabled:opacity-60"
      >
        {state === 'working' ? 'Making…' : 'Share'}
      </button>
    </div>
  )
}
