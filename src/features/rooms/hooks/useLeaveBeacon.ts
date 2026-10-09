import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { bindLeaveBeacon } from '../lib/leaveBeacon'
import { useRoomStore } from '../store/roomStore'

/**
 * While the player is in a room, closing the tab frees the seat right away
 * through navigator.sendBeacon (POST /api/rooms/{code}/leave).
 */
export function useLeaveBeacon(): void {
  const roomCode = useRoomStore((state) => state.room?.code ?? null)
  const playerId = useAuthStore((state) => state.identity?.id ?? null)

  useEffect(() => {
    if (!roomCode || !playerId) return
    return bindLeaveBeacon(roomCode, playerId, () => useRoomStore.getState().room?.code === roomCode)
  }, [roomCode, playerId])
}
