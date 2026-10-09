import { liveStandings } from '../../../shared/lib/standings'
import type { Room } from '../../../shared/types'
import { useRoomStore } from '../../rooms/store/roomStore'
import { useScoreboardStore } from '../store/scoreboardStore'

function apply(room: Room | null, roomCode: string): void {
  if (room?.code.toUpperCase() !== roomCode.toUpperCase() || !room.battle) return
  useScoreboardStore.getState().applyStandings(room.battle.id, liveStandings(room))
}

/**
 * Diffs the standings of every room payload of `roomCode` (in the store, so the
 * view never derives state in an effect). Returns the unbind function, which
 * also resets the store, so binding it from an effect is StrictMode-safe.
 */
export function bindScoreboardSync(roomCode: string): () => void {
  apply(useRoomStore.getState().room, roomCode)
  const unsubscribe = useRoomStore.subscribe((state, previous) => {
    if (state.room !== previous.room) apply(state.room, roomCode)
  })
  return () => {
    unsubscribe()
    useScoreboardStore.getState().reset()
  }
}
