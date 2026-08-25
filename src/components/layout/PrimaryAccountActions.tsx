import { NavLink } from 'react-router-dom'

const ACTIONS = [
  { to: '/settings', label: 'Settings' },
  { to: '/feedback', label: 'Feedback' },
]

/**
 * The two most-used secondary destinations, surfaced immediately at the
 * top of the You tab (DESIGN.md live-review fix, §7 restructure) instead
 * of parked behind Taste DNA's charts and a "coming soon" teaser. Desktop
 * already has both in Nav.tsx's sidebar, so this renders lg:hidden.
 */
export function PrimaryAccountActions() {
  return (
    <nav aria-label="Account" className="grid grid-cols-2 gap-3 lg:hidden">
      {ACTIONS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className="rounded-xl border border-border bg-surface px-4 py-3 text-center font-ui text-sm font-semibold text-text transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40"
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
