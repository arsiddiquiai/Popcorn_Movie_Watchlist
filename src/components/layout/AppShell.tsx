import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { mainBackgroundForMode, ModeHeader } from './ModeHeader'
import { getActiveMode, Nav } from './Nav'
import { TabBar } from './TabBar'

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

  return (
    <AppBarActionContext.Provider value={setBarAction}>
      <div className="flex min-h-screen flex-col bg-bg text-text lg:flex-row">
        {/* DESIGN.md §4: the hamburger + slide-out drawer are gone. Below
            1024px, navigation lives entirely in the bottom TabBar; this top
            bar is chrome only (brand + the current page's own action) —
            it's no longer a menu trigger. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">{barAction}</div>
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

        <TabBar />
      </div>
    </AppBarActionContext.Provider>
  )
}
