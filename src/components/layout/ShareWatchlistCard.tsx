import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { DECAY_RESCUE_THRESHOLD, decayLevelForAddedAt } from '../../lib/decay'
import { fetchWatchlistByStatus, type WatchlistEntry } from '../../lib/watchlist'
import {
  readShareCardTheme,
  renderShareCard,
  shareOrDownloadCard,
  type ShareCardAspect,
  type ShareCardPoster,
} from '../../lib/shareCard'
import { getOrCreateShareToken, shareUrlFor } from '../../lib/shareLink'
import { computeTasteBadge } from '../../lib/tasteBadge'
import { tmdbImageUrl } from '../../lib/tmdbClient'
import { requestVerdict } from '../../lib/verdictClient'
import { useTheme } from '../../theme/ThemeProvider'

// Matches shareCard.ts's own 3x2 grid — kept as a named constant here too
// so this file's slice and that file's layout math can't silently drift
// apart if either changes.
const POSTER_COUNT = 6

type State = 'idle' | 'working' | 'error'
type CardType = 'watchlist' | 'buried'

/**
 * Card title — DESIGN.md live-review: never the account's email. Uses the
 * display name from signup (Supabase auth's own user_metadata — no query,
 * no migration) when the user set one there, since typing an optional name
 * into a field the app has never shown anywhere else is the closest thing
 * to opt-in consent available without building a real public/shareable
 * toggle (out of scope for a share-card visual pass, and there's no way
 * for this session to run the migration one would need anyway). No name
 * set -> stays anonymous.
 */
function cardTitle(displayName: unknown): string {
  const name = typeof displayName === 'string' ? displayName.trim() : ''
  return name ? `${name}'s Watchlist` : 'My Watchlist'
}

/** Oldest "want" items that have crossed the decay-rescue threshold (60+
 *  days unwatched — DECAY_RESCUE_THRESHOLD, the same number the Decay
 *  Shelf's own rescue-or-bury prompt uses), sorted longest-neglected first.
 *
 *  The brief's first choice for "Most Buried" was literally status='dropped'
 *  items sorted by how long they've sat there — but watchlist_items has no
 *  dropped_at column, only added_at (set once, at original add time) and
 *  watched_at. Adding one would mean an ALTER TABLE on the same table every
 *  core mutation (mark watched, bury, restore, add) writes to, and per this
 *  project's "no DB credentials" constraint that migration can't be
 *  guaranteed to have run by the time this code deploys — writing a column
 *  that might not exist yet into removeFromWatchlist/restoreDropped would
 *  risk breaking the actual bury/restore flow, not just this card. The
 *  brief explicitly names this exact fallback as acceptable ("oldest
 *  un-watched want items past a threshold, if dropped items are usually
 *  restored quickly"), so that's what this uses — zero schema risk, and it
 *  reuses the Decay Shelf's own already-tuned threshold rather than
 *  inventing a new one. */
function findMostBuried(wantEntries: WatchlistEntry[]): WatchlistEntry[] {
  return wantEntries
    .filter((entry) => entry.movie.poster_path && decayLevelForAddedAt(entry.item.added_at) >= DECAY_RESCUE_THRESHOLD)
    .sort((a, b) => new Date(a.item.added_at).getTime() - new Date(b.item.added_at).getTime())
}

/**
 * Entry point for the shareable watchlist card (live-review redesign) —
 * lives on the You tab. Offers two card types (My Watchlist / Most Buried)
 * and two formats (Story 9:16, the default/primary per the share-card
 * extension brief, and Classic). Pulls posters, an AI-generated verdict
 * line (best-effort — see requestVerdict's own doc comment on why a
 * failure there never blocks the card) and a self-relative taste badge,
 * renders the canvas card themed to whichever theme is active right now,
 * and hands it to the Web Share API with a PNG-download fallback.
 */
