import { useEffect, useState } from 'react'
import { SectionHeading } from '../layout/Page'
import { detectRegion } from '../../lib/region'
import { getWatchProviders, tmdbImageUrl, type TmdbWatchProvider, type TmdbWatchProvidersRegion } from '../../lib/tmdbClient'

function ProviderRow({ label, items }: { label: string; items: TmdbWatchProvider[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] tracking-wide text-muted-subtle uppercase">{label}</p>
      {/* Horizontally scrollable rather than wrapping (live-review
          redesign) — same "row, not a wall" treatment as Cast and
          MovieRow's Trending/Now Playing. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((provider) => {
          const logoUrl = tmdbImageUrl(provider.logo_path, 'w92')
          return (
            <div
              key={provider.provider_id}
              title={provider.provider_name}
              className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border bg-surface transition-transform duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:-translate-y-0.5"
            >
              {logoUrl && <img src={logoUrl} alt={provider.provider_name} className="h-full w-full object-cover" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WatchProviders({ tmdbId }: { tmdbId: number }) {
  const [region, setRegion] = useState<TmdbWatchProvidersRegion | null | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    setRegion('loading')
    getWatchProviders(tmdbId, detectRegion())
      .then((result) => {
        if (!cancelled) setRegion(result)
      })
      .catch(() => {
        if (!cancelled) setRegion(null)
      })
    return () => {
      cancelled = true
    }
  }, [tmdbId])

  // A genuine "no data for this region" (or a failed request — treated the
  // same way deliberately, see the summary) hides the section entirely
  // rather than showing an empty box. While we don't know which of those
  // it'll be yet, a small skeleton avoids a blank flash right before it
  // either fills in or disappears.
  if (region === 'loading') {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-3 w-28 shimmer rounded-sm" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 w-11 shimmer rounded-md" />
          ))}
        </div>
      </div>
    )
  }
  if (region === null) return null

  const hasAny = Boolean(region.flatrate?.length || region.rent?.length || region.buy?.length)
  if (!hasAny) return null

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading>Where to Watch</SectionHeading>
      <div className="flex flex-col gap-5">
        {region.flatrate?.length ? <ProviderRow label="Stream" items={region.flatrate} /> : null}
        {region.rent?.length ? <ProviderRow label="Rent" items={region.rent} /> : null}
        {region.buy?.length ? <ProviderRow label="Buy" items={region.buy} /> : null}
      </div>
    </div>
  )
}
