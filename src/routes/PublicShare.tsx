import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Spinner } from '../components/ui/Spinner'
import { fetchSharedList, setPendingShareToken, type SharedList } from '../lib/shareLink'
import { tmdbImageUrl } from '../lib/tmdbClient'

type Status = 'loading' | 'ready' | 'not_found' | 'error'

/**
 * The public /w/{token} landing page — no login required, deliberately
 * outside AuthGate/ProtectedLayout (same reasoning as /reset-password and
 * /account-deleted: there's no session to guard, and for an anonymous
 * visitor there never was one). Shows only what api/share.ts's GET ever
 * returns: a display name (or "Someone" — never an email) and the
 * sharer's current want-list posters. Nothing else about the sharer's
 * account is fetchable from this route at all.
 */
export default function PublicShare() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [list, setList] = useState<SharedList | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('not_found')
      return
    }
    let cancelled = false
    setStatus('loading')

    fetchSharedList(token)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setStatus('not_found')
          return
        }
        setList(result)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  function handleSignUp() {
    if (token) setPendingShareToken(token)
    navigate('/auth')
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex items-center justify-center border-b border-border px-6 py-4">
        <Logo />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14">
        {status === 'loading' && (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner label="Loading list" />
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="font-ui text-sm text-accent-cold">Couldn't load this list. Try again in a moment.</p>
          </div>
        )}

        {status === 'not_found' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
            <p className="font-display text-2xl font-semibold text-text">This link isn't around any more.</p>
            <p className="max-w-sm font-ui text-sm text-muted">
              It may have expired, or the person who shared it removed their link.
            </p>
            <Link to="/" className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold">
              Go to Popcorn
            </Link>
          </div>
        )}

        {status === 'ready' && list && (
          <>
            <div className="flex flex-col gap-2 text-center">
              <p className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
                {list.displayName ?? 'Someone'}'s watchlist
              </p>
              <p className="font-ui text-sm text-muted">
                {list.movies.length} film{list.movies.length === 1 ? '' : 's'} waiting to be watched.
              </p>
            </div>

            {list.movies.length === 0 ? (
              <p className="py-10 text-center font-ui text-sm text-muted">Nothing on this list yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4">
                {list.movies.map((movie) => {
                  const posterUrl = tmdbImageUrl(movie.poster_path, 'w342')
                  return (
                    <div key={movie.tmdb_id} className="flex flex-col gap-1">
                      <div className="aspect-[2/3] overflow-hidden rounded-poster bg-surface">
                        {posterUrl ? (
                          <img src={posterUrl} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center px-2 text-center font-ui text-[11px] text-muted">
                            {movie.title}
                          </div>
                        )}
                      </div>
                      <p className="line-clamp-2 font-ui text-[12px] leading-[1.25] text-text">{movie.title}</p>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-accent-warm/30 bg-accent-warm/5 px-6 py-8 text-center">
              <p className="font-display text-xl font-semibold text-text">Want your own decided for you?</p>
              <p className="max-w-sm font-ui text-sm text-muted">
                Sign up and this whole list — everything above — gets added straight to your own watchlist.
              </p>
              <button type="button" onClick={handleSignUp} className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold">
                Sign up to save this list
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
