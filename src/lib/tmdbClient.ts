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
  status?: number

  constructor(message: string, kind: TmdbErrorKind, status?: number) {
    super(message)
    this.name = 'TmdbError'
    this.kind = kind
    this.status = status
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
    throw new TmdbError(`TMDB request failed (${response.status}).`, 'api', response.status)
  }

  return (await response.json()) as T
}

/** Absolute image URL for a TMDB poster/backdrop path, or null if there is none. */
export function tmdbImageUrl(
  path: string | null,
  size: 'w92' | 'w185' | 'w342' | 'w500' | 'w1280' | 'original' = 'w342',
): string | null {
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

export async function getTrendingMovies(signal?: AbortSignal): Promise<TmdbSearchMovie[]> {
  const data = await tmdbFetch<TmdbSearchResponse>('/trending/movie/week', {}, signal)
  return data.results
}

export async function getNowPlayingMovies(signal?: AbortSignal): Promise<TmdbSearchMovie[]> {
  const data = await tmdbFetch<TmdbSearchResponse>('/movie/now_playing', {}, signal)
  return data.results
}

export async function getPopularMoviesPage(page: number, signal?: AbortSignal): Promise<TmdbSearchMovie[]> {
  const data = await tmdbFetch<TmdbSearchResponse>('/movie/popular', { page: String(page) }, signal)
  return data.results
}

/**
 * One random movie from TMDB's popular list, for "Surprise Me" — exactly
 * one request: a random page number is picked first, then one random
 * result from that page. Pages 1-20 keep the pool to genuinely popular
 * titles rather than TMDB's long tail.
 */
export async function getRandomPopularMovie(signal?: AbortSignal): Promise<TmdbSearchMovie> {
  const page = Math.floor(Math.random() * 20) + 1
  const results = await getPopularMoviesPage(page, signal)
  if (!results.length) throw new TmdbError('No movies available right now.', 'api')
  return results[Math.floor(Math.random() * results.length)]
}

export interface TmdbGenre {
  id: number
  name: string
}

export async function getMovieGenres(signal?: AbortSignal): Promise<TmdbGenre[]> {
  const data = await tmdbFetch<{ genres: TmdbGenre[] }>('/genre/movie/list', {}, signal)
  return data.genres
}

export type DiscoverSort = 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc'

export interface DiscoverFilters {
  /** ISO 639-1 code, or 'all'/undefined for no language restriction. */
  language?: string
  genreIds?: number[]
  yearFrom?: number
  yearTo?: number
  minRating?: number
  sortBy?: DiscoverSort
}

/** True if any filter would actually narrow or reorder results beyond TMDB's own defaults. */
export function hasActiveDiscoverFilters(filters: DiscoverFilters): boolean {
  return Boolean(
    (filters.language && filters.language !== 'all') ||
      filters.genreIds?.length ||
      filters.yearFrom ||
      filters.yearTo ||
      filters.minRating ||
      (filters.sortBy && filters.sortBy !== 'popularity.desc'),
  )
}

export async function discoverMovies(filters: DiscoverFilters, signal?: AbortSignal): Promise<TmdbSearchMovie[]> {
  const params: Record<string, string> = {
    sort_by: filters.sortBy ?? 'popularity.desc',
    include_adult: 'false',
  }
  if (filters.language && filters.language !== 'all') params.with_original_language = filters.language
  if (filters.genreIds?.length) params.with_genres = filters.genreIds.join(',')
  if (filters.yearFrom) params['primary_release_date.gte'] = `${filters.yearFrom}-01-01`
  if (filters.yearTo) params['primary_release_date.lte'] = `${filters.yearTo}-12-31`
  if (filters.minRating) params['vote_average.gte'] = String(filters.minRating)

  // Without a vote-count floor, sorting by rating (or filtering by a
  // minimum one) surfaces obscure titles with a handful of 10/10 votes
  // ahead of widely-seen, well-reviewed films. 300 keeps the pool to
  // movies enough people have actually rated for the average to mean
  // anything. Applied whenever either control is in play, not just when
  // minRating is set — an unfiltered rating-sort has the exact same
  // problem.
  if (filters.minRating || filters.sortBy === 'vote_average.desc') {
    params['vote_count.gte'] = '300'
  }
  const data = await tmdbFetch<TmdbSearchResponse>('/discover/movie', params, signal)
  return data.results
}

export interface TmdbWatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface TmdbWatchProvidersRegion {
  link: string
  flatrate?: TmdbWatchProvider[]
  rent?: TmdbWatchProvider[]
  buy?: TmdbWatchProvider[]
}

export async function getWatchProviders(
  tmdbId: number,
  region: string,
  signal?: AbortSignal,
): Promise<TmdbWatchProvidersRegion | null> {
  const data = await tmdbFetch<{ results: Record<string, TmdbWatchProvidersRegion> }>(
    `/movie/${tmdbId}/watch/providers`,
    {},
    signal,
  )
  return data.results[region] ?? null
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
