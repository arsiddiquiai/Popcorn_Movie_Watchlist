import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeProvider'

const TRIGGER_DISTANCE = 64
const MAX_PULL = 110

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

/**
 * Pull-to-refresh on Shelf and Search (DESIGN.md §5). Only engages when the
 * page is already scrolled to the very top — otherwise an ordinary
 * downward scroll would get hijacked into a refresh gesture. Resistance is
 * a plain damped ratio (pull feels heavier the further past the trigger
 * distance it goes) rather than physics, which is enough for "slow
 * sweeping" per CLAUDE.md's motion rules without inventing a spring model.
 *
 * The non-gesture equivalent lives on the caller's side (a visible Refresh
 * button next to the tabs on Shelf, and next to the search field on
 * Search) — this component only owns the gesture itself.
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { reducedMotion } = useTheme()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  // Mirrors the `tracking` ref below into render-safe state — the ref
  // alone drives the touch-handler logic (fine to read/write inside event
  // handlers), but the transition style needs to react to it, and reading
  // a ref's .current during render isn't safe to rely on.
  const [isTracking, setIsTracking] = useState(false)
  const startY = useRef<number | null>(null)
  const tracking = useRef(false)

  function handleTouchStart(event: TouchEvent) {
    if (refreshing) return
    // Only start tracking if the page itself is at the very top — lets an
    // ordinary scroll-down-then-up pass straight through untouched.
    if ((document.scrollingElement?.scrollTop ?? 0) > 0) return
    startY.current = event.touches[0]?.clientY ?? null
    tracking.current = true
    setIsTracking(true)
  }

  function handleTouchMove(event: TouchEvent) {
    if (!tracking.current || startY.current === null) return
    const delta = (event.touches[0]?.clientY ?? 0) - startY.current
    if (delta <= 0) {
      setPull(0)
      return
    }
    // Damped so the further past the trigger distance it's pulled, the
    // less additional travel each pixel of finger movement buys — a
    // resistance curve, not a hard cap.
    const damped = delta < TRIGGER_DISTANCE ? delta : TRIGGER_DISTANCE + (delta - TRIGGER_DISTANCE) * 0.35
    setPull(Math.min(MAX_PULL, damped))
  }

  async function handleTouchEnd() {
    if (!tracking.current) return
    tracking.current = false
    setIsTracking(false)
    startY.current = null

    if (pull >= TRIGGER_DISTANCE) {
      setRefreshing(true)
      setPull(TRIGGER_DISTANCE)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPull(0)
      }
    } else {
      setPull(0)
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={() => void handleTouchEnd()}>
      <div
        aria-hidden="true"
        className="flex items-center justify-center overflow-hidden font-ui text-xs text-muted"
        style={{
          height: pull,
          transition: reducedMotion || isTracking ? undefined : 'height var(--transition-base) var(--ease-standard)',
        }}
      >
        {pull > 8 && (
          <motion.span
            animate={reducedMotion ? undefined : { rotate: refreshing ? 360 : pull >= TRIGGER_DISTANCE ? 180 : 0 }}
            transition={refreshing ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : { duration: 0.15 }}
            className="grid h-6 w-6 place-items-center rounded-full border-2 border-muted/30 border-t-accent-warm"
          />
        )}
      </div>
      {children}
    </div>
  )
}
