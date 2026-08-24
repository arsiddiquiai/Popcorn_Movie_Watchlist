import { useState, type ReactNode } from 'react'
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

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { reducedMotion } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mode = getActiveMode(pathname)

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text md:flex-row">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-text"
        >
          <MenuIcon />
        </button>
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
        {mode && <ModeHeader mode={mode} />}
        {children}
      </main>
    </div>
  )
}
