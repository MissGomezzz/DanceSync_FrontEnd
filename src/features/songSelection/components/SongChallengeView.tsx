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
  correct: 'text-emerald-400',
  incorrect: 'bg-rose-900/60 text-rose-300 underline decoration-rose-400',
  pending: 'text-slate-500',
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
    ? 'border-slate-700 focus:border-brand-red'
    : feedback.hasError
      ? 'border-rose-500 focus:border-rose-500'
      : feedback.isComplete
        ? 'border-emerald-500 focus:border-emerald-500'
        : 'border-sky-600 focus:border-sky-500'

  return (
    <section
      aria-label="Song selection challenge"
      className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Type it first to choose the song
        </h2>
        <span
          role="timer"
          aria-label="Time left"
          className={`font-mono text-2xl font-bold tabular-nums ${urgent ? 'text-rose-400' : 'text-slate-100'}`}
        >
          {seconds}s
        </span>
      </header>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-rose-500' : 'bg-brand-red'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p data-testid="challenge-phrase" aria-label={phrase} className="select-none text-center font-mono text-3xl tracking-wide">
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
          className={`flex-1 rounded-lg border bg-slate-950 px-3 py-2 font-mono text-lg text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:opacity-50 ${inputTone}`}
        />
        <button
          type="submit"
          disabled={!canType || submitting || typed.trim().length === 0}
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <p className="text-xs text-slate-500" aria-live="polite">
        {feedback.correctPrefix} / {phrase.length} correct characters
        {feedback.extraCount > 0 && ` · ${feedback.extraCount} extra`}
      </p>

      {notice && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border border-rose-900 bg-rose-950/40 text-rose-300'
              : 'border border-slate-700 bg-slate-800/60 text-slate-300'
          }`}
        >
          {notice.text}
        </p>
      )}
    </section>
  )
}
