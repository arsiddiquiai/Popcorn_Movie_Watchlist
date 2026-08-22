import { AnimatePresence, motion } from 'framer-motion'

interface VerdictWordProps {
  verdict: string
  color: string
  reducedMotion: boolean
}

export function VerdictWord({ verdict, color, reducedMotion }: VerdictWordProps) {
  // Explicit guard rather than relying on MotionConfig: Framer Motion's
  // reduced-motion mode still plays opacity animations (it only drops
  // transforms), but the spec wants the word to swap instantly.
  if (reducedMotion) {
    return (
      <span className="block h-9 overflow-hidden whitespace-nowrap font-display text-2xl leading-9" style={{ color }}>
        {verdict}
      </span>
    )
  }

  return (
    // Fixed-height stage with both words absolutely positioned, so the
    // outgoing and incoming words genuinely overlap mid-fade instead of
    // reflowing past each other. nowrap matters here: the stage is only as
    // wide as its flex parent allows, and the two-word verdicts otherwise
    // wrap and spill out of it.
    <span className="relative block h-9 w-full overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.span
          key={verdict}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="absolute inset-0 whitespace-nowrap font-display text-2xl leading-9"
          style={{ color }}
        >
          {verdict}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
