import { Navigate } from 'react-router-dom'
import Auth from '../routes/Auth'
import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useAuth } from './AuthProvider'

export function AuthGate() {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoadingScreen />
  if (user) return <Navigate to="/" replace />

  return <Auth />
}
