// Same curated set and order as LanguageChips (minus "All", which has no
// meaning as a bridge target), so the two features read as one consistent
// vocabulary. Each label maps directly onto a key ai.ts's own
// TARGET_LANGUAGE_CODES table already understands server-side.
export const TARGETS = [
  'Bollywood',
  'Hollywood',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Punjabi',
  'Marathi',
  'Korean',
  'Japanese',
] as const

interface TargetChipsProps {
  value: string
  onChange: (target: string) => void
}

export function TargetChips({ value, onChange }: TargetChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TARGETS.map((target) => {
        const active = value === target
        return (
          <button
            key={target}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(target)}
            className={`rounded-full border px-3 py-1.5 font-ui text-xs transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
              active
                ? 'border-accent-warm bg-accent-warm/15 font-semibold text-accent-warm'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            {target}
          </button>
        )
      })}
    </div>
  )
}
