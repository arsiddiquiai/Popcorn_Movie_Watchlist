import { useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { posterReaction, type ReleaseEffect } from '../../lib/ratingScale'

export interface PosterRelease {
  effect: ReleaseEffect
  /** Increments on every release so repeat ratings replay the animation. */
  token: number
}

interface ReactivePosterProps {
  posterUrl: string | null
  title: string
  /** null when this movie has no active rating slider. */
  score: number | null
  release: PosterRelease
  reducedMotion: boolean
}

export function ReactivePoster({ posterUrl, title, score, release, reducedMotion }: ReactivePosterProps) {
  const reaction = posterReaction(score)
  const posterControls = useAnimationControls()
  const glowControls = useAnimationControls()

  useEffect(() => {
    if (release.effect === null || reducedMotion) return

    if (release.effect === 'bloom') {
      // One deliberate swell-and-settle: the bloom expands past the poster
      // then eases back, with a single scale bounce underneath it. Slow and
      // large on purpose — CLAUDE.md's motion rules rule out anything fine
      // enough to be destroyed by screen-share compression.
      void posterControls.start({
        scale: [1, 1.06, 1],
        transition: { duration: 0.75, times: [0, 0.42, 1], ease: 'easeOut' },
      })
      void glowControls.start({
        scale: [1, 1.45, 1],
        transition: { duration: 0.85, times: [0, 0.42, 1], ease: 'easeOut' },
      })
      return
    }

    void posterControls.start({
      x: [0, -12, 11, -7, 4, 0],
      transition: { duration: 0.5, ease: 'easeOut' },
    })
  }, [release.token, release.effect, reducedMotion, posterControls, glowControls])

  return (
    <div className="relative w-40 shrink-0 md:w-56">
      <motion.div
        aria-hidden="true"
        animate={glowControls}
        style={{ background: 'var(--accent-warm)', opacity: reaction.glowOpacity * 0.55 }}
        className="pointer-events-none absolute -inset-3 rounded-[2rem] blur-2xl transition-opacity duration-[var(--transition-base)]"
      />

      {/* Release animations live on their own wrapper so they compose with
          the continuous reaction transform below instead of overwriting it. */}
      <motion.div animate={posterControls} className="relative">
        <div
          style={{
            filter: reaction.filter,
            transform: reaction.transform,
            boxShadow: reaction.boxShadow,
            transitionProperty: 'filter, transform, box-shadow',
            transitionDuration: 'var(--transition-base)',
            transitionTimingFunction: 'var(--ease-standard)',
          }}
        >
          <div className="aspect-[2/3] overflow-hidden rounded-lg bg-surface">
            {posterUrl ? (
              <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-3 text-center font-ui text-xs text-muted">
                {title}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
