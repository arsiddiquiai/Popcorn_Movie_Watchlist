import { Link } from 'react-router-dom'
import { KernelMark } from '../components/layout/Logo'

/** Reached only right after a successful self-service deletion (Settings'
 *  danger zone navigates here). Deliberately outside ProtectedLayout — by
 *  the time this renders, the account no longer exists, so there is nothing
 *  to authenticate against. */
export default function AccountDeleted() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <KernelMark size={40} fill="var(--muted-subtle)" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-text">Your account has been deleted</h1>
        <p className="max-w-sm font-ui text-sm leading-relaxed text-muted">
          Your watchlist, ratings, and AI history are gone. Thanks for trying Popcorn.
        </p>
      </div>
      <Link
        to="/auth"
        className="rounded-full border border-border px-6 py-3 font-ui text-sm text-text transition-[border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40 active:scale-[0.97]"
      >
        Back to sign in
      </Link>
    </div>
  )
}
