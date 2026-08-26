import { useEffect } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { readAndClearJustJoinedDuoSession } from '../lib/duoMatch'
import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useAuth } from './AuthProvider'

export function ProtectedLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  // AuthProvider (outside the router in App.tsx) completes a pending Duo
  // Match join on sign-in but has no useNavigate() of its own to send the
  // guest to their new session — it stashes the result for whichever
  // protected route mounts next to pick up and redirect. Read-and-clear is
  // one-shot, so this only ever fires right after a Duo invite's sign-in/
  // signup step completes, never on an ordinary session restore.
  useEffect(() => {
    if (!user) return
    const sessionId = readAndClearJustJoinedDuoSession()
    if (sessionId) navigate(`/duo/session/${sessionId}`, { replace: true })
  }, [user, navigate])

  if (loading) return <AuthLoadingScreen />
  if (!user) return <Navigate to="/auth" replace />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
