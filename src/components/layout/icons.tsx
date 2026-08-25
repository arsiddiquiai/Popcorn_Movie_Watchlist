import { KernelMark } from './Logo'

/** Line icons shared between the bottom TabBar and any page-level action
 *  that wants the same mark (e.g. Watchlist's Surprise Me dice, both in the
 *  app bar and as the Pick tab). All 22px per DESIGN.md §4's tab bar spec,
 *  stroke=currentColor so they inherit whatever text colour their wrapper
 *  sets (active/inactive tab state, etc.) rather than hardcoding a colour. */

export function ShelfIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="4" width="6" height="16" rx="1.5" />
      <rect x="9.5" y="6.5" width="6" height="13.5" rx="1.5" />
      <rect x="16" y="3" width="5" height="17" rx="1.5" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

export function DiceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="8.25" cy="8.25" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.75" cy="8.25" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="8.25" cy="15.75" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.75" cy="15.75" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** The Assistant tab reuses the brand's own KernelMark rather than a
 *  generic chat-bubble icon — DESIGN.md §7 calls it out as the app's
 *  smartest feature and gives it its own identity everywhere it appears. */
export function AssistantIcon() {
  return <KernelMark size={22} fill="currentColor" />
}

/** "Simple avatar/spark" per DESIGN.md §4 — a plain head-and-shoulders
 *  mark, deliberately not a photo/initial avatar since there's no user
 *  image anywhere in the data model. */
export function YouIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.8 4.4-6 7.5-6s6.1 2.2 7.5 6" />
    </svg>
  )
}
