import { useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

interface UseLongPressOptions {
  onLongPress: () => void
  delay?: number
  disabled?: boolean
}

/**
 * Long-press (400ms default, DESIGN.md §5) via pointer events, with the
 * browser's own native image/link context menu explicitly suppressed.
 *
 * Framer Motion's `drag` prop does this automatically for a draggable
 * element (it sets touchAction/WebkitTouchCallout/userSelect the moment
 * `drag` is truthy — confirmed directly in framer-motion's own source,
 * render/html/use-props.mjs). That's why long-press worked on Watchlist's
 * "want" tab (which drags) and silently fell through to the OS share/copy-
 * image menu everywhere else (Watched tab, Search results) that has no
 * drag prop to piggyback on. This hook is the same suppression, wired by
 * hand, for any card that needs long-press without also being draggable.
 */
export function useLongPress({ onLongPress, delay = 400, disabled = false }: UseLongPressOptions) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (disabled) return
    // Right-click / non-primary pointer shouldn't start a long-press timer.
    if (event.button !== undefined && event.button !== 0) return
    cancel()
    fired.current = false
    timer.current = setTimeout(() => {
      timer.current = null
      fired.current = true
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8)
      onLongPress()
    }, delay)
  }

  return {
    /** Spread directly onto the pressable element. Deliberately excludes
     *  `style` — a caller that also sets its own `style` (e.g. Framer's
     *  `x` motion value for a draggable card) would have it silently
     *  clobbered by a later spread, since JSX prop order determines which
     *  same-named prop wins. Merge `touchCalloutStyle` into that style
     *  object explicitly instead. */
    handlers: {
      onPointerDown,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
    },
    /** Merge into whatever `style` object the element already has. */
    touchCalloutStyle: { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as const,
    /** Call from onDragStart on a card that's also swipeable, so a real
     *  drag never also fires the long-press underneath it. */
    cancel,
    /** True if the timer actually fired for the most recent press — lets a
     *  click handler suppress navigation when a long-press just opened a
     *  sheet, without also needing to track drag distance. */
    didFire: () => fired.current,
  }
}
