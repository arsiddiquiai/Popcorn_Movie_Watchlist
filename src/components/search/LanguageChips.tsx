// Fixed display order — not alphabetical, not popularity-sorted. Matches
// the ranked TMDB research (avg_popularity, region=IN) with Bollywood and
// Hollywood pinned first regardless of rank, since they're the two
// "default catalogue" filters rather than regional-discovery alternatives.
export const LANGUAGES = [
  { code: 'all', label: 'All' },
  { code: 'hi', label: 'Bollywood' },
  { code: 'en', label: 'Hollywood' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'kn', label: 'Kannada' },
  { code: 'bn', label: 'Bengali' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ko', label: 'Korean' },
  { code: 'ja', label: 'Japanese' },
] as const

interface LanguageChipsProps {
  value: string
  onChange: (code: string) => void
}

export function LanguageChips({ value, onChange }: LanguageChipsProps) {
  return (
    // Single horizontally scrolling row rather than wrapping (live-review
    // redesign) — 12 chips wrapped to 3-4 lines was real vertical tax on
    // mobile above the results.
    <div className="flex gap-2 overflow-x-auto pb-1">
      {LANGUAGES.map((lang) => {
        const active = value === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(lang.code)}
            className={`shrink-0 rounded-full border px-3 py-1.5 font-ui text-xs transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
              active
                ? 'border-accent-warm bg-accent-warm/15 font-semibold text-accent-warm'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
