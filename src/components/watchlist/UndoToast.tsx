import { motion } from 'framer-motion'
import { useTheme } from '../../theme/ThemeProvider'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

/** The 5-second undo toast for the swipe-to-watch / swipe-to-bury gestures
 *  (DESIGN.md §5). Rendered inside an AnimatePresence by the caller, which
 *  also owns the 5s auto-dismiss timer — this component is just the UI. */
export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  const { reducedMotion } = useTheme()

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)' }}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2.5 shadow-[var(--shadow-lift)]">
        <span className="font-ui text-sm text-text">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 font-ui text-sm font-semibold text-accent-warm underline underline-offset-4"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-lg leading-none text-muted-subtle hover:text-text"
        >
          ×
        </button>
      </div>
    </motion.div>
  )
}
