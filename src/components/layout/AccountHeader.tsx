import { useAuth } from '../../auth/AuthProvider'

/**
 * Compact "who's logged in" strip — email + a plain initial avatar.
 * DESIGN.md live-review fix (§7 restructure): the You tab used to bury
 * account identity at the very bottom, after everything else. This is now
 * the first thing on the page. Desktop already shows the same information
 * in Nav.tsx's sidebar footer, so this renders lg:hidden.
 */
export function AccountHeader() {
  const { user } = useAuth()
  if (!user) return null

  const initial = (user.email ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-3 lg:hidden">
      <div
        aria-hidden="true"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-warm/15 font-display text-base font-semibold text-accent-warm"
      >
        {initial}
      </div>
      <p className="min-w-0 truncate font-ui text-sm font-medium text-text" title={user.email ?? undefined}>
        {user.email}
      </p>
    </div>
  )
}
