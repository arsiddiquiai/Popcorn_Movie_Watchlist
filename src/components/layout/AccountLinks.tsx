import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'

// Order fixed by CLAUDE.md's screens table: Coming Soon, Settings, Feedback
// (Taste DNA itself is excluded — this list renders AT the bottom of that
// page, not a link back to it), plus Privacy/Terms per DESIGN.md §4.
const LINKS = [
  { to: '/coming-soon', label: 'Coming Soon' },
  { to: '/settings', label: 'Settings' },
  { to: '/feedback', label: 'Feedback' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

/**
 * The secondary-links list DESIGN.md §4 moves to the bottom of the "You"
 * tab (Taste DNA) — Coming Soon/Settings/Feedback/Privacy/Terms plus
 * account/log-out, all previously reachable only through the now-deleted
 * hamburger drawer. Desktop still has these in Nav.tsx's sidebar, so every
 * call site renders this `lg:hidden`.
 */
export function AccountLinks() {
  const { user, signOut } = useAuth()

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6 lg:hidden">
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
        {LINKS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className={({ isActive }) =>
                `block px-4 py-3 font-ui text-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
                  isActive ? 'bg-surface font-semibold text-text' : 'text-muted hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {user && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="min-w-0 truncate font-ui text-xs text-muted" title={user.email ?? undefined}>
            {user.email}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="shrink-0 rounded-lg px-2 py-1 font-ui text-xs text-muted transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-text"
          >
            Log out
          </button>
        </div>
      )}
    </section>
  )
}
