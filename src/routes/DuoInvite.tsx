import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Logo } from '../components/layout/Logo'
import { Spinner } from '../components/ui/Spinner'
import { DuoMatchError, joinDuoSession, setPendingDuoJoinToken } from '../lib/duoMatch'

type Status = 'checking' | 'needs_auth' | 'joining' | 'error'

/**
 * The /duo/{token} invite landing page — deliberately outside
 * ProtectedLayout, same reasoning as /w/{token}: an anonymous visitor
 * needs to be able to land here at all before signing in. Unlike the
 * public share link, though, there is nothing to actually SHOW an
 * unauthenticated visitor (no anon grants exist on duo_sessions/
 * duo_votes at all — see the migration's own doc comment) — this page
 * either sends them to sign in/up first, or (once authenticated) joins
 * the session immediately and redirects straight to it.
 */
export default function DuoInvite() {
  const { token } = useParams<{ token: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !token) return

    if (!user) {
      setStatus('needs_auth')
      return
    }

    let cancelled = false
    setStatus('joining')
    joinDuoSession(token)
      .then((sessionId) => {
        if (!cancelled) navigate(`/duo/session/${sessionId}`, { replace: true })
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof DuoMatchError ? err.message : 'Could not join this Duo Match.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [loading, user, token, navigate])

  function handleSignIn() {
    if (token) setPendingDuoJoinToken(token)
    navigate('/auth')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-10 text-center text-text">
      <Logo />

      {(status === 'checking' || status === 'joining') && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Spinner label={status === 'joining' ? 'Joining…' : 'Loading'} />
        </div>
      )}

      {status === 'needs_auth' && (
        <div className="flex flex-col items-center gap-4">
          <p className="font-display text-2xl font-semibold text-text">You've been invited to a Duo Match</p>
          <p className="max-w-sm font-ui text-sm text-muted">
            Sign in or create an account to swipe through the same list and find something you'll both watch.
          </p>
          <button type="button" onClick={handleSignIn} className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold">
            Sign in to join
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4">
          <p className="font-display text-xl font-semibold text-text">Couldn't join this Duo Match</p>
          <p className="max-w-sm font-ui text-sm text-muted">{error}</p>
          <Link to="/" className="btn-hero rounded-full px-6 py-3 font-ui text-sm font-semibold">
            Go to Popcorn
          </Link>
        </div>
      )}
    </div>
  )
}
