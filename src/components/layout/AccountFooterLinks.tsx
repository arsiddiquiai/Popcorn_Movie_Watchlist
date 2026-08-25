import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

/**
 * Privacy/Terms/Log out — a quiet footer group, visually de-emphasised
 * from PrimaryAccountActions (DESIGN.md live-review fix, §7 restructure).
 * Coming Soon and account identity used to live in this same bottom
 * cluster; both now have their own, more prominent spot higher up the
 * page, leaving this group for the legal/session housekeeping it actually
 * is. Desktop already has all of this in Nav.tsx's sidebar footer, so this
 * renders lg:hidden.
 */
export function AccountFooterLinks() {
  const { signOut } = useAuth()

  return (
    <div className="flex flex-col items-center gap-3 border-t border-border pt-6 font-ui text-xs text-muted-subtle lg:hidden">
      <div className="flex items-center gap-3">
        <NavLink to="/privacy" end className="transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-muted">
          Privacy
        </NavLink>
        <span aria-hidden="true">·</span>
        <NavLink to="/terms" end className="transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-muted">
          Terms
        </NavLink>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg px-2 py-1 transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-muted"
      >
        Log out
      </button>
    </div>
  )
}
