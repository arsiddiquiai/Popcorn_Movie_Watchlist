const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY

if (!TMDB_API_KEY) {
  throw new Error(
    'Missing TMDB environment variable. Set VITE_TMDB_API_KEY in .env (copy .env.example to get started), then restart the dev server.',
  )
}

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

export type TmdbErrorKind = 'network' | 'rate_limit' | 'api'

export class TmdbError extends Error {
  kind: TmdbErrorKind

  constructor(message: string, kind: TmdbErrorKind) {
    super(message)
    this.name = 'TmdbError'
    this.kind = kind
  }
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  let response: Response
  try {
    response = await fetch(url.toString(), { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new TmdbError('Could not reach TMDB. Check your connection and try again.', 'network')
  }

  if (response.status === 429) {
    throw new TmdbError('TMDB rate limit reached. Try again in a moment.', 'rate_limit')
  }
  if (!response.ok) {
    throw new TmdbError(`TMDB request failed (${response.status}).`, 'api')
  }

  return (await response.json()) as T
}

/** Absolute image URL for a TMDB poster/backdrop path, or null if there is none. */
export function tmdbImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'): string | null {
  if (!path) return null
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`
}

export interface TmdbSearchMovie {
  id: number
  title: string
  poster_path: string | null
  release_date: string
  vote_average: number
  original_language: string
}

interface TmdbSearchResponse {
  page: number
  results: TmdbSearchMovie[]
  total_results: number
  total_pages: number
}

export async function searchMovies(query: string, signal?: AbortSignal): Promise<TmdbSearchMovie[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const data = await tmdbFetch<TmdbSearchResponse>('/search/movie', { query: trimmed, include_adult: 'false' }, signal)
  return data.results
}

export interface TmdbVideo {
  key: string
  site: string
  type: string
  official?: boolean
}

export interface TmdbCastMember {
  id: number
  name: string
  character: string
  order: number
  profile_path: string | null
}

export interface TmdbCrewMember {
  id: number
  name: string
  job: string
  department: string
}

export interface TmdbMovieDetails {
  id: number
  title: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  runtime: number | null
  genres: { id: number; name: string }[]
  overview: string
  vote_average: number
  original_language: string
  videos?: { results: TmdbVideo[] }
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] }
}

export async function getMovieDetails(tmdbId: number, signal?: AbortSignal): Promise<TmdbMovieDetails> {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, { append_to_response: 'videos,credits' }, signal)
}

/** Picks the best YouTube trailer key out of a details response's videos, if any. */
export function pickTrailerKey(videos: TmdbMovieDetails['videos']): string | null {
  const trailers = videos?.results.filter((v) => v.site === 'YouTube' && v.type === 'Trailer') ?? []
  const official = trailers.find((v) => v.official)
  return (official ?? trailers[0])?.key ?? null
}
