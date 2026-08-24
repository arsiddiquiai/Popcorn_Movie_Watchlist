import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  AssistantError,
  sendAssistantMessage,
  type AssistantMessage,
  type AssistantSuggestedMovie,
} from '../lib/assistantClient'
import { PageHeader } from '../components/layout/Page'
import { addToWatchlist } from '../lib/watchlist'
import { tmdbImageUrl } from '../lib/tmdbClient'
import { useTheme } from '../theme/ThemeProvider'

interface ChatMessage extends AssistantMessage {
  id: number
  /** Set only on an assistant message that added something this turn. */
  addedTmdbId?: number
  /** Structured movies this turn's tool calls actually surfaced — additive
   *  alongside the prose in `content`, rendered as one-tap add chips. */
  suggestedMovies?: AssistantSuggestedMovie[]
}

/** Sent to the server as `history` — capped client-side too (the server
 *  re-caps regardless of what's sent, but there's no reason to ship more
 *  than it will use). */
const HISTORY_LIMIT = 10

let nextId = 0

type ChipState = 'idle' | 'pending' | 'added' | 'error'

function SuggestionChip({
  movie,
  state,
  onAdd,
}: {
  movie: AssistantSuggestedMovie
  state: ChipState
  onAdd: () => void
}) {
  const posterUrl = tmdbImageUrl(movie.poster_path, 'w92')

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface py-1 pr-1 pl-1.5">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-2">
        {posterUrl ? (
          <img src={posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" aria-hidden="true" />
        )}
      </div>
      <Link
        to={`/movie/${movie.tmdb_id}`}
        className="min-w-0 truncate font-ui text-xs font-medium text-text hover:underline"
        title={movie.title}
      >
        {movie.title}
        {movie.release_year ? <span className="text-muted-subtle"> · {movie.release_year}</span> : null}
      </Link>
      <button
        type="button"
        onClick={onAdd}
        disabled={state === 'pending' || state === 'added'}
        className={`shrink-0 rounded-full px-3 py-1.5 font-ui text-xs font-semibold transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] disabled:opacity-70 ${
          state === 'added'
            ? 'bg-accent-warm/15 text-accent-warm'
            : 'bg-accent-warm text-bg hover:bg-accent-warm/90'
        }`}
      >
        {state === 'pending' ? 'Adding…' : state === 'added' ? 'Added ✓' : state === 'error' ? 'Retry' : 'Add'}
      </button>
    </div>
  )
}

export default function Assistant() {
  const { user } = useAuth()
  const { reducedMotion } = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cappedMessage, setCappedMessage] = useState<string | null>(null)
  // Keyed by tmdb_id, not per-message: the same film can appear as a chip on
  // more than one message across a conversation, and once it's added it
  // should read as added everywhere, not just on the chip that was clicked.
  const [chipStates, setChipStates] = useState<Record<number, ChipState>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [messages, sending, reducedMotion])

  async function handleAddSuggestion(movie: AssistantSuggestedMovie) {
    if (!user) return
    const current = chipStates[movie.tmdb_id]
    if (current === 'pending' || current === 'added') return

    setChipStates((prev) => ({ ...prev, [movie.tmdb_id]: 'pending' }))
    try {
      await addToWatchlist(movie.tmdb_id, user.id)
      setChipStates((prev) => ({ ...prev, [movie.tmdb_id]: 'added' }))
    } catch {
      setChipStates((prev) => ({ ...prev, [movie.tmdb_id]: 'error' }))
    }
  }

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
        {
          id: nextId++,
          role: 'assistant',
          content: result.reply,
          addedTmdbId: result.added_tmdb_id ?? undefined,
          suggestedMovies: result.suggested_movies,
        },
      ])
      // A film added via a tool call this turn (the user typed "add it")
      // should also show as added on any matching chip, not just via the
      // "Added to your watchlist" link.
      if (result.added_tmdb_id) {
        setChipStates((prev) => ({ ...prev, [result.added_tmdb_id as number]: 'added' }))
      }
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
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
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

            {msg.suggestedMovies && msg.suggestedMovies.length > 0 && (
              <div className="flex max-w-[95%] flex-wrap gap-2">
                {msg.suggestedMovies.map((movie) => (
                  <SuggestionChip
                    key={movie.tmdb_id}
                    movie={movie}
                    state={chipStates[movie.tmdb_id] ?? 'idle'}
                    onAdd={() => void handleAddSuggestion(movie)}
                  />
                ))}
              </div>
            )}
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
          placeholder={'Something like Parasite but lighter, or a good 90-minute thriller…'}
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
