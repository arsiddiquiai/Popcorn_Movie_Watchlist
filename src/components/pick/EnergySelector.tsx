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
        <span className="font-display text-xs font-semibold tracking-[0.14em] text-muted uppercase">Energy</span>
        <span className="font-ui text-sm font-semibold text-accent-warm">{ENERGY_LABELS[value]}</span>
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
          const heightClass = ['h-9', 'h-12', 'h-15', 'h-18', 'h-21'][level - 1]

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              aria-label={`${level} — ${ENERGY_LABELS[level]}`}
              tabIndex={isCurrent ? 0 : -1}
              onClick={() => onChange(level)}
              // rounded-sm, not rounded-lg: the theme scale maps lg to 20px,
              // which on a 36px-tall bar renders as a pill while the 84px bar
              // reads as a rounded box — five bars, five apparent shapes. A
              // small fixed radius keeps the geometry consistent across the set.
              // origin-bottom so the current bar grows upward from its baseline
              // instead of expanding through the row's bottom edge.
              className={`${heightClass} flex-1 origin-bottom rounded-sm border transition-[background-color,border-color,transform] duration-[var(--transition-base)] ease-[var(--ease-standard)] ${
                active
                  ? 'border-accent-warm bg-accent-warm/85'
                  : 'border-border bg-surface-2 hover:border-muted/40'
              } ${isCurrent ? 'scale-y-[1.06]' : ''}`}
            />
          )
        })}
      </div>
    </div>
  )
}
