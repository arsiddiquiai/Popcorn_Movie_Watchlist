import { NavLink, useLocation } from 'react-router-dom'
import { Logo } from './Logo'

type Accent = 'accent-cold' | 'accent-warm'

interface NavGroup {
  label: string
  accent: Accent
  items: { to: string; label: string }[]
}

const groups: NavGroup[] = [
  {
    label: 'Discover',
    accent: 'accent-cold',
    items: [
      { to: '/search', label: 'Search' },
      { to: '/bridge', label: 'Cinema Bridge' },
    ],
  },
  {
    label: 'Decide',
    accent: 'accent-warm',
    items: [
      { to: '/', label: 'My Watchlist' },
      { to: '/pick', label: 'Pick For Me' },
    ],
  },
]

const moreLinks = [
  { to: '/taste', label: 'Taste DNA' },
  { to: '/settings', label: 'Settings' },
]

// Written as literal, full class strings (not built via template-string
// concatenation) so Tailwind's static scan can find and generate them.
const accentStyles: Record<Accent, { bar: string; panelActive: string; panelInactive: string; label: string }> = {
  'accent-cold': {
    bar: 'bg-accent-cold',
    panelActive: 'border-accent-cold bg-accent-cold/10',
    panelInactive: 'border-muted/15 bg-transparent',
    label: 'text-accent-cold',
  },
  'accent-warm': {
    bar: 'bg-accent-warm',
    panelActive: 'border-accent-warm bg-accent-warm/10',
    panelInactive: 'border-muted/15 bg-transparent',
    label: 'text-accent-warm',
  },
}

function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))
}

export function Nav() {
  const { pathname } = useLocation()
  const activeGroup = groups.find((group) => isGroupActive(group, pathname))

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col gap-6 border-r border-muted/15 bg-surface px-5 py-6">
      <div
        className={`h-1 w-10 rounded-full transition-colors duration-[var(--transition-base)] ${
          activeGroup ? accentStyles[activeGroup.accent].bar : 'bg-muted/30'
        }`}
        aria-hidden="true"
      />

      <Logo />

      <div className="flex flex-1 flex-col gap-5">
        {groups.map((group) => {
          const active = isGroupActive(group, pathname)
          const styles = accentStyles[group.accent]

          return (
            <section
              key={group.label}
              aria-label={group.label}
              className={`rounded-xl border px-3 py-3 transition-colors duration-[var(--transition-base)] ${
                active ? styles.panelActive : styles.panelInactive
              }`}
            >
              <h2 className={`mb-2 font-display text-xs uppercase tracking-wider ${active ? styles.label : 'text-muted'}`}>
                {group.label}
              </h2>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `block rounded-lg px-2.5 py-2 font-ui text-sm transition-colors duration-[var(--transition-fast)] ${
                          isActive ? 'bg-bg font-semibold text-text' : 'text-muted hover:text-text'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <ul className="flex flex-col gap-1 border-t border-muted/15 pt-4">
        {moreLinks.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-2.5 py-2 font-ui text-sm transition-colors duration-[var(--transition-fast)] ${
                  isActive ? 'text-text font-semibold' : 'text-muted hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
