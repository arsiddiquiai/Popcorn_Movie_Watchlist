import type { PickCompany, PickInput } from '../../lib/pickClient'
import { EnergySelector } from './EnergySelector'

const MINUTE_PRESETS = [30, 60, 90, 120, 150] as const

const COMPANY_OPTIONS: { value: PickCompany; label: string }[] = [
  { value: 'alone', label: 'Alone' },
  { value: 'partner', label: 'Partner' },
  { value: 'friends', label: 'Friends' },
  { value: 'family', label: 'Family' },
]

interface MoodFormProps {
  value: PickInput
  onChange: (next: PickInput) => void
  onSubmit: () => void
  disabled?: boolean
}

export function MoodForm({ value, onChange, onSubmit, disabled }: MoodFormProps) {
  const canSubmit = value.mood_text.trim().length > 0 && !disabled

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit()
      }}
      className="flex w-full max-w-xl flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <label htmlFor="mood" className="font-display text-2xl leading-tight text-text sm:text-3xl">
          How are you feeling tonight?
        </label>
        <textarea
          id="mood"
          value={value.mood_text}
          onChange={(event) => onChange({ ...value, mood_text: event.target.value })}
          // Enter submits; Shift+Enter still adds a newline. The field is a
          // textarea rather than an input so a longer, rambling mood has
          // room to breathe — that free text is the most useful signal the
          // recommender gets.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (canSubmit) onSubmit()
            }
          }}
          rows={3}
          maxLength={500}
          placeholder="Wrung out from work, want something that doesn't ask much of me…"
          className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 font-ui text-base leading-relaxed text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-warm"
        />
      </div>

      <EnergySelector value={value.energy_level} onChange={(energy_level) => onChange({ ...value, energy_level })} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-display text-xs font-semibold tracking-[0.14em] text-muted uppercase">Time you've got</legend>
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

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-display text-xs font-semibold tracking-[0.14em] text-muted uppercase">Watching with</legend>
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

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-hero rounded-xl px-6 py-4 font-display text-lg disabled:opacity-40"
      >
        Pick For Me
      </button>
    </form>
  )
}
