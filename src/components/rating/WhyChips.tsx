import { REASON_TAGS } from '../../lib/ratings'

interface WhyChipsProps {
  selected: string[]
  onToggle: (tag: string) => void
  disabled: boolean
}

export function WhyChips({ selected, onToggle, disabled }: WhyChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-ui text-xs text-muted">Why? (optional)</p>
      <div className="flex flex-wrap gap-2">
        {REASON_TAGS.map((tag) => {
          const isSelected = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onToggle(tag)}
              className={`rounded-full border px-3 py-1.5 font-ui text-xs transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] disabled:opacity-50 ${
                isSelected
                  ? 'border-accent-warm bg-accent-warm/15 font-semibold text-accent-warm'
                  : 'border-border text-muted hover:text-text'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
