import { Link } from 'react-router-dom'
import { AssistantMark } from './AssistantMark'

/**
 * 48px floating action button that opens the AI Assistant, shown on Shelf
 * and Search only (DESIGN.md §7) — "the only floating element in the app."
 * Sits above the TabBar with a safe-area-aware offset; mobile only, since
 * desktop already has Movie Assistant in the sidebar.
 */
export function AssistantFab() {
  return (
    <Link
      to="/assistant"
      aria-label="Open Movie Assistant"
      className="fixed right-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-surface shadow-[var(--shadow-lift)] transition-transform duration-[var(--transition-fast)] ease-[var(--ease-standard)] active:scale-95 lg:hidden"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)' }}
    >
      <AssistantMark state="idle" size={26} />
    </Link>
  )
}
