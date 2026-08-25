import { useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { posterLayoutId } from '../../lib/sharedElement'
import { posterReaction, type ReleaseEffect } from '../../lib/ratingScale'

export interface PosterRelease {
  effect: ReleaseEffect
  /** Increments on every release so repeat ratings replay the animation. */
  token: number
}

interface ReactivePosterProps {
  tmdbId: number
  posterUrl: string | null
  title: string
  /** null when this movie has no active rating slider. */
  score: number | null
  release: PosterRelease
  reducedMotion: boolean
}

/**
 * Movie Detail's full-bleed poster hero (DESIGN.md live-review redesign).
 * The poster carries the same layoutId as its WatchlistCard/SearchResultCard
 * counterpart, so Framer Motion's automatic shared-element transition picks
 * up wherever the user tapped in from — this is the only place that
 * transition's poster-side element lives; nothing here is duplicated
 * elsewhere.
 *
 * Score-reactive filter/transform/glow math is unchanged from the previous
 * small-card version of this component (still `posterReaction()` from
 * ratingScale.ts, still the same cold->warm interpolation) — only the
 * layout around it changed, from a floating ~224px-wide card to an
 * edge-to-edge hero with a bottom scrim for the title/metadata overlay.
 */
export function ReactivePoster({ tmdbId, posterUrl, title, score, release, reducedMotion }: ReactivePosterProps) {
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
        scale: [1, 1.03, 1],
        transition: { duration: 0.75, times: [0, 0.42, 1], ease: 'easeOut' },
      })
      void glowControls.start({
        opacity: [reaction.glowOpacity * 0.55, reaction.glowOpacity * 0.9, reaction.glowOpacity * 0.55],
        transition: { duration: 0.85, times: [0, 0.42, 1], ease: 'easeOut' },
      })
      return
    }

    void posterControls.start({
      x: [0, -10, 9, -6, 3, 0],
      transition: { duration: 0.5, ease: 'easeOut' },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release.token, release.effect, reducedMotion, posterControls, glowControls])

  return (
    <div className="relative aspect-[2/3] max-h-[70vh] w-full overflow-hidden bg-surface">
      <motion.div
        aria-hidden="true"
        animate={glowControls}
        style={{ background: 'var(--accent-warm)', opacity: reaction.glowOpacity * 0.55 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 blur-3xl transition-opacity duration-[var(--transition-base)] ease-[var(--ease-standard)]"
      />

      {/* Release animations live on their own wrapper so they compose with
          the continuous reaction transform below instead of overwriting it. */}
      <motion.div animate={posterControls} className="relative h-full w-full">
        <div
          className="h-full w-full"
          style={{
            filter: reaction.filter,
            transform: reaction.transform,
            transitionProperty: 'filter, transform',
            transitionDuration: 'var(--transition-base)',
            transitionTimingFunction: 'var(--ease-standard)',
          }}
        >
          {posterUrl ? (
            <motion.img
              layoutId={posterLayoutId(tmdbId)}
              src={posterUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center font-ui text-sm text-muted">
              {title}
            </div>
          )}
        </div>
      </motion.div>

      {/* Scrim the title/metadata overlay sits on, fading the hero into
          the page background rather than hard-cutting into it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
    </div>
  )
}
