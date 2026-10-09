import { useEffect } from 'react'
import { bindScoreboardSync } from '../lib/scoreboardSync'

/** Tracks the score changes of `roomCode` while the battle page is mounted. */
export function useScoreboardSync(roomCode: string): void {
  useEffect(() => bindScoreboardSync(roomCode), [roomCode])
}
