import { socket } from '../../../shared/lib/socket'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { useWordRaceStore, type WordRaceViewer } from '../store/wordRaceStore'
import type { WordRoundEndedEvent, WordRoundStartedEvent } from '../types'

function currentViewer(): WordRaceViewer {
  const myId = useAuthStore.getState().identity?.id ?? null
  const dancerIds = useRoomStore.getState().room?.battle?.dancerIds ?? []
  return { myId, isDancer: myId !== null && dancerIds.includes(myId) }
}

/**
 * Feeds the word race events of `roomCode` into the store and ignores any other
 * room. Returns the unbind function (which also resets the store), so binding it
 * from an effect stays correct under StrictMode double mounts.
 */
export function bindWordRaceSync(roomCode: string): () => void {
  const onStarted = (event: WordRoundStartedEvent) => {
    if (event.roomCode !== roomCode) return
    useWordRaceStore.getState().roundStarted(event)
  }
  const onEnded = (event: WordRoundEndedEvent) => {
    if (event.roomCode !== roomCode) return
    useWordRaceStore.getState().roundEnded(event, currentViewer())
  }
  socket.on('word:round-started', onStarted)
  socket.on('word:round-ended', onEnded)
  return () => {
    socket.off('word:round-started', onStarted)
    socket.off('word:round-ended', onEnded)
    useWordRaceStore.getState().reset()
  }
}
