import { useState } from 'react'
import { Page, PageHeader } from '../components/layout/Page'
import { FeedbackError, submitFeedback } from '../lib/feedbackClient'

const MESSAGE_MAX = 4000

export default function Feedback() {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || state === 'sending') return

    setState('sending')
    setError(null)
    try {
      await submitFeedback(trimmed, email.trim() || null)
      setState('sent')
      setMessage('')
      setEmail('')
    } catch (err) {
      setState('idle')
      setError(err instanceof FeedbackError ? err.message : 'Something went wrong. Try again.')
    }
  }

  if (state === 'sent') {
    return (
      <Page>
        <PageHeader title="Feedback" />
        <div className="flex flex-col items-start gap-4 rounded-lg border border-accent-warm/30 bg-accent-warm/5 px-6 py-8">
          <p className="font-display text-xl font-semibold text-text">Thanks — that came through.</p>
          <p className="max-w-prose font-ui text-sm leading-relaxed text-muted">
            Every note gets read. If you left an email, you might hear back.
          </p>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="rounded-full border border-border px-6 py-3 font-ui text-sm text-text transition-[border-color,transform] duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:border-accent-warm/40 active:scale-[0.97]"
          >
            Send another
          </button>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Feedback"
        subtitle="Found a bug, or something feels off? Tell me plainly — it goes straight to my inbox."
      />

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="feedback-message" className="font-display text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            What's on your mind
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
            rows={7}
            required
            placeholder="The rating slider felt fiddly on my phone…"
            className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 font-ui text-base leading-relaxed text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-warm"
          />
          <span className="self-end font-mono text-[11px] text-muted-subtle">
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="feedback-email" className="font-display text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            Email <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="feedback-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Only if you'd like a reply"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 font-ui text-base text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted/70 focus:border-accent-warm"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 font-ui text-sm text-accent-cold">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={state === 'sending' || !message.trim()}
          className="btn-hero self-start rounded-full px-6 py-3 font-ui text-sm font-semibold disabled:opacity-40"
        >
          {state === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </Page>
  )
}
