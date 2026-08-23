export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-md"
        style={{
          background: 'linear-gradient(135deg, var(--hero) 0%, var(--accent-warm) 100%)',
          boxShadow: '0 8px 32px -8px rgb(200 68 45 / 0.45)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M13.5 4.2c-2.1.4-3.6 2-3.6 3.9 0 .5.1.9.3 1.3-2.5.7-4.3 2.6-4.3 4.9 0 .9.3 1.7.8 2.4L5.1 26.1c-.1.9.6 1.7 1.6 1.7h1.9l1-9.4a1 1 0 0 1 2 .2l-1 9.2h2.2l.6-9.6a1 1 0 0 1 2 .1l-.6 9.5h2.1l-.2-9.6a1 1 0 0 1 2-.1l.3 9.7h2l-1-9.4a1 1 0 0 1 2-.2l1 9.6h1.8c1 0 1.7-.8 1.6-1.7l-1.6-9.4c.5-.7.8-1.5.8-2.4 0-2.3-1.8-4.2-4.3-4.9.2-.4.3-.8.3-1.3 0-2.1-1.9-3.8-4.3-3.8-1 0-2 .3-2.7.9-.6-.5-1.5-.8-2.4-.8Z"
            fill="var(--bg)"
          />
        </svg>
      </div>
      <span className="font-display text-lg leading-none tracking-tight text-text">Popcorn</span>
    </div>
  )
}
