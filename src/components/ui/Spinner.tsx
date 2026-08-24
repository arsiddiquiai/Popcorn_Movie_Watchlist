/** The one spinner used app-wide for page/section-level loading — first introduced on AuthLoadingScreen. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  // border-muted/25 is the spinner's *track* — a graphic element, not a
  // container edge — so it deliberately sits outside the border-border
  // convention used everywhere else. It has to stay visible against --surface
  // rather than blending into it the way a real border should.
  return (
    <div
      className="h-8 w-8 animate-spin rounded-full border-2 border-muted/25 border-t-accent-warm"
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