export function ShareWatchlistCard() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [cardType, setCardType] = useState<CardType>('watchlist')
  const [aspect, setAspect] = useState<ShareCardAspect>('story')
  const [buriedAvailable, setBuriedAvailable] = useState(true)

  async function handleShare() {
    if (!user || state === 'working') return
    setState('working')
    setMessage(null)

    try {
      let posters: ShareCardPoster[]
      let title: string
      let statLine: string
      let badge: string | null = null
      // The public /w/{token} link always reflects the sharer's CURRENT
      // want-list (see api/share.ts) — genuinely accurate for the
      // watchlist card, but actively misleading on a Most Buried card
      // (that page shows what someone still wants to watch, not what
      // they've buried), so it's only attached to the watchlist card type.
      let shareUrl: string | undefined
      let verdict: string | null = null

      if (cardType === 'buried') {
        const want = await fetchWatchlistByStatus(user.id, 'want')
        const buried = findMostBuried(want)
        if (buried.length === 0) {
          setState('error')
          setMessage('Nothing buried yet — items decay after 60 days unwatched.')
          setBuriedAvailable(false)
          return
        }
        posters = buried.slice(0, POSTER_COUNT).map((entry) => ({
          url: tmdbImageUrl(entry.movie.poster_path, 'w342') ?? '',
          title: entry.movie.title,
        }))
        title = 'My Graveyard'
        statLine = `${buried.length} film${buried.length === 1 ? '' : 's'} buried and forgotten`
        badge = computeTasteBadge(buried.map((entry) => entry.movie.genres))
      } else {
        const watched = await fetchWatchlistByStatus(user.id, 'watched')
        const ranked = watched
          .filter((entry) => entry.score !== null && entry.movie.poster_path)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

        let source = ranked
        statLine = `${ranked.length} film${ranked.length === 1 ? '' : 's'} rated`

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

        posters = source.slice(0, POSTER_COUNT).map((entry) => ({
          url: tmdbImageUrl(entry.movie.poster_path, 'w342') ?? '',
          title: entry.movie.title,
        }))
        title = cardTitle(user.user_metadata?.display_name)
        badge = computeTasteBadge(source.map((entry) => entry.movie.genres))

        try {
          const token = await getOrCreateShareToken()
          shareUrl = shareUrlFor(token)
        } catch (err) {
          console.error('Could not create a share link:', err)
          // The image card is still useful on its own — a failed link
          // shouldn't block generating it.
        }

        try {
          const result = await requestVerdict()
          verdict = result.verdict_text
        } catch (err) {
          console.error('Could not generate a verdict line:', err)
          // Decorative — the card is still complete without it.
        }
      }

      const blob = await renderShareCard(posters, readShareCardTheme(), title, statLine, shareUrl, verdict, badge, aspect)
      const filename = cardType === 'buried' ? 'popcorn-graveyard.png' : 'popcorn-watchlist.png'
      const outcome = await shareOrDownloadCard(blob, filename, shareUrl)

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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-sm font-medium text-text">
            {cardType === 'buried' ? 'Share your graveyard' : 'Share your watchlist'}
          </p>
          <p className="mt-0.5 font-ui text-xs text-muted">
            {cardType === 'buried' ? 'The films you gave up on.' : `A card of your top posters, themed to ${theme}.`}
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

      <div className="flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label="Card type" className="flex gap-1 rounded-full border border-border p-0.5">
          {(
            [
              { id: 'watchlist' as const, label: 'My Watchlist' },
              { id: 'buried' as const, label: 'Most Buried', disabled: !buriedAvailable },
            ]
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={cardType === option.id}
              disabled={option.disabled}
              onClick={() => setCardType(option.id)}
              className={`rounded-full px-3 py-1 font-ui text-xs transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] disabled:opacity-40 ${
                cardType === option.id ? 'bg-accent-warm text-bg' : 'text-muted hover:text-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Card format" className="flex gap-1 rounded-full border border-border p-0.5">
          {(
            [
              { id: 'story' as const, label: 'Story' },
              { id: 'classic' as const, label: 'Classic' },
            ]
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={aspect === option.id}
              onClick={() => setAspect(option.id)}
              className={`rounded-full px-3 py-1 font-ui text-xs transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
                aspect === option.id ? 'bg-accent-warm text-bg' : 'text-muted hover:text-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
