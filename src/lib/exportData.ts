import { supabase } from './supabaseClient'

export interface ExportRow {
  title: string
  year: number | null
  status: string
  added_at: string
  watched_at: string | null
  score: number | null
  reason_tags: string[] | null
  review_text: string | null
}

/** Fetches the current user's own watchlist joined with ratings (left join
 *  — a "want" item has no rating row at all), newest-added first. Shared by
 *  every export format (CSV, PDF) so the underlying Supabase queries exist
 *  in exactly one place. Entirely client-side: this is the user's own data,
 *  already reachable through existing RLS-scoped queries, so no new
 *  backend endpoint is needed for any export format. */
export async function fetchExportRows(userId: string): Promise<ExportRow[]> {
  const [itemsResult, ratingsResult] = await Promise.all([
    supabase
      .from('watchlist_items')
      .select('tmdb_id, status, added_at, watched_at')
      .eq('user_id', userId)
      .order('added_at', { ascending: false }),
    supabase.from('ratings').select('tmdb_id, score, reason_tags, review_text').eq('user_id', userId),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (ratingsResult.error) throw ratingsResult.error

  const items = itemsResult.data
  const ratingByTmdbId = new Map(ratingsResult.data.map((r) => [r.tmdb_id, r]))

  const tmdbIds = items.map((item) => item.tmdb_id)
  let titleByTmdbId = new Map<number, { title: string; release_year: number | null }>()
  if (tmdbIds.length > 0) {
    const { data: movies, error: moviesError } = await supabase
      .from('movies_cache')
      .select('tmdb_id, title, release_year')
      .in('tmdb_id', tmdbIds)
    if (moviesError) throw moviesError
    titleByTmdbId = new Map(movies.map((m) => [m.tmdb_id, { title: m.title, release_year: m.release_year }]))
  }

  return items.map((item) => {
    const movie = titleByTmdbId.get(item.tmdb_id)
    const rating = ratingByTmdbId.get(item.tmdb_id)
    return {
      title: movie?.title ?? `tmdb:${item.tmdb_id}`,
      year: movie?.release_year ?? null,
      status: item.status,
      added_at: item.added_at,
      watched_at: item.watched_at,
      score: rating?.score ?? null,
      reason_tags: rating?.reason_tags ?? null,
      review_text: rating?.review_text ?? null,
    }
  })
}

const CSV_COLUMNS = [
  'title',
  'year',
  'status',
  'added_at',
  'watched_at',
  'score',
  'reason_tags',
  'review_text',
] as const

/** Wraps a field in quotes and escapes embedded quotes only when the field
 *  actually needs it — RFC 4180's minimal-quoting rule, so a plain title
 *  like "Oppenheimer" doesn't get wrapped for no reason. */
function csvField(value: string | number | null): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function rowsToCsv(rows: ExportRow[]): string {
  const lines = [
    CSV_COLUMNS.join(','),
    ...rows.map((row) =>
      [
        row.title,
        row.year ?? '',
        row.status,
        row.added_at,
        row.watched_at ?? '',
        row.score ?? '',
        row.reason_tags?.join('; ') ?? '',
        row.review_text ?? '',
      ]
        .map(csvField)
        .join(','),
    ),
  ]
  return lines.join('\r\n')
}

export async function exportWatchlistCsv(userId: string): Promise<string> {
  return rowsToCsv(await fetchExportRows(userId))
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Builds the CSV and triggers a browser download — no server round-trip
 *  beyond the Supabase reads already covered by fetchExportRows. */
export async function downloadWatchlistCsv(userId: string): Promise<void> {
  const csv = await exportWatchlistCsv(userId)
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `popcorn-watchlist-${new Date().toISOString().slice(0, 10)}.csv`,
  )
}

export { triggerDownload }
