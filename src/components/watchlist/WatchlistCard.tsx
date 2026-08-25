import { useRef, useState } from 'react'
import { animate, useMotionValue, useTransform, motion, type PanInfo } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { MoreIcon } from '../layout/icons'
import { useLongPress } from '../ui/useLongPress'
import { decayHairlineWidth, decayPosterStyle, DECAY_RESCUE_THRESHOLD } from '../../lib/decay'
import { formatRuntime } from '../../lib/format'
import { isFavoriteScore, mix, rgbString } from '../../lib/ratingScale'
import { posterLayoutId } from '../../lib/sharedElement'
import { tmdbImageUrl } from '../../lib/tmdbClient'
import type { WatchlistEntry } from '../../lib/watchlist'
import { addToWatchlist, markAsWatched, refreshAddedAt, removeFromWatchlist, unmarkWatched } from '../../lib/watchlist'
import { useTheme } from '../../theme/ThemeProvider'
import { PosterActionSheet } from './PosterActionSheet'
import { useDecayColors } from './useDecayColors'

/** Session-only dismissal for the rescue-or-bury prompt — "don't be naggy"
 *  per CLAUDE.md, but this doesn't need a new DB column: a browser tab
 *  restart is a reasonable point to ask again about something that's still
 *  sitting unwatched. */
const DISMISS_KEY_PREFIX = 'popcorn:decay-dismissed:'

function isDismissed(itemId: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY_PREFIX + itemId) === '1'
  } catch {
    return false
  }
}

function dismiss(itemId: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY_PREFIX + itemId, '1')
  } catch {
    // Storage can be unavailable (private mode, quota) — the prompt just
    // reappears next render in that case, which is a fine fallback.
  }
}

// DESIGN.md §5: "Threshold 88px or velocity > 0.4." Framer's PanInfo
// velocity is px/second, and 0.4 read as px/ms (the usual convention for a
// "flick" threshold in gesture libraries) is 400px/s.
const SWIPE_DISTANCE_THRESHOLD = 88
const SWIPE_VELOCITY_THRESHOLD = 400
const EASE_STANDARD = [0.22, 1, 0.36, 1] as const

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

function BuryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v13M6 12l6 6 6-6" />
    </svg>
  )
}

/** What WatchlistCard reports up after a committed swipe or long-press
 *  action, so the parent list can optimistically remove the entry and run
 *  the 5s undo toast (DESIGN.md §5) — one shared shape for both gesture
 *  paths rather than two. */
export interface SwipeAction {
  entry: WatchlistEntry
  kind: 'watched' | 'buried' | 'moved_to_want'
  revert: () => Promise<void>
}

interface WatchlistCardProps {
  entry: WatchlistEntry
  /** 0 (fresh) to 1 (fully decayed) — only meaningful when decayEnabled.
   *  Undefined/0 renders identically to the pre-decay card. */
  decayLevel?: number
  /** Whether this card sits on the decay shelf at all (the "want" tab) —
   *  gates the hairline, the rescue-or-bury prompt, and the swipe-to-
   *  commit drag itself. Long-press and the "..." menu are NOT gated by
   *  this — they're available on both want and watched cards, which is
   *  exactly the bug report this fixed: long-press only worked where
   *  dragging also did, because Framer's drag prop is what was silently
   *  suppressing the OS's own image context menu. */
  decayEnabled?: boolean
  /** Called after "Keep it" or "Remove" succeeds, so the parent list can
   *  update its source-of-truth entries (new added_at, or drop the item). */
  onDecayResolved?: (itemId: string, action: 'kept' | 'removed', newAddedAt?: string) => void
  /** Called after a swipe or long-press action commits — see SwipeAction. */
  onSwipeAction?: (action: SwipeAction) => void
}

