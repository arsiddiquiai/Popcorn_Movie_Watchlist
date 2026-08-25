import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BottomSheet } from '../ui/BottomSheet'
import { shareMovie } from '../../lib/share'
import type { WatchlistStatus } from '../../lib/database.types'

interface PosterActionSheetProps {
  open: boolean
  onClose: () => void
  title: string
  tmdbId: number
  /** 'not_on_list' covers Search results, where the film isn't on the
   *  watchlist at all yet — everything else is an existing
   *  watchlist_items.status. */
  status: WatchlistStatus | 'not_on_list'
  onAdd?: () => Promise<void>
  onMarkWatched?: () => Promise<void>
  onBury?: () => Promise<void>
}

function Row({
  label,
  onClick,
  href,
  disabled,
  tone = 'default',
}: {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  tone?: 'default' | 'muted' | 'cold'
}) {
  const toneClass =
    tone === 'muted' ? 'text-muted' : tone === 'cold' ? 'text-accent-cold' : 'text-text'
  const className = `block w-full rounded-lg px-4 py-3 text-left font-ui text-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-surface-2 disabled:opacity-50 ${toneClass}`

  if (href) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {label}
    </button>
  )
}

/**
 * Long-press (400ms) action sheet on any poster (DESIGN.md §5): Add / Rate
 * / Share / Bury. One shared component across every card variant —
 * Watchlist's want/watched tabs and Search results — rather than a
 * separate sheet per screen, with rows adapting to `status`:
 *   Add   — the real action on Search results (not on the list yet).
 *           On a watchlist card, every entry is already on the list by
 *           definition, so this slot shows that fact instead (matches
 *           SearchResultCard's own "Already on your list" button state).
 *   Rate  — only meaningful once watched (you can't rate an unwatched
 *           film); before that, and on Search results, this slot is
 *           "Mark as Watched" / hidden respectively. Once watched, it
 *           opens Movie Detail, where the rating bottom sheet already
 *           lives — not a second rating UI built here.
 *   Share — a plain movie link via the Web Share API (lib/share.ts),
 *           available everywhere.
 *   Bury  — identical to swiping left; not offered on Search results
 *           (nothing to bury yet) or the Buried tab (already buried, use
 *           its own visible Restore button instead).
 */
export function PosterActionSheet({ open, onClose, title, tmdbId, status, onAdd, onMarkWatched, onBury }: PosterActionSheetProps) {
  const [addState, setAddState] = useState<'idle' | 'adding' | 'added'>('idle')
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'done'>('idle')
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    if (shareState === 'sharing') return
    setShareState('sharing')
    const outcome = await shareMovie(title, tmdbId)
    setShareState(outcome === 'failed' ? 'idle' : 'done')
    if (outcome !== 'failed') setTimeout(() => setShareState('idle'), 2000)
  }

  const onWatchlist = status === 'want' || status === 'watched'

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1">
        {status === 'not_on_list' ? (
          <Row
            label={addState === 'adding' ? 'Adding…' : addState === 'added' ? 'Added ✓' : 'Add to Watchlist'}
            disabled={addState !== 'idle'}
            onClick={() => {
              if (!onAdd) return
              setAddState('adding')
              void onAdd()
                .then(() => setAddState('added'))
                .catch(() => setAddState('idle'))
            }}
          />
        ) : (
          <Row label="Already on your list" tone="muted" disabled />
        )}

        {status === 'watched' && <Row label="Rate this film" href={`/movie/${tmdbId}`} onClick={onClose} />}
        {status === 'want' && onMarkWatched && (
          <Row
            label="Mark as Watched"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void onMarkWatched().finally(() => setBusy(false))
            }}
          />
        )}

        <Row
          label={shareState === 'sharing' ? 'Sharing…' : shareState === 'done' ? 'Shared' : 'Share'}
          disabled={shareState === 'sharing'}
          onClick={() => void handleShare()}
        />

        {/* Gated on the handler actually being provided, not just status —
            a reused context (Search results, once a film is added) may
            not have a watchlist_items row id handy to bury by, and a
            visible-but-silently-broken action is worse than not showing
            it at all. */}
        {onWatchlist && onBury && (
          <Row
            label="Bury"
            tone="cold"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void onBury().finally(() => setBusy(false))
            }}
          />
        )}
      </div>
    </BottomSheet>
  )
}
