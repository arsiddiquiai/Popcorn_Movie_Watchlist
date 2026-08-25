import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Logo } from './Logo'

type Accent = 'accent-cold' | 'accent-warm'

interface NavGroup {
  label: string
  accent: Accent
  items: { to: string; label: string }[]
  /** Routes that belong to this territory for active-state purposes but
   *  aren't rendered as their own nav link. */
  territoryPaths?: string[]
}

export const groups: NavGroup[] = [
  {
    label: 'Discover',
    accent: 'accent-cold',
    items: [
      // Cinema Bridge is reached via the segmented tab inside Search now
      // (DESIGN.md §4) — it's a discovery mode, not its own destination,
      // so it no longer gets a separate nav entry. /bridge still exists as
      // a route (routes don't change) and still tints as Discover — see
      // territoryPaths below — it's just not listed here.
      { to: '/search', label: 'Search' },
      { to: '/assistant', label: 'Movie Assistant' },
    ],
    territoryPaths: ['/bridge'],
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

// Order is fixed by spec: Taste DNA, Coming Soon, Settings, Feedback.
const moreLinks = [
  { to: '/taste', label: 'Taste DNA' },
  { to: '/coming-soon', label: 'Coming Soon' },
  { to: '/settings', label: 'Settings' },
  { to: '/feedback', label: 'Feedback' },
]

// Written as literal, full class strings (not built via template-string
// concatenation) so Tailwind's static scan can find and generate them.
const accentStyles: Record<Accent, { bar: string; panelActive: string; panelInactive: string; label: string }> = {
  'accent-cold': {
    bar: 'bg-accent-cold',
    panelActive: 'border-accent-cold bg-accent-cold/10',
    panelInactive: 'border-border bg-transparent',
    label: 'text-accent-cold',
  },
  'accent-warm': {
    bar: 'bg-accent-warm',
    panelActive: 'border-accent-warm bg-accent-warm/10',
    panelInactive: 'border-border bg-transparent',
    label: 'text-accent-warm',
  },
}

function isGroupActive(group: NavGroup, pathname: string) {
  const paths = [...group.items.map((item) => item.to), ...(group.territoryPaths ?? [])]
  return paths.some((to) => (to === '/' ? pathname === '/' : pathname.startsWith(to)))
}

/**
 * Which territory a route belongs to — the single source of truth shared
 * with AppShell's mode header/tint, so the nav grouping above and the
 * content-area treatment can never drift apart. Routes that aren't listed
 * in either group at all (Movie Detail, Taste DNA, Settings) are
 * deliberately neutral — they're "Both" or "—" per CLAUDE.md's screens
 * table, not Discover or Decide.
 */
export type AppMode = 'discover' | 'decide' | null

export function getActiveMode(pathname: string): AppMode {
  if (isGroupActive(groups[0], pathname)) return 'discover'
  if (isGroupActive(groups[1], pathname)) return 'decide'
  return null
}

// Desktop-sidebar-only (DESIGN.md §4) — the mobile drawer this used to also
// serve is gone; the TabBar covers navigation below 1024px instead.
export function Nav() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const activeGroup = groups.find((group) => isGroupActive(group, pathname))

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface px-5 py-6">
      <div
        className={`h-1 w-10 rounded-full transition-colors duration-[var(--transition-base)] ease-[var(--ease-standard)] ${
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
              className={`rounded-xl border px-3 py-3 transition-colors duration-[var(--transition-base)] ease-[var(--ease-standard)] ${
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
                        `block rounded-lg px-2.5 py-2 font-ui text-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
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

      <ul className="flex flex-col gap-1 border-t border-border pt-4">
        {moreLinks.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
              className={({ isActive }) =>
                `block rounded-lg px-2.5 py-2 font-ui text-sm transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
                  isActive ? 'text-text font-semibold' : 'text-muted hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 border-t border-border pt-4 font-ui text-[11px] text-muted-subtle">
        <NavLink to="/privacy" className="transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-muted">
          Privacy
        </NavLink>
        <span aria-hidden="true">·</span>
        <NavLink to="/terms" className="transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-muted">
          Terms
        </NavLink>
      </div>

      {user && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
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
    </nav>
  )
}
