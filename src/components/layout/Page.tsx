import type { ReactNode } from 'react'

/**
 * Shared page rhythm.
 *
 * Before this existed, every route invented its own container: page padding
 * ran py-8 / py-10 / py-12, section gaps ran gap-4 / gap-6 / gap-10, and the
 * page title was a different size on almost every screen. Inconsistent
 * whitespace is one of the fastest tells of an unpolished app, so the scale
 * lives here once instead of being retyped per route.
 *
 * The scale (a 4px base, using only even steps so it stays predictable):
 *   page padding      px-6 sm:px-10   py-10 sm:py-14
 *   header -> body    gap-10
 *   section -> section gap-10
 *   inside a section  gap-4
 *
 * `width` maps to the three content shapes the app actually uses rather than
 * letting each screen pick an arbitrary max-w:
 *   prose  — reading//form column (Settings, Coming Soon, Assistant, Bridge)
 *   wide   — poster grids (Watchlist, Search)
 *   full   — bespoke layouts that manage their own width (Movie Detail)
 */
type Width = 'prose' | 'wide' | 'full'

const WIDTHS: Record<Width, string> = {
  prose: 'max-w-2xl',
  wide: 'max-w-6xl',
  full: 'max-w-none',
}

export function Page({
  children,
  width = 'prose',
  className = '',
}: {
  children: ReactNode
  width?: Width
  className?: string
}) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14 ${WIDTHS[width]} ${className}`}>
      {children}
    </div>
  )
}

/**
 * The one page title treatment. CLAUDE.md asks for heavy grotesk display type
 * at large sizes with high contrast, and for the most important thing on a
 * screen to be obvious at a glance — so this is deliberately much larger than
 * anything else on the page rather than one step up from body text.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  /** Right-aligned controls that belong to the page as a whole. */
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-text sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-prose font-ui text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/**
 * Sub-section label within a page ("Trailer", "Where to Watch", "Energy").
 * These were previously a mix of text-sm semibold and text-xs uppercase
 * depending on the screen; unifying them is what makes the hierarchy read as
 * page title -> section -> body instead of two nearly-equal weights.
 */
export function SectionHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`font-display text-xs font-semibold tracking-[0.14em] text-muted uppercase ${className}`}
    >
      {children}
    </h2>
  )
}

/** A titled block: heading plus its content, on the shared inner gap. */
export function Section({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <SectionHeading>{title}</SectionHeading>
        {actions}
      </div>
      {children}
    </section>
  )
}
