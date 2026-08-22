import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/layout/Logo'
import { Spinner } from '../components/ui/Spinner'
import { supabase } from '../lib/supabaseClient'

type Status = 'checking' | 'ready' | 'invalid'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Supabase's client parses the recovery token out of the URL and
    // establishes a session before this even runs, in the common case —
    // the PASSWORD_RECOVERY listener is a defensive fallback for any
    // timing race, not the primary path.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data.session ? 'ready' : 'invalid')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setFieldError(null)

    if (password.length < 6) {
      setFieldError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-muted/20 bg-surface p-8">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        {status === 'checking' && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}

        {status === 'invalid' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="font-ui text-sm text-muted">
              This password reset link is invalid or has expired. Request a new one from the login screen.
            </p>
            <Link
              to="/auth"
              className="rounded-lg bg-accent-warm px-4 py-2 font-ui text-sm font-semibold text-bg transition-opacity duration-[var(--transition-fast)] hover:opacity-90"
            >
              Back to log in
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <>
            <h1 className="mb-6 text-center font-display text-lg text-text">Set a new password</h1>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="font-ui text-xs text-muted">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-lg border border-muted/25 bg-bg px-3 py-2 font-ui text-sm text-text outline-none focus:border-accent-warm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="font-ui text-xs text-muted">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="rounded-lg border border-muted/25 bg-bg px-3 py-2 font-ui text-sm text-text outline-none focus:border-accent-warm"
                />
                {fieldError && <p className="font-ui text-xs text-accent-cold">{fieldError}</p>}
              </div>

              {formError && <p className="font-ui text-xs text-accent-cold">{formError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-lg bg-accent-warm px-4 py-2.5 font-ui text-sm font-semibold text-bg transition-opacity duration-[var(--transition-fast)] disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
