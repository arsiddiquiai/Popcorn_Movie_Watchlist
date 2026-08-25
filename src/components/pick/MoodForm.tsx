import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PickCompany, PickInput } from '../../lib/pickClient'
import { EnergySelector } from './EnergySelector'

const MINUTE_PRESETS = [30, 60, 90, 120, 150] as const

const COMPANY_OPTIONS: { value: PickCompany; label: string }[] = [
  { value: 'alone', label: 'Alone' },
  { value: 'partner', label: 'Partner' },
  { value: 'friends', label: 'Friends' },
  { value: 'family', label: 'Family' },
]

const STEP_COUNT = 4

interface MoodFormProps {
  value: PickInput
  onChange: (next: PickInput) => void
  onSubmit: () => void
  disabled?: boolean
  reducedMotion: boolean
}

const stepVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

/** Shared row of Back/Next (or Back/Submit on the last step) — one
 *  implementation instead of one per step. */
function StepNav({
  onBack,
  showBack,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  primaryType = 'button',
}: {
  onBack: () => void
  showBack: boolean
  primaryLabel: string
  primaryDisabled: boolean
  onPrimary?: () => void
  primaryType?: 'button' | 'submit'
}) {
  return (
    <div className="flex items-center gap-3">
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border px-5 py-4 font-ui text-sm text-muted transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-text"
        >
          Back
        </button>
      )}
      <button
        type={primaryType}
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="btn-hero flex-1 rounded-xl px-6 py-4 font-display text-lg disabled:opacity-40"
      >
        {primaryLabel}
      </button>
    </div>
  )
}

/**
 * One question at a time (live-review redesign) rather than one long form —
 * mood, then energy, then time, then company, each its own screen-width
 * step with a progress row above it. Enter still submits from the mood
 * textarea, but now advances to the next step rather than the whole form.
 */
export function MoodForm({ value, onChange, onSubmit, disabled, reducedMotion }: MoodFormProps) {
  const [step, setStep] = useState(0)
  const canSubmit = value.mood_text.trim().length > 0 && !disabled
  const canAdvanceFromMood = value.mood_text.trim().length > 0

  function next() {
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1))
  }
  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit()
      }}
      className="flex w-full max-w-xl flex-col gap-8"
    >
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: STEP_COUNT }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-[var(--transition-base)] ease-[var(--ease-standard)] ${
              index <= step ? 'bg-accent-warm' : 'bg-border'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 0 && (
          <motion.div
            key="mood"
            initial={reducedMotion ? false : stepVariants.enter}
            animate={stepVariants.center}
            exit={reducedMotion ? undefined : stepVariants.exit}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col gap-3">
              <label htmlFor="mood" className="font-display text-2xl leading-tight text-text sm:text-3xl">
                How are you feeling tonight?
              </label>
              <textarea
                id="mood"
                autoFocus
                value={value.mood_text}
                onChange={(event) => onChange({ ...value, mood_text: event.target.value })}
                // Enter advances to the next step (not a submit — this is
                // step 1 of 4); Shift+Enter still adds a newline.
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (canAdvanceFromMood) next()
                  }
                }}
                rows={3}
                maxLength={500}
                placeholder="Wrung out from work, want something that doesn't ask much of me…"
                className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 font-ui text-base leading-relaxed text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-warm"
              />
            </div>
            <StepNav onBack={back} showBack={false} primaryLabel="Next" primaryDisabled={!canAdvanceFromMood} onPrimary={next} />
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="energy"
            initial={reducedMotion ? false : stepVariants.enter}
            animate={stepVariants.center}
            exit={reducedMotion ? undefined : stepVariants.exit}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <p className="font-display text-2xl leading-tight text-text sm:text-3xl">What's your energy like?</p>
            <EnergySelector value={value.energy_level} onChange={(energy_level) => onChange({ ...value, energy_level })} />
            <StepNav onBack={back} showBack primaryLabel="Next" primaryDisabled={false} onPrimary={next} />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="time"
            initial={reducedMotion ? false : stepVariants.enter}
            animate={stepVariants.center}
            exit={reducedMotion ? undefined : stepVariants.exit}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <fieldset className="flex flex-col gap-3">
              <legend className="font-display text-2xl leading-tight text-text sm:text-3xl">How much time have you got?</legend>
              <div className="flex flex-wrap gap-2">
                {MINUTE_PRESETS.map((minutes) => {
                  const active = value.minutes_available === minutes
                  const label = minutes === 150 ? '150+' : `${minutes}`
                  return (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ ...value, minutes_available: minutes })}
                      className={`rounded-full border px-4 py-2 font-ui text-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
                        active
                          ? 'border-accent-warm bg-accent-warm/15 font-semibold text-accent-warm'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      {label} min
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <StepNav onBack={back} showBack primaryLabel="Next" primaryDisabled={false} onPrimary={next} />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="company"
            initial={reducedMotion ? false : stepVariants.enter}
            animate={stepVariants.center}
            exit={reducedMotion ? undefined : stepVariants.exit}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <fieldset className="flex flex-col gap-3">
              <legend className="font-display text-2xl leading-tight text-text sm:text-3xl">Watching with anyone?</legend>
              <div className="flex flex-wrap gap-2">
                {COMPANY_OPTIONS.map((option) => {
                  const active = value.company === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ ...value, company: option.value })}
                      className={`rounded-full border px-4 py-2 font-ui text-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
                        active
                          ? 'border-accent-warm bg-accent-warm/15 font-semibold text-accent-warm'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <StepNav onBack={back} showBack primaryLabel="Pick For Me" primaryDisabled={!canSubmit} primaryType="submit" />
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}
