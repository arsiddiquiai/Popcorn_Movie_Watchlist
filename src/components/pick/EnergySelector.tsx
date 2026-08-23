import { ENERGY_LABELS, ENERGY_MAX, ENERGY_MIN } from '../../lib/energyScale'

/**
 * Five tappable stepped bars, deliberately NOT the rating slider's visual
 * treatment: no continuous track, no thumb, no verdict word, no pulse line.
 * A rating is a judgement of a film you've seen; energy is a statement about
 * yourself right now, so it reads as discrete blocks you step onto rather
 * than a value you slide to.
 *
 * Implemented as a radiogroup so arrow keys move between levels natively.
 */
interface EnergySelectorProps {
  value: number
  onChange: (value: number) => void
}

const LEVELS = Array.from({ length: ENERGY_MAX - ENERGY_MIN + 1 }, (_, i) => ENERGY_MIN + i)

export function EnergySelector({ value, onChange }: EnergySelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-ui text-sm font-semibold text-text">Energy</span>
        <span className="font-ui text-xs text-muted">{ENERGY_LABELS[value]}</span>
      </div>

      <div
        role="radiogroup"
        aria-label="Energy level"
        className="flex items-end gap-2"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            onChange(Math.min(ENERGY_MAX, value + 1))
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            onChange(Math.max(ENERGY_MIN, value - 1))
          }
        }}
      >
        {LEVELS.map((level) => {
          const active = level <= value
          const isCurrent = level === value
          // Bars rise left to right, so the control reads as a level being
          // stepped up rather than a position on a scale.
          const heightClass = ['h-8', 'h-11', 'h-14', 'h-17', 'h-20'][level - 1]

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              aria-label={`${level} — ${ENERGY_LABELS[level]}`}
              tabIndex={isCurrent ? 0 : -1}
              onClick={() => onChange(level)}
              className={`${heightClass} flex-1 rounded-lg border transition-[background-color,border-color,transform] duration-[var(--transition-base)] ${
                active
                  ? 'border-accent-warm bg-accent-warm/80'
                  : 'border-muted/25 bg-muted/10 hover:border-muted/40'
              } ${isCurrent ? 'scale-y-105' : ''}`}
            />
          )
        })}
      </div>
    </div>
  )
}
