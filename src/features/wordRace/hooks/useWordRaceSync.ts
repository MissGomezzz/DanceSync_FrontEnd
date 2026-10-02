import { useEffect } from 'react'
import { bindWordRaceSync } from '../lib/wordRaceSync'

/** Listens to the word race of `roomCode` while the battle page is mounted. */
export function useWordRaceSync(roomCode: string): void {
  useEffect(() => bindWordRaceSync(roomCode), [roomCode])
}
