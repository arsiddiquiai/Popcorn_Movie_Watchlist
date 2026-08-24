import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  AssistantError,
  sendAssistantMessage,
  type AssistantMessage,
} from '../lib/assistantClient'
import { PageHeader } from '../components/layout/Page'
import { useTheme } from '../theme/ThemeProvider'

interface ChatMessage extends AssistantMessage {
  id: number
  /** Set only on an assistant message that added something this turn. */
  addedTmdbId?: number
}

/** Sent to the server as `history` — capped client-side too (the server
 *  re-caps regardless of what's sent, but there's no reason to ship more
 *  than it will use). */
const HISTORY_LIMIT = 10

let nextId = 0

export default function Assistant() {
  const { reducedMotion } = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cappedMessage, setCappedMessage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [messages, sending, reducedMotion])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    const userMessage: ChatMessage = { id: nextId++, role: 'user', content: text }
    const history = messages.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)
    setErrorMessage(null)
    setCappedMessage(null)

    try {
      const result = await sendAssistantMessage(text, history)
      if ('kind' in result) {
        setCappedMessage(result.message)
        return
      }
      setMessages((prev) => [
        ...prev,
        { id: nextId++, role: 'assistant', content: result.reply, addedTmdbId: result.added_tmdb_id ?? undefined },
      ])
    } catch (err) {
      setErrorMessage(err instanceof AssistantError ? err.message : 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10 sm:px-10 sm:py-14">
      <PageHeader
        title="Movie Assistant"
        subtitle={'Talk through what to watch — ask about a film, describe a mood, or say "add it" when something clicks.'}
      />

      <div className="mt-10 flex flex-1 flex-col gap-4 overflow-y-auto">
        {messages.length === 0 && (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 font-ui text-sm text-muted">
            Try: "Something like Parasite but lighter?" or "What's a good 90-minute thriller?"
          </p>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 font-ui text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent-warm font-medium text-bg'
                  : 'border border-border bg-surface text-text shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.addedTmdbId && (
                <Link
                  to={`/movie/${msg.addedTmdbId}`}
                  className="mt-1.5 inline-block font-ui text-xs font-semibold underline underline-offset-4 opacity-80 hover:opacity-100"
                >
                  Added to your watchlist — view it
                </Link>
              )}
            </div>
          </motion.div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-border bg-surface px-4 py-2.5 font-ui text-sm text-muted">
              {reducedMotion ? (
                'Thinking…'
              ) : (
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  Thinking…
                </motion.span>
              )}
            </div>
          </div>
        )}

        {cappedMessage && (
          <p className="rounded-xl border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 font-ui text-sm text-accent-cold">
            {cappedMessage}
          </p>
        )}
        {errorMessage && (
          <p className="rounded-xl border border-accent-cold/40 bg-accent-cold/10 px-4 py-3 font-ui text-sm text-accent-cold">
            {errorMessage}
          </p>
        )}

        <div ref={scrollRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleSend()
        }}
        className="mt-6 flex items-center gap-2 border-t border-border pt-6"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about something to watch…"
          maxLength={1000}
          disabled={sending || Boolean(cappedMessage)}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 font-ui text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted-subtle focus:border-accent-warm disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim() || Boolean(cappedMessage)}
          className="btn-hero rounded-full px-5 py-2.5 font-ui text-sm font-semibold disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
