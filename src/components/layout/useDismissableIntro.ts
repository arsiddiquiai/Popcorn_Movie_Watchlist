import { useState } from 'react'

/** Per-browser, one-time dismissal — not synced to Supabase, since it's a contextual tip, not a real preference. */
export function useDismissableIntro(key: string): [boolean, () => void] {
  const storageKey = `popcorn:seen-intro-${key}`
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true'
    } catch {
      return false
    }
  })

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(storageKey, 'true')
    } catch {
      /* private browsing / storage disabled — just don't persist it */
    }
  }

  return [dismissed, dismiss]
}
