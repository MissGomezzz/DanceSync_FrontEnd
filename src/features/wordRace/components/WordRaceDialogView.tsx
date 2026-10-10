import { useEffect, useId, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { WordRaceBanner, WordRaceBannerKind } from '../types'
import { TimeBar, TimeLeft, type WordRoundView } from './RoundTimer'

interface WordRaceDialogViewProps {
  /** Round to type, or null while only the round result is shown. */
  round: WordRoundView | null
  result: WordRaceBanner | null
  typed: string
  submitting: boolean
  /** Feedback on the last attempt, e.g. after a typo. */
  notice: string | null
  onTypedChange: (value: string) => void
  onSubmit: () => void
}

/** Card accent of each round result: green when I won it, rose when someone else did. */
const resultTones: Record<WordRaceBannerKind, string> = {
  won: 'border-emerald-400/70 shadow-emerald-500/20',
  lost: 'border-rose-500/70 shadow-rose-500/20',
  late: 'border-rose-500/70 shadow-rose-500/20',
  watching: 'border-slate-600',
  expired: 'border-slate-600',
}

const resultTextTones: Record<WordRaceBannerKind, string> = {
  won: 'text-emerald-300',
  lost: 'text-rose-300',
  late: 'text-rose-300',
  watching: 'text-slate-100',
  expired: 'text-slate-200',
}

/**
 * Full-screen word race layer for the dancers: the page stays visible but
 * dimmed behind it, so their attention goes to the word. Rendered in a portal
 * on document.body, above the tiles, their tags and the sidebars.
 */
export function WordRaceDialogView({
  round,
  result,
  typed,
  submitting,
  notice,
  onTypedChange,
  onSubmit,
}: WordRaceDialogViewProps) {
  const labelId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const hasRound = round !== null

  // Runs before the input takes the focus (a passive effect), so it remembers
  // what had it when the layer opened and gives it back when the layer closes.
  useLayoutEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    return () => {
      const current = document.activeElement
      // Only when the focus is still ours: another dialog may have taken it meanwhile.
      const focusIsOurs = current === null || current === document.body || (dialog?.contains(current) ?? false)
      if (focusIsOurs && previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  // The result has no input: keep the focus inside the dialog until it closes.
  useEffect(() => {
    if (!hasRound) dialogRef.current?.focus()
  }, [hasRound])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The round is time-boxed, so Escape does not close it.
    if (event.key === 'Escape') event.preventDefault()
    if (event.key === 'Tab') keepFocusInside(event, dialogRef.current)
  }

  if (!round && !result) return null
  const showResult = !round && result !== null

  return createPortal(
    <div className="fixed inset-0 z-(--layer-overlay) flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex w-full max-w-2xl flex-col gap-6 rounded-3xl border-2 bg-slate-900/95 p-6 shadow-2xl outline-none sm:p-10 motion-safe:animate-overlay-in motion-reduce:animate-fade-in ${
          showResult ? resultTones[result.kind] : 'border-fuchsia-500/60 shadow-fuchsia-500/20'
        }`}
      >
        {round && (
          <RoundPanel
            key={round.roundId}
            round={round}
            labelId={labelId}
            typed={typed}
            submitting={submitting}
            notice={notice}
            onTypedChange={onTypedChange}
            onSubmit={onSubmit}
          />
        )}
        {showResult && (
          <h2 id={labelId} className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Round over
          </h2>
        )}
        {/* Always mounted, so screen readers announce the result the moment it arrives. */}
        <div role="status" aria-live="polite" data-kind={showResult ? result.kind : undefined}>
          {showResult && (
            <p className={`text-center text-3xl font-extrabold sm:text-4xl motion-safe:animate-overlay-in motion-reduce:animate-fade-in ${resultTextTones[result.kind]}`}>
              {result.text}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface RoundPanelProps {
  round: WordRoundView
  labelId: string
  typed: string
  submitting: boolean
  notice: string | null
  onTypedChange: (value: string) => void
  onSubmit: () => void
}

/** The word, the time left and the input; remounted every round. */
function RoundPanel({ round, labelId, typed, submitting, notice, onTypedChange, onSubmit }: RoundPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const timeUp = round.remainingMs === 0
  const canType = !timeUp && !submitting

  // Focus lands on the input the moment the word appears.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canType && typed.trim().length > 0) onSubmit()
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <header className="flex items-center justify-between gap-4">
        <h2 id={labelId} className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
          Word {round.roundNumber} of {round.totalRounds}
        </h2>
        <TimeLeft remainingMs={round.remainingMs} className="text-2xl" />
      </header>

      <TimeBar remainingMs={round.remainingMs} totalMs={round.totalMs} className="h-2 rounded-full" />

      <p
        data-testid="word-race-word"
        className="select-none break-all text-center font-mono text-6xl font-black tracking-wide text-white [text-shadow:0_4px_24px_rgb(217_70_239/0.45)] sm:text-7xl lg:text-8xl"
      >
        {round.word}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
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
          className="min-w-0 flex-1 rounded-xl border-2 border-slate-700 bg-slate-950 px-4 py-3 text-center font-mono text-2xl text-slate-100 placeholder:text-base placeholder:text-slate-600 focus:border-fuchsia-500 focus:outline-none disabled:opacity-50 sm:text-left"
        />
        <button
          type="submit"
          disabled={!canType || typed.trim().length === 0}
          className="rounded-xl bg-brand-red px-6 py-3 text-base font-semibold text-white hover:bg-brand-red-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Checking...' : 'Send'}
        </button>
      </form>

      {notice ? (
        <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/60 px-4 py-2 text-center text-base font-medium text-rose-200">
          {notice}
        </p>
      ) : (
        <p className="text-center text-sm text-slate-400">Be the first dancer to type it.</p>
      )}
    </div>
  )
}

/** Tab and Shift+Tab cycle through the dialog's controls instead of leaving it. */
function keepFocusInside(event: KeyboardEvent<HTMLElement>, dialog: HTMLElement | null): void {
  if (!dialog) return
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])'))
  if (controls.length === 0) {
    event.preventDefault()
    return
  }
  const first = controls[0]
  const last = controls[controls.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
