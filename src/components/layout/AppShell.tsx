import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AssistantFab } from '../assistant/AssistantFab'
import { FeedbackIcon } from './icons'
import { Logo } from './Logo'
import { mainBackgroundForMode, ModeHeader } from './ModeHeader'
import { getActiveMode, Nav } from './Nav'
import { TabBar } from './TabBar'

// DESIGN.md §7: the kernel FAB shows on Shelf and Search only — not every
// Discover/Decide route, so this is an explicit pathname check rather than
// reusing getActiveMode's broader grouping.
const ASSISTANT_FAB_ROUTES = new Set(['/', '/search'])

// A slot the mobile app bar exposes for the current page's own primary
// action (today: Watchlist's Surprise Me dice, and its collapsed title —
// DESIGN.md §3 moves both off the page body and into the bar). Only one
// page owns the slot at a time; registering unmounts the previous
// occupant's effect cleanup first, so navigating away always clears it.
const AppBarActionContext = createContext<(node: ReactNode) => void>(() => {})

export function useAppBarAction(node: ReactNode) {
  const setAction = useContext(AppBarActionContext)
  useEffect(() => {
    setAction(node)
    return () => setAction(null)
  }, [node, setAction])
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [barAction, setBarAction] = useState<ReactNode>(null)
  const mode = getActiveMode(pathname)

  // React Router doesn't scroll-restore on navigation by default — without
  // this, landing on a new route keeps whatever scrollY the previous page
  // left behind. That's what made Settings appear to open scrolled to its
  // Danger Zone: nothing route-specific, just the browser's normal scroll
  // position carrying over onto a page tall enough for it to be a visible
  // difference (live-review fix).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <AppBarActionContext.Provider value={setBarAction}>
      <div className="flex min-h-screen flex-col bg-bg text-text lg:flex-row">
        {/* DESIGN.md §4: the hamburger + slide-out drawer are gone. Below
            1024px, navigation lives entirely in the bottom TabBar; this top
            bar is chrome only (brand + the current page's own action) —
            it's no longer a menu trigger. Feedback is a persistent icon
            here (live-review fix) rather than something buried in the You
            tab — reachable from literally every screen without navigating
            away from whatever the user was doing. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            {barAction}
            <Link
              to="/feedback"
              aria-label="Feedback"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:bg-surface hover:text-text"
            >
              <FeedbackIcon />
            </Link>
          </div>
        </header>

        <div className="hidden lg:block">
          <Nav />
        </div>

        <main className={`min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0 ${mainBackgroundForMode(mode)}`}>
          {/* DESIGN.md §3: the full-width Discover/Decide band is pure
              vertical tax on mobile, where the TabBar already makes the
              territory obvious — removed there entirely. Desktop keeps it. */}
          {mode && (
            <div className="hidden lg:block">
              <ModeHeader mode={mode} />
            </div>
          )}
          {children}
        </main>

        {ASSISTANT_FAB_ROUTES.has(pathname) && <AssistantFab />}

        <TabBar />
      </div>
    </AppBarActionContext.Provider>
  )
}
