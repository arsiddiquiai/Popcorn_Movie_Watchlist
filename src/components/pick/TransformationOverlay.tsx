import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AssistantMark } from '../assistant/AssistantMark'
import { energyVisuals } from '../../lib/energyScale'
import { rgbaString } from '../../lib/ratingScale'
import { useRatingColors } from '../rating/useRatingColors'

/** After this long, the copy acknowledges the wait rather than sitting silent. */
const STILL_THINKING_AFTER_MS = 5000

interface TransformationOverlayProps {
  energy: number
  reducedMotion: boolean
}

/**
 * The "app is listening" moment between submitting a mood and seeing the
 * pick. Exactly ONE gesture: a single large colour wash that scales up and
 * breathes, tinted and paced by the energy level.
 *
 * Per CLAUDE.md's motion rules — this is demoed over Google Meet screen
 * share, where compression eats fine detail — there are no particles, no
 * grain, no confetti and no fast micro-animation. One big block of colour,
 * moving slowly.
 *
 * Reduced motion gets the same information with no animation at all: the
 * wash renders as a still tint and the spinner carries the "working" signal.
 */
export function TransformationOverlay({ energy, reducedMotion }: TransformationOverlayProps) {
  const { cold, neutral, warm } = useRatingColors()
  const visuals = energyVisuals(energy, cold, neutral, warm)
  const [stillThinking, setStillThinking] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setStillThinking(true), STILL_THINKING_AFTER_MS)
    return () => clearTimeout(handle)
  }, [])

  const wash = `radial-gradient(120% 100% at 50% 45%, ${rgbaString(visuals.tint, visuals.intensity)} 0%, ${rgbaString(
    visuals.tint,
    visuals.intensity * 0.45,
  )} 38%, transparent 72%)`

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-bg px-6"
      role="status"
      aria-live="polite"
    >
      {reducedMotion ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: wash }} />
      ) : (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: wash }}
          initial={{ opacity: 0, scale: 0.55, filter: 'brightness(0.6) saturate(0.6)' }}
          animate={{
            opacity: [0, 1, 0.82, 1],
            scale: [0.55, 1.1, 1.02, 1.12],
            filter: `brightness(${visuals.brightness}) saturate(${visuals.saturation})`,
          }}
          transition={{
            opacity: {
              duration: visuals.breathSeconds,
              times: [0, 0.35, 0.7, 1],
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
            },
            scale: {
              duration: visuals.breathSeconds,
              times: [0, 0.35, 0.7, 1],
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
            },
            filter: { duration: 1.2, ease: 'easeOut' },
          }}
        />
      )}

      <div className="relative flex flex-col items-center gap-6 text-center">
        {/* Reuses the Assistant's own "thinking" state (DESIGN.md §7)
            rather than a second loading treatment — same orbiting-dots
            animation, same meaning: the app is working on this. Already
            reduced-motion-safe on its own (AssistantMark reads
            useTheme().reducedMotion internally), so no separate
            Spinner fallback is needed here any more. */}
        <AssistantMark state="thinking" size={56} />
        <p className="max-w-lg font-display text-2xl leading-tight text-text sm:text-3xl">
          {stillThinking ? 'Still thinking…' : visuals.statusCopy}
        </p>
        {stillThinking && (
          <p className="font-ui text-sm text-muted">Weighing what actually fits, not just what's popular.</p>
        )}
      </div>
    </div>
  )
}
