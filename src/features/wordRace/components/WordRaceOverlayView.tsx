import type { FormEvent } from 'react'
import type { WordRaceBanner, WordRaceBannerKind } from '../types'

export interface WordRoundView {
  word: string
  roundNumber: number
  totalRounds: number
  remainingMs: number
  totalMs: number
}

interface WordRaceOverlayViewProps {
  /** Round on screen, or null when only the result banner is shown. */
  round: WordRoundView | null
  result: WordRaceBanner | null
  /** Dancers get an input; spectators only watch. */
  isDancer: boolean
  typed: string
  submitting: boolean
  /** Feedback on the last attempt, e.g. after a typo. */
  notice: string | null
  onTypedChange: (value: string) => void
  onSubmit: () => void
}

const bannerTones: Record<WordRaceBannerKind, string> = {
  won: 'border-emerald-500/70 bg-emerald-950/90 text-emerald-200',
  lost: 'border-rose-500/70 bg-rose-950/90 text-rose-200',
  late: 'border-rose-500/70 bg-rose-950/90 text-rose-200',
  watching: 'border-slate-600 bg-slate-900/90 text-slate-100',
  expired: 'border-slate-600 bg-slate-900/90 text-slate-300',
}

/** Card shown over the dance stage: the word to race for, then who won it. */
export function WordRaceOverlayView({
  round,
  result,
  isDancer,
  typed,
  submitting,
  notice,
  onTypedChange,
  onSubmit,
}: WordRaceOverlayViewProps) {
  if (!round && !result) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      {round && <div aria-hidden className="absolute inset-0 rounded-xl bg-slate-950/40" />}
      {round ? (
        <RoundCard
          round={round}
          isDancer={isDancer}
          typed={typed}
          submitting={submitting}
          notice={notice}
          onTypedChange={onTypedChange}
          onSubmit={onSubmit}
        />
      ) : (
        result && (
          <p
            role="status"
            data-kind={result.kind}
            className={`pointer-events-auto relative max-w-md rounded-xl border px-6 py-4 text-center text-lg font-semibold shadow-xl ${bannerTones[result.kind]}`}
          >
            {result.text}
          </p>
        )
      )}
    </div>
  )
}

interface RoundCardProps {
  round: WordRoundView
  isDancer: boolean
  typed: string
  submitting: boolean
  notice: string | null
  onTypedChange: (value: string) => void
  onSubmit: () => void
}

function RoundCard({ round, isDancer, typed, submitting, notice, onTypedChange, onSubmit }: RoundCardProps) {
  const timeUp = round.remainingMs === 0
  const seconds = Math.ceil(round.remainingMs / 1000)
  const progress = round.totalMs > 0 ? Math.min(100, (round.remainingMs / round.totalMs) * 100) : 0
  const urgent = round.remainingMs <= 3000
  const canType = isDancer && !timeUp && !submitting

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canType && typed.trim().length > 0) onSubmit()
  }

  return (
    <section
      aria-label="Word race"
      className="pointer-events-auto relative flex w-full max-w-md flex-col gap-4 rounded-xl border border-fuchsia-800/70 bg-slate-900/90 p-5 shadow-xl"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Word race · Round {round.roundNumber} / {round.totalRounds}
        </h2>
        <span
          role="timer"
          aria-label="Time left"
          className={`font-mono text-xl font-bold tabular-nums ${urgent ? 'text-rose-400' : 'text-slate-100'}`}
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

      <p data-testid="word-race-word" className="select-none text-center font-mono text-5xl font-bold tracking-widest text-white">
        {round.word}
      </p>

      {isDancer ? (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            // Remounted every round, so focus lands here the moment the word appears.
            autoFocus
            aria-label="Type the word"
            value={typed}
            onChange={(event) => onTypedChange(event.target.value)}
            // Light anti-cheat only: the server is the real authority on who typed it first.
            onPaste={(event) => event.preventDefault()}
            disabled={timeUp}
            // Read-only rather than disabled while the verdict is pending, so the
            // keyboard focus stays here for a quick retry after a typo.
            readOnly={submitting}
            aria-busy={submitting}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={timeUp ? "Time's up" : 'Type it and press Enter'}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-lg text-slate-100 placeholder:text-slate-600 focus:border-brand-red focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canType || typed.trim().length === 0}
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="text-center text-sm text-slate-400">Dancers are racing to type it...</p>
      )}

      {notice && (
        <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-2 text-sm text-rose-300">
          {notice}
        </p>
      )}
    </section>
  )
}
