/**
 * The popcorn kernel, mid-pop (CLAUDE.md's logo spec). Split out from Logo so
 * empty states and other placeholder surfaces can use the real brand mark
 * instead of inventing their own filler — the watchlist empty state used to
 * render the literal word "art" in a box.
 */
export function KernelMark({ size = 20, fill = 'var(--bg)' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M13.5 4.2c-2.1.4-3.6 2-3.6 3.9 0 .5.1.9.3 1.3-2.5.7-4.3 2.6-4.3 4.9 0 .9.3 1.7.8 2.4L5.1 26.1c-.1.9.6 1.7 1.6 1.7h1.9l1-9.4a1 1 0 0 1 2 .2l-1 9.2h2.2l.6-9.6a1 1 0 0 1 2 .1l-.6 9.5h2.1l-.2-9.6a1 1 0 0 1 2-.1l.3 9.7h2l-1-9.4a1 1 0 0 1 2-.2l1 9.6h1.8c1 0 1.7-.8 1.6-1.7l-1.6-9.4c.5-.7.8-1.5.8-2.4 0-2.3-1.8-4.2-4.3-4.9.2-.4.3-.8.3-1.3 0-2.1-1.9-3.8-4.3-3.8-1 0-2 .3-2.7.9-.6-.5-1.5-.8-2.4-.8Z"
        fill={fill}
      />
    </svg>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-md"
        style={{
          background: 'linear-gradient(135deg, var(--hero) 0%, var(--accent-warm) 100%)',
          // Was a hardcoded rgb(200 68 45 / .45) — nightcap's own --hero,
          // so it read right there but stayed ember-tinted on daylight and
          // neon regardless of their actual --hero. Same theme-blind-shadow
          // bug .btn-hero's box-shadow had before --glow/--glow-strong;
          // color-mix keeps this one live against whichever --hero is
          // active instead of needing its own token pair for one box.
          boxShadow: '0 8px 32px -8px color-mix(in srgb, var(--hero) 45%, transparent)',
        }}
      >
        <KernelMark />
      </div>
      <span className="font-display text-lg leading-none tracking-tight text-text">Popcorn</span>
    </div>
  )
}
