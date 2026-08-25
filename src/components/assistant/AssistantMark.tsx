import { useEffect, useMemo } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { useTheme } from '../../theme/ThemeProvider'

export type AssistantMarkState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'popped'

interface AssistantMarkProps {
  state?: AssistantMarkState
  size?: number
  /** 0-1 live amplitude, when available, drives the speaking-state
   *  waveform directly. Nothing in this app currently supplies one — it's
   *  a text chat, no mic input or TTS output anywhere — so this is always
   *  undefined in practice and the waveform falls back to a plausible
   *  animated loop, per DESIGN.md §7's own fallback clause. The prop
   *  exists so a future voice feature can drive it without touching this
   *  component again. */
  audioLevel?: number
}

// A 4-point sparkle: two mirrored petal-pairs meeting at pinched concave
// waists between the tips, rather than straight-line diamond points — the
// curve is what keeps it reading as a soft "spark" instead of a hazard
// symbol at 22px. Centered on a 24x24 viewBox, symmetric under 90° rotation.
const SPARK_PATH = 'M12 4C13 9 15 11 20 12C15 13 13 15 12 20C11 15 9 13 4 12C9 11 11 9 12 4Z'

// Fixed pseudo-random amplitude pattern for the "plausible loop" fallback —
// not Math.random() (which would re-roll every render), a fixed sequence so
// the loop is stable and repeats cleanly.
const FALLBACK_BAR_PATTERN = [0.35, 0.85, 0.55, 1, 0.65]

/**
 * The AI Assistant's signature mark (DESIGN.md §7). A spark/sparkle,
 * chosen live over a glowing-orb and an abstract-waveform-knot concept for
 * staying legible at the 22px tab-bar size.
 *
 * Five states, exactly as specified:
 *   idle      — still, --muted
 *   listening — breathing scale 1.0<->1.06, 1.8s loop, --accent-cold ring
 *   thinking  — kernel rotates slowly, three dots orbit, --accent-warm
 *   speaking  — five-bar waveform in --accent-warm, amplitude from
 *               `audioLevel` where available, otherwise a plausible loop
 *   popped    — one-shot scale 1->1.3->1 with a --hero flash, fires when
 *               an answer lands
 *
 * Wired up for real: Assistant.tsx uses `thinking` while a reply is in
 * flight and `popped` when one lands, and Pick For Me's
 * TransformationOverlay reuses the same `thinking` state rather than
 * inventing a second loading treatment.
 */
export function AssistantMark({ state = 'idle', size = 22, audioLevel }: AssistantMarkProps) {
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
    } else if (state === 'popped') {
      void controls.start({ scale: [1, 1.3, 1], rotate: 0, transition: { duration: 0.5, ease: 'easeOut' } })
    } else {
      void controls.start({ scale: 1, rotate: 0, transition: { duration: 0.2 } })
    }
  }, [state, reducedMotion, controls])

  const fill = state === 'idle' || state === 'listening' ? 'var(--muted)' : state === 'popped' ? 'var(--hero)' : 'var(--accent-warm)'

  const dotAngles = useMemo(() => [0, 120, 240], [])
  const barHeights = useMemo(
    () => (typeof audioLevel === 'number' ? FALLBACK_BAR_PATTERN.map(() => audioLevel) : FALLBACK_BAR_PATTERN),
    [audioLevel],
  )

  if (state === 'speaking') {
    // The waveform replaces the spark entirely while speaking, rather than
    // sitting alongside it — DESIGN.md specifies it as the state's whole
    // visual, not a decoration on top of the kernel shape.
    const barWidth = Math.max(2, Math.round(size / 8))
    return (
      <span
        className="inline-flex shrink-0 items-end justify-center gap-[2px]"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {barHeights.map((amount, index) => (
          <motion.span
            key={index}
            className="rounded-full"
            style={{ width: barWidth, background: 'var(--accent-warm)' }}
            initial={{ height: size * 0.25 }}
            animate={
              reducedMotion || typeof audioLevel === 'number'
                ? { height: Math.max(size * 0.2, size * amount) }
                : { height: [size * 0.2, size * amount, size * 0.3, size * (amount * 0.8), size * 0.2] }
            }
            transition={
              reducedMotion || typeof audioLevel === 'number'
                ? { duration: 0.15 }
                : { duration: 0.9 + index * 0.07, repeat: Infinity, ease: 'easeInOut', delay: index * 0.05 }
            }
          />
        ))}
      </span>
    )
  }

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

      {state === 'thinking' && (
        <span aria-hidden="true" className="absolute inset-0">
          <motion.span
            className="absolute inset-0"
            animate={reducedMotion ? undefined : { rotate: 360 }}
            transition={reducedMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: 'linear' }}
          >
            {/* Positioned by direct trig rather than a compound CSS
                transform chain (rotate/translate/rotate tricks are easy to
                get subtly wrong) — each dot's centre sits at
                (50% + radius*cos, 50% + radius*sin), full stop. */}
            {dotAngles.map((angle) => {
              const dotSize = Math.max(2, size / 10)
              const radius = size * 0.62
              const rad = (angle * Math.PI) / 180
              const x = Math.cos(rad) * radius
              const y = Math.sin(rad) * radius
              return (
                <span
                  key={angle}
                  className="absolute rounded-full"
                  style={{
                    width: dotSize,
                    height: dotSize,
                    background: 'var(--accent-warm)',
                    top: `calc(50% + ${y}px - ${dotSize / 2}px)`,
                    left: `calc(50% + ${x}px - ${dotSize / 2}px)`,
                  }}
                />
              )
            })}
          </motion.span>
        </span>
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

      <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true">
        <path d={SPARK_PATH} />
      </svg>
    </motion.span>
  )
}
