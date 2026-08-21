import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Logo } from '../components/layout/Logo'

type Mode = 'login' | 'signup'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FieldErrors {
  email?: string
  password?: string
}

export default function Auth() {
  const { signUp, signIn } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setFormError(null)
    setInfoMessage(null)
    setFieldErrors({})
  }

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'
    if (password.length < 6) errors.password = 'Password must be at least 6 characters.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setInfoMessage(null)
    if (!validate()) return

    setSubmitting(true)

    if (mode === 'signup') {
      const { error, needsEmailConfirmation } = await signUp(email, password, displayName || undefined)
      setSubmitting(false)
      if (error) {
        setFormError(error)
        return
      }
      if (needsEmailConfirmation) {
        setMode('login')
        setFieldErrors({})
        setInfoMessage('Check your inbox to confirm your email, then log in.')
      }
      return
    }

    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setFormError(error)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-muted/20 bg-surface p-8">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="mb-6 flex rounded-lg border border-muted/20 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-md py-1.5 font-ui text-sm transition-colors duration-[var(--transition-fast)] ${
              mode === 'login' ? 'bg-bg font-semibold text-text' : 'text-muted'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 rounded-md py-1.5 font-ui text-sm transition-colors duration-[var(--transition-fast)] ${
              mode === 'signup' ? 'bg-bg font-semibold text-text' : 'text-muted'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="font-ui text-xs text-muted">
                Display name (optional)
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="rounded-lg border border-muted/25 bg-bg px-3 py-2 font-ui text-sm text-text outline-none focus:border-accent-warm"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="font-ui text-xs text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-muted/25 bg-bg px-3 py-2 font-ui text-sm text-text outline-none focus:border-accent-warm"
            />
            {fieldErrors.email && <p className="font-ui text-xs text-accent-cold">{fieldErrors.email}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="font-ui text-xs text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-muted/25 bg-bg px-3 py-2 font-ui text-sm text-text outline-none focus:border-accent-warm"
            />
            {fieldErrors.password && <p className="font-ui text-xs text-accent-cold">{fieldErrors.password}</p>}
          </div>

          {formError && <p className="font-ui text-xs text-accent-cold">{formError}</p>}
          {infoMessage && (
            <p className="rounded-lg border border-accent-warm/40 bg-accent-warm/10 px-3 py-2 font-ui text-xs text-accent-warm">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-accent-warm px-4 py-2.5 font-ui text-sm font-semibold text-bg transition-opacity duration-[var(--transition-fast)] disabled:opacity-60"
          >
            {submitting ? (mode === 'signup' ? 'Signing up…' : 'Logging in…') : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
