import type { ReactNode } from 'react'
import { Nav } from './Nav'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Nav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
