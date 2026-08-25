import { useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { useTheme } from '../../theme/ThemeProvider'

export type AssistantMarkState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'popped'

interface AssistantMarkProps {
  state?: AssistantMarkState
  size?: number
}

// A 4-point sparkle: two mirrored petal-pairs meeting at pinched concave
// waists between the tips, rather than straight-line diamond points — the
// curve is what keeps it reading as a soft "spark" instead of a hazard
// symbol at 22px. Centered on a 24x24 viewBox, symmetric under 90° rotation.
const SPARK_PATH = 'M12 4C13 9 15 11 20 12C15 13 13 15 12 20C11 15 9 13 4 12C9 11 11 9 12 4Z'

/**
 * The AI Assistant's signature mark (DESIGN.md §7 — a spark/sparkle,
 * the concept chosen live over a glowing-orb and an abstract-waveform-knot
 * alternative for staying legible at the 22px tab-bar size, which is also
 * the same "AI" affordance convention as most other assistant products).
 * Filled in --hero rather than --accent-warm, deliberately distinct from
 * the warm/positive-rating colour so it reads as its own identity rather
 * than borrowing the rating slider's meaning.
 *
 * Five states per DESIGN.md §7. None of this existed before this pass —
 * built fresh, not preserved from anything:
 *   idle      — still
 *   listening — breathing scale 1.0<->1.06, 1.8s loop, soft --accent-cold ring
 *   thinking  — slow continuous rotation
 *   speaking  — rhythmic scale pulse (a plausible stand-in loop — there's
 *               no live audio-amplitude input anywhere in this app to
 *               drive it precisely, per DESIGN.md's own "otherwise a
 *               plausible loop" fallback)
 *   popped    — one-shot scale 1->1.3->1 with a --hero ring flash, for
 *               when an answer lands
 *
 * Currently only rendered idle (the TabBar's Assistant tab icon, via
 * icons.tsx's AssistantIcon). Wiring listening/thinking/speaking/popped
 * into Assistant.tsx's actual conversation state is separate follow-up
 * work — this component is ready for it, but that plumbing wasn't part of
 * this pass.
 */
export function AssistantMark({ state = 'idle', size = 22 }: AssistantMarkProps) {
  const { reducedMotion } = useTheme()
  const controls = useAnimationControls()

  useEffect(() => {
    if (reducedMotion) {
      void controls.set({ scale: 1, rotate: 0 })
      return
    }
    if (state === 'listening') {
      void controls.start({
        scale: [1, 1.06, 1],
        rotate: 0,
        transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
      })
    } else if (state === 'thinking') {
      void controls.start({ rotate: 360, scale: 1, transition: { duration: 2.4, repeat: Infinity, ease: 'linear' } })
    } else if (state === 'speaking') {
      void controls.start({
        scale: [1, 1.12, 0.96, 1.08, 1],
        rotate: 0,
        transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
      })
    } else if (state === 'popped') {
      void controls.start({ scale: [1, 1.3, 1], rotate: 0, transition: { duration: 0.5, ease: 'easeOut' } })
    } else {
      void controls.start({ scale: 1, rotate: 0, transition: { duration: 0.2 } })
    }
  }, [state, reducedMotion, controls])

  return (
    <motion.span
      animate={controls}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {state === 'listening' && !reducedMotion && (
        <span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{ inset: -4, boxShadow: '0 0 0 1.5px var(--accent-cold)' }}
        />
      )}
      {state === 'popped' && !reducedMotion && (
        <motion.span
          aria-hidden="true"
          className="absolute rounded-full"
          style={{ inset: -6, background: 'var(--hero)' }}
          initial={{ opacity: 0.55, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--hero)" aria-hidden="true">
        <path d={SPARK_PATH} />
      </svg>
    </motion.span>
  )
}
