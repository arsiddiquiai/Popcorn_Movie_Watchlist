import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeProvider'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Caps the panel's height as a percentage of the viewport. Defaults to
   *  85 (near-full-height, the common case). Movie Detail's rating sheet
   *  passes something smaller so the reactive poster hero stays visible
   *  above it while rating. */
  maxHeightVh?: number
}

/**
 * A generic mobile bottom sheet — backdrop + a panel sliding up from the
 * bottom, dismissed by tapping the backdrop, an explicit close control, or
 * Escape. Used for the rating panel on Movie Detail and the filter panel
 * on Search (DESIGN.md's live-review redesign pass), so both share one
 * dismiss/animate/reduced-motion implementation rather than two. Mirrors
 * the same backdrop+slide-panel recipe the old mobile nav drawer used
 * before DESIGN.md §4 removed it, so the pattern isn't new to this app.
 */
export function BottomSheet({ open, onClose, title, children, maxHeightVh = 85 }: BottomSheetProps) {
  const { reducedMotion } = useTheme()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
          }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
          <motion.div
            className="relative w-full max-w-xl overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 shadow-[var(--shadow-lift)]"
            style={{ maxHeight: `${maxHeightVh}vh`, paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            initial={reducedMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reducedMotion ? undefined : { y: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
            {title && <h2 className="mb-4 font-display text-lg font-semibold text-text">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
