export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted/30 border-t-accent-warm"
        role="status"
        aria-label="Loading"
      />
    </div>
  )
}
