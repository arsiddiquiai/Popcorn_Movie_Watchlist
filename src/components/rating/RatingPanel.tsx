import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import type { Rating } from '../../lib/database.types'
import { saveReasonTags, saveScore } from '../../lib/ratings'
import {
  interpolateScoreColor,
  isFavoriteScore,
  releaseEffectFor,
  rgbString,
  rgbaString,
  verdictFor,
} from '../../lib/ratingScale'
import { useTheme } from '../../theme/ThemeProvider'
import { PulseLine } from './PulseLine'
import { ReviewNote } from './ReviewNote'
import { useRatingColors } from './useRatingColors'
import { VerdictWord } from './VerdictWord'
import { WhyChips } from './WhyChips'

const DEFAULT_SCORE = 5

interface RatingPanelProps {
  tmdbId: number
  userId: string
  existingRating: Rating | null
  /** Reports the live value so the page's poster can react to it. */
  onScoreChange: (score: number) => void
  onRelease: (score: number) => void
}

export function RatingPanel({ tmdbId, userId, existingRating, onScoreChange, onRelease }: RatingPanelProps) {
  const { reducedMotion } = useTheme()
  const { cold, neutral, warm } = useRatingColors()

  const [score, setScore] = useState(existingRating?.score ?? DEFAULT_SCORE)
  const [rating, setRating] = useState<Rating | null>(existingRating)
  const [tags, setTags] = useState<string[]>(existingRating?.reason_tags ?? [])
  const [interacting, setInteracting] = useState(false)
  const [focused, setFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // A rating that was already saved before this page loaded should appear
  // settled — only a panel that has just appeared (i.e. the movie was only
  // now marked watched) animates in.
  const [playEntrance] = useState(() => existingRating === null && !reducedMotion)
  const panelControls = useAnimationControls()
  const scoreRef = useRef(score)
  scoreRef.current = score

  useEffect(() => {
    if (!playEntrance) return
    void panelControls.start({ opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } })
    // Mount-only: the entrance must not replay when the score changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const color = interpolateScoreColor(score, cold, neutral, warm)
  const colorCss = rgbString(color)
  const fillPercent = ((score - 1) / 9) * 100

  const commit = useCallback(async () => {
    const finalScore = scoreRef.current
    onRelease(finalScore)

    if (!reducedMotion && releaseEffectFor(finalScore) === 'shake') {
      // Pair the poster's shake with a brief dip in the panel's brightness.
      void panelControls.start({
        filter: ['brightness(1)', 'brightness(0.55)', 'brightness(1)'],
        transition: { duration: 0.6, times: [0, 0.35, 1], ease: 'easeOut' },
      })
    }

    setSaving(true)
    setSaveError(false)
    try {
      const saved = await saveScore(userId, tmdbId, finalScore)
      setRating(saved)
      setTags(saved.reason_tags ?? [])
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }, [onRelease, panelControls, reducedMotion, tmdbId, userId])

  // Release is tracked on the window rather than the input: dragging a
  // range thumb frequently ends with the pointer outside the element.
  useEffect(() => {
    if (!interacting) return
    const handleUp = () => {
      setInteracting(false)
      void commit()
    }
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [interacting, commit])

  function handleChange(next: number) {
    setScore(next)
    onScoreChange(next)
  }

  async function toggleTag(tag: string) {
    if (!rating) return
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
    setTags(next)
    try {
      await saveReasonTags(rating.id, next)
    } catch {
      setTags(tags) // revert on failure
    }
  }

  return (
    <motion.div
      animate={panelControls}
      initial={playEntrance ? { opacity: 0, y: 12 } : false}
      /* select-none: dragging the thumb otherwise highlights the verdict
         word and score text as though selecting them. */
      className="relative isolate flex select-none flex-col gap-4 overflow-hidden rounded-2xl border border-muted/20 bg-surface p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-[var(--transition-base)]"
        style={{ background: `radial-gradient(130% 120% at 50% 0%, ${rgbaString(color, 0.28)}, transparent 68%)` }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <VerdictWord verdict={verdictFor(score)} color={colorCss} reducedMotion={reducedMotion} />
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-display text-xl" style={{ color: colorCss }}>
          {isFavoriteScore(score) && (
            <span aria-label="Favorite" title="Favorite (9+)" className="text-base leading-none">
              ★
            </span>
          )}
          {score}
          <span className="text-muted">/10</span>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={score}
          aria-label="Your rating out of 10"
          aria-valuetext={`${score} out of 10 — ${verdictFor(score)}`}
          onChange={(event) => handleChange(Number(event.target.value))}
          onPointerDown={() => setInteracting(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Keyboard adjustments never produce a pointerup, so commit on
          // key release instead.
          onKeyUp={(event) => {
            if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') void commit()
          }}
          className="rating-slider"
          style={
            {
              '--rating-color': colorCss,
              '--rating-color-soft': rgbaString(color, 0.35),
              '--rating-track': `linear-gradient(to right, ${colorCss} 0%, ${colorCss} ${fillPercent}%, ${rgbaString(neutral, 0.25)} ${fillPercent}%, ${rgbaString(neutral, 0.25)} 100%)`,
            } as React.CSSProperties
          }
        />
        <PulseLine
          score={score}
          active={interacting || focused}
          color={colorCss}
          reducedMotion={reducedMotion}
        />
      </div>

      {saveError && (
        <p className="font-ui text-xs text-accent-cold">Couldn't save your rating. Move the slider to try again.</p>
      )}

      {rating && !saveError && (
        <>
          <WhyChips selected={tags} onToggle={(tag) => void toggleTag(tag)} disabled={saving} />
          <ReviewNote ratingId={rating.id} initialText={rating.review_text} />
        </>
      )}
    </motion.div>
  )
}
