// CLAUDE.md's "Parked" list, verbatim — a roadmap statement, not a promise
// with a date. No functionality behind any of these.
const COMING_SOON = [
  { title: 'AI Movie Assistant', description: 'A conversational assistant for movie discovery.' },
  { title: 'TV shows, web series & anime', description: 'Extending Popcorn beyond movies.' },
  { title: 'Public share links', description: 'Read-only links to share your watchlist or ratings.' },
  { title: 'Social feed / following', description: 'See what friends are watching and rating.' },
  { title: 'Duo Match', description: 'Find something to watch together with a partner.' },
  { title: 'PDF export', description: 'Download your watchlist as a formatted document.' },
]

export default function ComingSoon() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="font-display text-3xl text-text">Coming Soon</h1>
        <p className="mt-2 font-ui text-sm text-muted">What's on the roadmap, not yet built.</p>
      </header>

      <div className="flex flex-col gap-2">
        {COMING_SOON.map((item) => (
          <div
            key={item.title}
            className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-surface/50 px-4 py-3"
          >
            <div>
              <p className="font-ui text-sm text-muted">{item.title}</p>
              <p className="font-ui text-xs text-muted-subtle">{item.description}</p>
            </div>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-subtle">
              Planned
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
