import { Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useAuth } from './AuthProvider'

export function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoadingScreen />
  if (!user) return <Navigate to="/auth" replace />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
