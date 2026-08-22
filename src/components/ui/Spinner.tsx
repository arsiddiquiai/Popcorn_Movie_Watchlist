/** The one spinner used app-wide for page/section-level loading — first introduced on AuthLoadingScreen. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="h-8 w-8 animate-spin rounded-full border-2 border-muted/30 border-t-accent-warm"
      role="status"
      aria-label={label}
    />
  )
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex justify-center py-20">
      <Spinner label={label} />
    </div>
  )
}
