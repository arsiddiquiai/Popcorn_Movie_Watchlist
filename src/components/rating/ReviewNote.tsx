import { useState } from 'react'
import { saveReviewText } from '../../lib/ratings'

interface ReviewNoteProps {
  ratingId: string
  initialText: string | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Optional free-text note on a rating. Collapsed by default — one tap to
 *  expand, entirely skippable — so it adds zero friction to the core
 *  slider -> why-chips flow it sits below. */
export function ReviewNote({ ratingId, initialText }: ReviewNoteProps) {
  const [expanded, setExpanded] = useState(() => Boolean(initialText))
  const [text, setText] = useState(initialText ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')

  async function handleBlur() {
    if (text.trim() === (initialText ?? '').trim()) return // nothing changed, skip the write
    setSaveState('saving')
    try {
      await saveReviewText(ratingId, text)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="self-start font-ui text-xs text-muted underline underline-offset-4 transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] hover:text-text"
      >
        Add a note (optional)
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`review-${ratingId}`} className="font-ui text-xs text-muted">
        Your note (optional)
      </label>
      <textarea
        id={`review-${ratingId}`}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setSaveState('idle')
        }}
        onBlur={() => void handleBlur()}
        rows={3}
        maxLength={2000}
        placeholder="What stuck with you about it?"
        className="w-full resize-none rounded-lg border border-border bg-bg/40 px-3 py-2 font-ui text-sm text-text outline-none transition-colors duration-[var(--transition-fast)] ease-[var(--ease-standard)] placeholder:text-muted-subtle focus:border-accent-warm"
      />
      <span className="font-ui text-[11px] text-muted-subtle">
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved'}
        {saveState === 'error' && "Couldn't save — try again"}
      </span>
    </div>
  )
}
