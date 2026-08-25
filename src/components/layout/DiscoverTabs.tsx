import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/search', label: 'Search', subtitle: 'Search the catalogue.' },
  { to: '/bridge', label: 'Bridge', subtitle: "Find this film's equivalent elsewhere." },
]

/**
 * Cinema Bridge is a discovery MODE, not its own destination (DESIGN.md
 * §4) — this segmented control is how it's reached now, shared between
 * Search's and Cinema Bridge's own page headers, instead of a separate nav
 * entry. Routes don't change (/search and /bridge both still exist,
 * unmodified); this only changes how you get from one to the other.
 *
 * Live-review fix: the original version read as decoration (a plain
 * outline, same weight on both segments, no copy explaining what switching
 * does). The active segment now fills with --surface-2 against the
 * control's own --surface backdrop, and a one-line subtitle underneath
 * changes with the selected mode — carrying the context that used to live
 * as a static, redundant subtitle on each page's own header.
 */
export function DiscoverTabs() {
  const { pathname } = useLocation()
  const active = TABS.find((tab) => pathname.startsWith(tab.to)) ?? TABS[0]

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex w-fit gap-1 rounded-xl border border-border bg-surface p-1.5">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `rounded-lg px-5 py-2 font-ui text-sm font-semibold transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
                isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <p className="font-ui text-sm text-muted">{active.subtitle}</p>
    </div>
  )
}
