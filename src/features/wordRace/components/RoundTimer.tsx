/** What the word race views need to know about the round on screen. */
export interface WordRoundView {
  roundId: string
  word: string
  roundNumber: number
  totalRounds: number
  remainingMs: number
  totalMs: number
}

/** The last seconds of a round turn the timer red. */
const URGENT_MS = 3000

interface TimerProps {
  remainingMs: number
  className?: string
}

/** Whole seconds left in the round, e.g. "7s". */
export function TimeLeft({ remainingMs, className = '' }: TimerProps) {
  const urgent = remainingMs <= URGENT_MS
  return (
    <span
      role="timer"
      aria-label="Time left"
      className={`font-mono font-bold tabular-nums ${urgent ? 'text-rose-600' : 'text-ink'} ${className}`}
    >
      {Math.ceil(remainingMs / 1000)}s
    </span>
  )
}

interface TimeBarProps extends TimerProps {
  totalMs: number
}

/** Bar that empties as the round runs out. */
export function TimeBar({ remainingMs, totalMs, className = '' }: TimeBarProps) {
  const urgent = remainingMs <= URGENT_MS
  const progress = totalMs > 0 ? Math.min(100, (remainingMs / totalMs) * 100) : 0
  return (
    <div aria-hidden className={`w-full overflow-hidden bg-surface-muted ${className}`}>
      <div
        className={`h-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-rose-500' : 'bg-linear-to-r from-primary to-secondary'}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
