interface SongTimeRemainingViewProps {
  /** Time until the server ends the battle at the end of the song. */
  remainingMs: number
  /** Length of the song clip; null when unknown, which leaves the label without a bar. */
  totalMs: number | null
}

/** The last seconds of the song turn the clock red. */
const URGENT_MS = 10_000

/** "1:05" for 65 000 ms; a started second counts as a whole one, like the other timers. */
function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

/**
 * Slim clock under the song video: a bar that empties and "1:23 left". Dancers
 * and spectators both see it, so nobody has to guess how long the battle lasts.
 */
export function SongTimeRemainingView({ remainingMs, totalMs }: SongTimeRemainingViewProps) {
  const urgent = remainingMs <= URGENT_MS
  // During the start countdown the battle ends later than one song length from now.
  const shownMs = totalMs === null ? remainingMs : Math.min(remainingMs, totalMs)

  return (
    <div className="flex items-center justify-end gap-3 px-1">
      {totalMs !== null && totalMs > 0 && (
        <div aria-hidden className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
          <div
            data-testid="song-time-bar"
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${urgent ? 'bg-rose-500' : 'bg-linear-to-r from-primary to-secondary'}`}
            style={{ width: `${(shownMs / totalMs) * 100}%` }}
          />
        </div>
      )}
      <p
        role="timer"
        className={`shrink-0 text-sm font-semibold tabular-nums ${urgent ? 'text-rose-700' : 'text-ink-muted'}`}
      >
        {remainingMs > 0 ? (
          <>
            <span className="sr-only">Song time: </span>
            {formatClock(shownMs)} left
          </>
        ) : (
          'Song ending…'
        )}
      </p>
    </div>
  )
}
