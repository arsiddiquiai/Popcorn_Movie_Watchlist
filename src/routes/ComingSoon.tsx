import { Page, PageHeader } from '../components/layout/Page'

// CLAUDE.md's "Parked" list — a roadmap statement, not a promise with a
// date. No functionality behind any of these. AI Movie Assistant, public
// share links, PDF export, TV shows/web series/anime, and Duo Match are
// no longer here — all shipped; only genuinely unbuilt items stay listed.
const COMING_SOON = [
  { title: 'Social feed / following', description: 'See what friends are watching and rating.' },
]

export default function ComingSoon() {
  return (
    <Page>
      <PageHeader title="Coming Soon" subtitle="What's on the roadmap, not yet built." />

      <div className="flex flex-col gap-2">
        {COMING_SOON.map((item) => (
          <div
            key={item.title}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface/60 px-5 py-4"
          >
            <div>
              <p className="font-ui text-sm font-medium text-text">{item.title}</p>
              <p className="mt-1 font-ui text-xs leading-relaxed text-muted">{item.description}</p>
            </div>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-subtle">
              Planned
            </span>
          </div>
        ))}
      </div>
    </Page>
  )
}
