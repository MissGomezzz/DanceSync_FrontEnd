import type { FormEvent } from 'react'
import { compareTyping, type CharStatus } from '../lib/typingFeedback'

interface SongChallengeViewProps {
  phrase: string
  remainingMs: number
  totalMs: number
  typed: string
  /** False for spectators, players who already failed, or once time is up. */
  canType: boolean
  submitting: boolean
  /** Explains why the player cannot type, or the result of their attempt. */
  notice: { tone: 'info' | 'error'; text: string } | null
  onTypedChange: (value: string) => void
  onSubmit: () => void
}

const charClasses: Record<CharStatus, string> = {
  correct: 'text-emerald-700',
  incorrect: 'bg-rose-100 text-rose-700 underline decoration-rose-500',
  pending: 'text-ink-soft',
}

export function SongChallengeView({
  phrase,
  remainingMs,
  totalMs,
  typed,
  canType,
  submitting,
  notice,
  onTypedChange,
  onSubmit,
}: SongChallengeViewProps) {
  const feedback = compareTyping(phrase, typed)
  const seconds = Math.ceil(remainingMs / 1000)
  const progress = totalMs > 0 ? Math.min(100, (remainingMs / totalMs) * 100) : 0
  const urgent = remainingMs <= 5000

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canType && !submitting && typed.trim().length > 0) onSubmit()
  }

  const inputTone = typed.length === 0
    ? 'border-line focus:border-primary'
    : feedback.hasError
      ? 'border-rose-500 focus:border-rose-500'
      : feedback.isComplete
        ? 'border-emerald-500 focus:border-emerald-500'
        : 'border-secondary/60 focus:border-secondary'

  return (
    <section
      aria-label="Song selection challenge"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface shadow-soft p-6"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Type it first to choose the song
        </h2>
        <span
          role="timer"
          aria-label="Time left"
          className={`font-mono text-2xl font-bold tabular-nums ${urgent ? 'text-rose-600' : 'text-ink'}`}
        >
          {seconds}s
        </span>
      </header>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-rose-500' : 'bg-linear-to-r from-primary to-secondary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p data-testid="challenge-phrase" aria-label={phrase} className="select-none text-center font-mono text-3xl tracking-wide text-ink">
        {feedback.chars.map((c, i) => (
          <span key={i} data-status={c.status} className={`rounded-sm ${charClasses[c.status]}`}>
            {c.char}
          </span>
        ))}
      </p>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          // Remounted per challenge, so the keyboard focus lands here as soon as the phrase appears.
          autoFocus
          aria-label="Type the phrase"
          aria-invalid={feedback.hasError}
          value={typed}
          onChange={(event) => onTypedChange(event.target.value)}
          onPaste={(event) => event.preventDefault()}
          disabled={!canType || submitting}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={canType ? 'Start typing...' : ''}
          className={`flex-1 rounded-lg border bg-surface px-3 py-2 font-mono text-lg text-ink placeholder:text-ink-soft/70 focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50 ${inputTone}`}
        />
        <button
          type="submit"
          disabled={!canType || submitting || typed.trim().length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <p className="text-xs text-ink-soft" aria-live="polite">
        {feedback.correctPrefix} / {phrase.length} correct characters
        {feedback.extraCount > 0 && ` · ${feedback.extraCount} extra`}
      </p>

      {notice && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border border-rose-200 bg-rose-50 font-medium text-rose-700'
              : 'border border-secondary/20 bg-secondary-soft text-secondary-strong'
          }`}
        >
          {notice.text}
        </p>
      )}
    </section>
  )
}
