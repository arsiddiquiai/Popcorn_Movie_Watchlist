import { useEffect, useRef, useState, type ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import { AssistantIcon, DiceIcon, SearchIcon, ShelfIcon, YouIcon } from './icons'

interface Tab {
  to: string
  label: string
  end?: boolean
  Icon: ComponentType
}

// The five real destinations DESIGN.md §4 collapses the app down to on
// mobile. Routes don't change — Cinema Bridge and Settings/Feedback/etc.
// still exist at their own URLs, just reached from inside Search and the
// "You" tab (Taste DNA) respectively, not from a sixth/seventh tab here.
const TABS: Tab[] = [
  { to: '/', label: 'Shelf', end: true, Icon: ShelfIcon },
  { to: '/search', label: 'Search', Icon: SearchIcon },
  { to: '/pick', label: 'Pick', Icon: DiceIcon },
  { to: '/assistant', label: 'Assistant', Icon: AssistantIcon },
  { to: '/taste', label: 'You', Icon: YouIcon },
]

/** Fixed bottom navigation, <1024px only — the desktop sidebar (Nav.tsx)
 *  covers this at lg. Hides on scroll-down and reveals on scroll-up so it
 *  doesn't eat screen real estate while reading a long list, per §4. */
export function TabBar() {
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const delta = y - lastY.current
      // Ignore sub-6px jitter (momentum scroll, mobile Safari's rubber-band
      // overscroll) so the bar doesn't flicker on a near-stationary page.
      if (Math.abs(delta) < 6) return
      setVisible(delta < 0 || y < 64)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-bg/80 backdrop-blur transition-transform duration-[var(--transition-fast)] ease-[var(--ease-standard)] lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `relative flex h-16 flex-1 flex-col items-center justify-center gap-1 font-ui text-[10px] font-medium transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] ${
              isActive ? 'text-accent-warm' : 'text-muted'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span aria-hidden="true" className="absolute inset-x-5 top-0 h-[3px] rounded-full bg-accent-warm" />
              )}
              <tab.Icon />
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