export function WatchlistCard({ entry, decayLevel = 0, decayEnabled = false, onDecayResolved, onSwipeAction }: WatchlistCardProps) {
  const { movie, score, item } = entry
  const { user } = useAuth()
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')
  const runtime = formatRuntime(movie.runtime_minutes)
  const { reducedMotion } = useTheme()
  const decayColors = useDecayColors()
  const [pending, setPending] = useState(false)
  const [dismissed, setDismissed] = useState(() => isDismissed(item.id))
  const [sheetOpen, setSheetOpen] = useState(false)

  const decayed = decayEnabled && decayLevel > 0
  const rescueEligible = decayEnabled && decayLevel >= DECAY_RESCUE_THRESHOLD && !dismissed
  const hairlineWidth = decayHairlineWidth(decayLevel)
  const hairlineColor = rgbString(mix(decayColors.fresh, decayColors.decayed, Math.min(1, Math.max(0, decayLevel))))
  // Applied unconditionally (decayLevel 0 resolves to the "fresh" no-op
  // filter) rather than only when decayed, so the filter/transition
  // properties are already present on the element when decayLevel changes
  // — e.g. after "Keep it" resets it to 0 — letting the transition actually
  // animate between values instead of the properties just disappearing.
  //
  // The decayed state itself stays visible regardless of reduced-motion —
  // it's a static state, not motion. Only the transition INTO/OUT OF it is
  // gated, per CLAUDE.md's reduced-motion rule.
  const posterStyle = {
    ...decayPosterStyle(decayLevel),
    transition: reducedMotion ? undefined : 'filter var(--transition-slow) var(--ease-standard)',
  }

  // Swipe-to-commit only applies on the decay shelf (want tab); long-press
  // applies everywhere a card isn't mid-rescue-prompt (DESIGN.md §5 — see
  // the prop comment above for why these are no longer the same gate).
  const swipeActive = decayEnabled && !rescueEligible
  const longPressActive = !rescueEligible
  const x = useMotionValue(0)
  const rightRevealOpacity = useTransform(x, [0, SWIPE_DISTANCE_THRESHOLD], [0, 1])
  const leftRevealOpacity = useTransform(x, [-SWIPE_DISTANCE_THRESHOLD, 0], [1, 0])
  const draggedRef = useRef(false)
  const [swiping, setSwiping] = useState(false)

  const longPress = useLongPress({
    disabled: !longPressActive || pending,
    onLongPress: () => setSheetOpen(true),
  })

  async function commitMarkWatched() {
    if (pending) return
    setPending(true)
    try {
      await markAsWatched(item.id)
      onSwipeAction?.({ entry, kind: 'watched', revert: () => unmarkWatched(item.id) })
    } finally {
      setPending(false)
    }
  }

  async function commitBury() {
    if (pending || !user) return
    setPending(true)
    try {
      await removeFromWatchlist(item.id)
      onSwipeAction?.({
        entry,
        kind: 'buried',
        revert: async () => void (await addToWatchlist(movie.tmdb_id, user.id)),
      })
    } finally {
      setPending(false)
    }
  }

  async function commitMoveToWant() {
    if (pending) return
    setPending(true)
    try {
      await unmarkWatched(item.id)
      onSwipeAction?.({ entry, kind: 'moved_to_want', revert: () => markAsWatched(item.id) })
    } finally {
      setPending(false)
    }
  }

  async function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const distance = info.offset.x
    const velocity = info.velocity.x
    const passedRight = distance >= SWIPE_DISTANCE_THRESHOLD || velocity >= SWIPE_VELOCITY_THRESHOLD
    const passedLeft = distance <= -SWIPE_DISTANCE_THRESHOLD || velocity <= -SWIPE_VELOCITY_THRESHOLD

    if (passedRight) {
      setSwiping(true)
      await animate(x, window.innerWidth, { duration: reducedMotion ? 0 : 0.3, ease: 'easeIn' }).finished
      await commitMarkWatched()
      // The list removes this entry once onSwipeAction fires above — by
      // then the card is already off-screen, so no visible jump.
      return
    }
    if (passedLeft) {
      setSwiping(true)
      await animate(x, -window.innerWidth, { duration: reducedMotion ? 0 : 0.3, ease: 'easeIn' }).finished
      await commitBury()
      return
    }
    // Incomplete swipe — spring back on --ease-standard rather than a
    // physics spring, per DESIGN.md's own wording.
    void animate(x, 0, { duration: reducedMotion ? 0 : 0.28, ease: EASE_STANDARD })
  }

  async function handleKeep(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    setPending(true)
    try {
      const newAddedAt = await refreshAddedAt(item.id)
      dismiss(item.id)
      setDismissed(true)
      onDecayResolved?.(item.id, 'kept', newAddedAt)
    } finally {
      setPending(false)
    }
  }

  async function handleRemove(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    setPending(true)
    try {
      await removeFromWatchlist(item.id)
      dismiss(item.id)
      onDecayResolved?.(item.id, 'removed')
    } finally {
      setPending(false)
    }
  }

  function handleDismiss(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    dismiss(item.id)
    setDismissed(true)
  }

  const cardBody = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-poster bg-surface shadow-none transition-shadow duration-[var(--transition-base)] ease-[var(--ease-standard)] group-active:shadow-[var(--shadow-lift)]">
        {posterUrl ? (
          <motion.img
            layoutId={posterLayoutId(movie.tmdb_id)}
            src={posterUrl}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover"
            style={posterStyle}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted"
            style={posterStyle}
          >
            {movie.title}
          </div>
        )}
        {score !== null && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent-warm px-2 py-0.5 font-mono text-[11px] font-medium text-bg">
            {isFavoriteScore(score) && (
              <span aria-label="Favorite" title="Favorite (9+)" className="leading-none">
                ★
              </span>
            )}
            {score}/10
          </span>
        )}

        {longPressActive && (
          // Persistent, always-visible tap alternative to long-press
          // (DESIGN.md §5) — doesn't depend on the gesture working at all.
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setSheetOpen(true)
            }}
            aria-label="More actions"
            className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-bg/60 text-text backdrop-blur-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-bg/80"
          >
            <MoreIcon />
          </button>
        )}

        {rescueEligible && (
          // A full-height gradient scrim rather than the hard-edged strip this
          // used to be: a solid box pasted across the poster's bottom third was
          // the roughest element on the watchlist. The gradient lets it read as
          // part of the poster, and gives the copy enough room to sit at a
          // legible size instead of 11px.
          <div className="absolute inset-0 flex flex-col justify-end gap-3 bg-gradient-to-t from-bg via-bg/85 via-45% to-transparent p-4">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Not now"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-lg leading-none text-muted-subtle transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-surface hover:text-text"
            >
              ×
            </button>

            <p className="font-display text-sm leading-snug font-semibold text-text">
              Still want to watch this?
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={(e) => void handleKeep(e)}
                disabled={pending}
                className="w-full rounded-full border border-accent-warm/50 bg-accent-warm/15 px-3 py-2 font-ui text-xs font-semibold text-accent-warm transition-[background-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-accent-warm/25 active:scale-[0.97] disabled:opacity-60"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={(e) => void handleRemove(e)}
                disabled={pending}
                className="w-full rounded-full border border-border px-3 py-2 font-ui text-xs text-muted transition-[color,border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-muted/40 hover:text-text active:scale-[0.97] disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {decayEnabled && (
          // The decay hairline (DESIGN.md §1) — no numbers, no tooltip, just
          // a line that shortens and cools as the movie sits unwatched.
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-px -translate-x-1/2 transition-[width,background-color] duration-[var(--transition-slow)] ease-[var(--ease-standard)]"
            style={{ width: `${hairlineWidth}%`, backgroundColor: hairlineColor }}
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        {/* min-h reserves 2 lines' worth of height regardless of the
            actual title length, so a 1-line title next to a 2-line title
            in the same grid row doesn't leave the badge/meta row below it
            sitting at two different heights (live-review fix). */}
        <h3
          className={`line-clamp-2 min-h-[2.5em] font-ui text-[13px] leading-[1.25] font-semibold transition-colors duration-[var(--transition-base)] ease-[var(--ease-standard)] ${decayed ? 'text-muted' : 'text-text'}`}
          title={movie.title}
        >
          {movie.title}
        </h3>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-subtle">
          <span>{movie.release_year ?? '—'}</span>
          {runtime && (
            <>
              <span aria-hidden="true">·</span>
              <span>{runtime}</span>
            </>
          )}
        </div>
      </div>
    </>
  )

  const actionSheet = (
    <PosterActionSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      title={movie.title}
      tmdbId={movie.tmdb_id}
      status={item.status}
      onMarkWatched={async () => {
        await commitMarkWatched()
        setSheetOpen(false)
      }}
      onMoveToWant={async () => {
        await commitMoveToWant()
        setSheetOpen(false)
      }}
      onBury={async () => {
        await commitBury()
        setSheetOpen(false)
      }}
    />
  )

  if (!swipeActive) {
    return (
      <div className="relative">
        <Link
          to={`/movie/${movie.tmdb_id}`}
          className="group flex flex-col gap-3 transition-transform duration-[var(--transition-base)] ease-[var(--ease-standard)] hover:-translate-y-1.5"
          style={longPress.touchCalloutStyle}
          onClick={(event) => {
            if (longPress.didFire()) event.preventDefault()
          }}
          {...longPress.handlers}
        >
          {cardBody}
        </Link>
        {actionSheet}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Swipe reveals (DESIGN.md §5) — right for mark-watched
          (--accent-warm, check), left for bury (--muted-subtle, down
          arrow). Sit behind the draggable card, uncovered as it slides. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center rounded-poster pl-5"
        style={{ backgroundColor: 'var(--accent-warm)', opacity: rightRevealOpacity }}
      >
        <CheckIcon />
      </motion.div>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end rounded-poster pr-5"
        style={{ backgroundColor: 'var(--muted-subtle)', opacity: leftRevealOpacity }}
      >
        <BuryIcon />
      </motion.div>

      <motion.div
        drag="x"
        style={{ x, ...longPress.touchCalloutStyle }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={1}
        dragMomentum={false}
        onDragStart={longPress.cancel}
        onDrag={(_e, info) => {
          draggedRef.current = Math.abs(info.offset.x) > 5
        }}
        onDragEnd={(e, info) => void handleDragEnd(e, info)}
        className="relative bg-bg"
        {...longPress.handlers}
      >
        <Link
          to={`/movie/${movie.tmdb_id}`}
          draggable={false}
          onClick={(event) => {
            if (draggedRef.current || swiping || longPress.didFire()) {
              event.preventDefault()
              draggedRef.current = false
            }
          }}
          className="group flex flex-col gap-3"
        >
          {cardBody}
        </Link>
      </motion.div>

      {actionSheet}
    </div>
  )
}
