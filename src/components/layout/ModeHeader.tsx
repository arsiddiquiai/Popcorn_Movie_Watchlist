import type { AppMode } from './Nav'
import { useDismissableIntro } from './useDismissableIntro'

// Literal, full class strings per mode (not built via concatenation) so
// Tailwind's static scan finds them.
const MODE_COPY: Record<
  Exclude<AppMode, null>,
  { label: string; intro: string; barClass: string; textClass: string; mainBgClass: string }
> = {
  discover: {
    label: 'Discover',
    intro: 'Find movies to add to your list.',
    barClass: 'border-accent-cold/20 bg-accent-cold/5',
    textClass: 'text-accent-cold',
    mainBgClass: 'bg-accent-cold/5',
  },
  decide: {
    label: 'Decide',
    intro: 'Let your list decide what’s next.',
    barClass: 'border-accent-warm/20 bg-accent-warm/5',
    textClass: 'text-accent-warm',
    mainBgClass: 'bg-accent-warm/5',
  },
}

export function mainBackgroundForMode(mode: AppMode): string {
  return mode ? MODE_COPY[mode].mainBgClass : ''
}

export function ModeHeader({ mode }: { mode: Exclude<AppMode, null> }) {
  const copy = MODE_COPY[mode]
  const [dismissed, dismiss] = useDismissableIntro(mode)

  return (
    <div className={`border-b px-6 py-2.5 ${copy.barClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`font-display text-xs uppercase tracking-widest ${copy.textClass}`}>{copy.label}</span>

        {!dismissed && (
          <div className="flex items-center gap-3">
            <span className="font-ui text-xs text-muted">{copy.intro}</span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className={`font-ui text-xs underline ${copy.textClass}`}
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
