/** e.g. 142 -> "2h 22m", 45 -> "45m", 120 -> "2h". Null/zero -> null. */
export function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
