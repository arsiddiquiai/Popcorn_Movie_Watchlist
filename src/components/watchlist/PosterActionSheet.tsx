import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BottomSheet } from '../ui/BottomSheet'
import { shareMovie } from '../../lib/share'
import type { WatchlistEntry } from '../../lib/watchlist'
import type { WatchlistStatus } from '../../lib/database.types'

interface PosterActionSheetProps {
  open: boolean
  onClose: () => void
  entry: WatchlistEntry
  status: WatchlistStatus
  onMarkWatched: () => Promise<void>
  onBury: () => Promise<void>
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
 * Long-press (400ms) action sheet on any watchlist poster (DESIGN.md §5):
 * Add / Rate / Share / Bury. Every row here also has an ordinary tap
 * equivalent elsewhere in the app — this sheet is an accelerant, not a
 * second UI that only exists here:
 *   Add   — every card in this list is already on the watchlist by
 *           definition, so this slot shows that fact rather than a live
 *           action (matches SearchResultCard's own "Already on your
 *           list" state for the same situation).
 *   Rate  — only meaningful once watched (you can't rate an unwatched
 *           film); before that this slot is "Mark as Watched" instead,
 *           the same action swiping right already offers. Once watched,
 *           it opens Movie Detail, where the rating bottom sheet already
 *           lives — not a second rating UI built here.
 *   Share — a plain movie link via the Web Share API (lib/share.ts).
 *   Bury  — identical to swiping left; Movie Detail's own "Remove from
 *           list" is the same action's third path.
 */
export function PosterActionSheet({ open, onClose, entry, status, onMarkWatched, onBury }: PosterActionSheetProps) {
  const { movie } = entry
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'done'>('idle')
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    if (shareState === 'sharing') return
    setShareState('sharing')
    const outcome = await shareMovie(movie.title, movie.tmdb_id)
    setShareState(outcome === 'failed' ? 'idle' : 'done')
    if (outcome !== 'failed') setTimeout(() => setShareState('idle'), 2000)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={movie.title}>
      <div className="flex flex-col gap-1">
        <Row label="Already on your list" tone="muted" disabled />

        {status === 'watched' ? (
          <Row label="Rate this film" href={`/movie/${movie.tmdb_id}`} onClick={onClose} />
        ) : (
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

        <Row
          label="Bury"
          tone="cold"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void onBury().finally(() => setBusy(false))
          }}
        />
      </div>
    </BottomSheet>
  )
}
