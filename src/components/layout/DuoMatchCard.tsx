import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { createDuoSession, DuoMatchError } from '../../lib/duoMatch'

type State = 'idle' | 'starting' | 'error'

/**
 * Entry point for Duo Match — lives on the You tab, same placement as
 * ShareWatchlistCard. Creating a session and navigating to it is the whole
 * job here; DuoSession.tsx's own "waiting for your partner" state is
 * where the invite link actually gets shown/copied, so this card doesn't
 * duplicate that UI.
 */
export function DuoMatchCard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleStart() {
    if (!user || state === 'starting') return
    setState('starting')
    setMessage(null)
    try {
      const { sessionId } = await createDuoSession(user.id)
      navigate(`/duo/session/${sessionId}`)
    } catch (err) {
      setState('error')
      setMessage(err instanceof DuoMatchError ? err.message : "Couldn't start a Duo Match. Try again.")
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
      <div className="min-w-0">
        <p className="font-ui text-sm font-medium text-text">Duo Match</p>
        <p className="mt-0.5 font-ui text-xs text-muted">
          Swipe through the same list as someone else — a match is what you both like.
          {message && <span className="ml-1 text-accent-cold">{message}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={state === 'starting'}
        className="btn-hero shrink-0 rounded-full px-4 py-2 font-ui text-xs font-semibold disabled:opacity-60"
      >
        {state === 'starting' ? 'Starting…' : 'Start'}
      </button>
    </div>
  )
}
