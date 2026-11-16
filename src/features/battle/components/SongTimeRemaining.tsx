import { useCountdown, useServerDeadline } from '../../../shared/hooks/useCountdown'
import type { Battle } from '../../../shared/types'
import { SongTimeRemainingView } from './SongTimeRemainingView'

interface SongTimeRemainingProps {
  /** The battle of this room while it is running; null otherwise, which shows nothing. */
  battle: Battle | null
}

/**
 * How long the song (and so the battle) still lasts, for everyone in the room.
 * Driven by the server's `endsInMs`, anchored on the local monotonic clock when
 * each room payload arrives: the browser's wall clock is never compared with a
 * server date. Shows nothing on servers that do not send the deadline.
 */
export function SongTimeRemaining({ battle }: SongTimeRemainingProps) {
  const deadline = useServerDeadline(battle?.endsInMs ?? null, battle)
  const remainingMs = useCountdown(deadline)

  if (!battle || deadline === null) return null

  return (
    <SongTimeRemainingView
      remainingMs={remainingMs}
      // The song's duration is the length of the battle clip.
      totalMs={battle.song ? battle.song.durationSeconds * 1000 : null}
    />
  )
}
