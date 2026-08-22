/** Best-effort ISO 3166-1 region from the browser locale (e.g. "en-IN" -> "IN"), falling back to "US". */
export function detectRegion(): string {
  const locale = navigator.language || 'en-US'
  const region = locale.split('-')[1]
  return region ? region.toUpperCase() : 'US'
}
