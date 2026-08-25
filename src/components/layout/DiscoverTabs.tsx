import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/search', label: 'Search' },
  { to: '/bridge', label: 'Bridge' },
]

/**
 * Cinema Bridge is a discovery MODE, not its own destination (DESIGN.md
 * §4) — this segmented control is how it's reached now, shared between
 * Search's and Cinema Bridge's own page headers, instead of a separate nav
 * entry. Routes don't change (/search and /bridge both still exist,
 * unmodified); this only changes how you get from one to the other.
 */
export function DiscoverTabs() {
  return (
    <div className="inline-flex rounded-lg border border-border p-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            `rounded-md px-4 py-1.5 font-ui text-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
              isActive ? 'bg-surface font-semibold text-text shadow-sm' : 'text-muted hover:text-text'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}
