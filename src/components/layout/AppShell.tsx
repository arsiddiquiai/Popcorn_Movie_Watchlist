import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../../theme/ThemeProvider'
import { Logo } from './Logo'
import { mainBackgroundForMode, ModeHeader } from './ModeHeader'
import { getActiveMode, Nav } from './Nav'

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  )
}

// A slot the mobile app bar exposes for the current page's own primary
// action (today: Watchlist's Surprise Me dice — DESIGN.md §3 moves it off
// the page body and into the bar). Only one page owns the slot at a time;
// registering unmounts the previous occupant's effect cleanup first, so
// navigating away always clears it.
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
  const { reducedMotion } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [barAction, setBarAction] = useState<ReactNode>(null)
  const mode = getActiveMode(pathname)

  return (
    <AppBarActionContext.Provider value={setBarAction}>
      <div className="flex min-h-screen flex-col bg-bg text-text md:flex-row">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          {barAction}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-text"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      <div className="hidden md:block">
        <Nav />
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-0 z-50 flex md:hidden"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setDrawerOpen(false)
            }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <motion.div
              className="relative"
              initial={reducedMotion ? false : { x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reducedMotion ? undefined : { x: -20, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Nav onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`min-w-0 flex-1 ${mainBackgroundForMode(mode)}`}>
        {/* DESIGN.md §3: the full-width Discover/Decide band is removed on
            mobile entirely — it's pure vertical tax above the fold there.
            §4 replaces it on desktop with a quiet sidebar group label
            instead of this banner; until that lands, desktop keeps the
            existing band as-is. */}
        {mode && (
          <div className="hidden md:block">
            <ModeHeader mode={mode} />
          </div>
        )}
        {children}
      </main>
    </div>
    </AppBarActionContext.Provider>
  )
}
