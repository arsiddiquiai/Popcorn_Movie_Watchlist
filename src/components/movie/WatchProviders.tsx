import { useEffect, useState } from 'react'
import { detectRegion } from '../../lib/region'
import { getWatchProviders, tmdbImageUrl, type TmdbWatchProvider, type TmdbWatchProvidersRegion } from '../../lib/tmdbClient'

function ProviderRow({ label, items }: { label: string; items: TmdbWatchProvider[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-ui text-xs text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((provider) => {
          const logoUrl = tmdbImageUrl(provider.logo_path, 'w92')
          return (
            <div
              key={provider.provider_id}
              title={provider.provider_name}
              className="h-10 w-10 overflow-hidden rounded-lg bg-surface"
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

  if (region === 'loading' || region === null) return null

  const hasAny = Boolean(region.flatrate?.length || region.rent?.length || region.buy?.length)
  if (!hasAny) return null

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-ui text-sm font-semibold text-text">Where to Watch</h2>
      <div className="flex flex-col gap-3">
        {region.flatrate?.length ? <ProviderRow label="Stream" items={region.flatrate} /> : null}
        {region.rent?.length ? <ProviderRow label="Rent" items={region.rent} /> : null}
        {region.buy?.length ? <ProviderRow label="Buy" items={region.buy} /> : null}
      </div>
    </div>
  )
}
