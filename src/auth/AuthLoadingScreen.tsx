import { Spinner } from '../components/ui/Spinner'

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <Spinner />
    </div>
  )
}
