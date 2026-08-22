import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getMovieGenres, type DiscoverSort, type TmdbGenre } from '../../lib/tmdbClient'
import { useTheme } from '../../theme/ThemeProvider'

export interface AdvancedFilters {
  genreIds: number[]
  yearFrom: number | null
  yearTo: number | null
  minRating: number | null
  sortBy: DiscoverSort
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  genreIds: [],
  yearFrom: null,
  yearTo: null,
  minRating: null,
  sortBy: 'popularity.desc',
}

export function hasActiveAdvancedFilters(filters: AdvancedFilters): boolean {
  return (
    filters.genreIds.length > 0 ||
    filters.yearFrom !== null ||
    filters.yearTo !== null ||
    filters.minRating !== null ||
    filters.sortBy !== 'popularity.desc'
  )
}

const SORT_OPTIONS: { value: DiscoverSort; label: string }[] = [
  { value: 'popularity.desc', label: 'Popularity' },
  { value: 'vote_average.desc', label: 'Rating' },
  { value: 'primary_release_date.desc', label: 'Release date' },
]

const inputClass =
  'w-24 rounded-lg border border-muted/25 bg-bg px-2.5 py-1.5 font-ui text-sm text-text outline-none focus:border-accent-cold disabled:opacity-50'

interface FilterBarProps {
  filters: AdvancedFilters
  onChange: (next: AdvancedFilters) => void
  /** True while a text search is active — genre/year/rating/sort don't apply to /search/movie. */
  disabled: boolean
}

export function FilterBar({ filters, onChange, disabled }: FilterBarProps) {
  const { reducedMotion } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [genres, setGenres] = useState<TmdbGenre[]>([])

  useEffect(() => {
    if (!expanded || genres.length > 0) return
    let cancelled = false
    getMovieGenres()
      .then((result) => {
        if (!cancelled) setGenres(result)
      })
      .catch(() => {
        /* genre chips just stay empty — not worth a dedicated error state here */
      })
    return () => {
      cancelled = true
    }
  }, [expanded, genres.length])

  function toggleGenre(id: number) {
    onChange({
      ...filters,
      genreIds: filters.genreIds.includes(id) ? filters.genreIds.filter((g) => g !== id) : [...filters.genreIds, id],
    })
  }

  const isActive = hasActiveAdvancedFilters(filters)

  const panel = (
    <div className="flex flex-col gap-4 border-t border-muted/15 pt-4">
      {disabled && (
        <p className="font-ui text-xs text-muted">Clear your search to use these filters — they don't apply to text search.</p>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-ui text-xs text-muted">Genre</p>
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => {
            const active = filters.genreIds.includes(genre.id)
            return (
              <button
                key={genre.id}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggleGenre(genre.id)}
                className={`rounded-full border px-3 py-1.5 font-ui text-xs transition-colors duration-[var(--transition-fast)] disabled:opacity-50 ${
                  active
                    ? 'border-accent-warm bg-accent-warm/15 font-semibold text-accent-warm'
                    : 'border-muted/25 text-muted hover:text-text'
                }`}
              >
                {genre.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-ui text-xs text-muted">Year from</span>
          <input
            type="number"
            inputMode="numeric"
            disabled={disabled}
            value={filters.yearFrom ?? ''}
            onChange={(e) => onChange({ ...filters, yearFrom: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-ui text-xs text-muted">Year to</span>
          <input
            type="number"
            inputMode="numeric"
            disabled={disabled}
            value={filters.yearTo ?? ''}
            onChange={(e) => onChange({ ...filters, yearTo: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-ui text-xs text-muted">Min rating</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={10}
            step={0.5}
            disabled={disabled}
            value={filters.minRating ?? ''}
            onChange={(e) => onChange({ ...filters, minRating: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          />
          {filters.sortBy === 'vote_average.desc' && (
            <span className="max-w-[10rem] font-ui text-[11px] leading-snug text-muted">
              Sorting by rating already shows the highest-rated first, so this rarely changes much here.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-ui text-xs text-muted">Sort by</span>
          <select
            disabled={disabled}
            value={filters.sortBy}
            onChange={(e) => onChange({ ...filters, sortBy: e.target.value as DiscoverSort })}
            className={`${inputClass} w-40`}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {isActive && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_ADVANCED_FILTERS)}
            className="mt-5 font-ui text-xs text-accent-cold underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`inline-flex w-fit items-center gap-1.5 rounded-lg border px-3 py-1.5 font-ui text-xs transition-colors duration-[var(--transition-fast)] ${
          isActive ? 'border-accent-warm text-accent-warm' : 'border-muted/25 text-muted hover:text-text'
        }`}
      >
        Filters{isActive ? ` · ${filters.genreIds.length + [filters.yearFrom, filters.yearTo, filters.minRating].filter((v) => v !== null).length + (filters.sortBy !== 'popularity.desc' ? 1 : 0)}` : ''}
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded &&
        (reducedMotion ? (
          panel
        ) : (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {panel}
          </motion.div>
        ))}
    </div>
  )
}
