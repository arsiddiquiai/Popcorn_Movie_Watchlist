export const LANGUAGES = [
  { code: 'all', label: 'All' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'ko', label: 'Korean' },
  { code: 'ja', label: 'Japanese' },
  { code: 'en', label: 'English' },
] as const

interface LanguageChipsProps {
  value: string
  onChange: (code: string) => void
}

export function LanguageChips({ value, onChange }: LanguageChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {LANGUAGES.map((lang) => {
        const active = value === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(lang.code)}
            className={`rounded-full border px-3 py-1.5 font-ui text-xs transition-colors duration-[var(--transition-fast)] ${
              active
                ? 'border-accent-warm bg-accent-warm/15 font-semibold text-accent-warm'
                : 'border-muted/25 text-muted hover:text-text'
            }`}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
