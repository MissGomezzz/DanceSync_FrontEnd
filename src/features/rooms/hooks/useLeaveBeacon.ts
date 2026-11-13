import { useEffect } from 'react'
import { getAccessToken } from '../../../shared/lib/authSession'
import { useAuthStore } from '../../auth/store/authStore'
import { bindLeaveBeacon } from '../lib/leaveBeacon'
import { useRoomStore } from '../store/roomStore'

/** How often the token the beacon will carry is renewed while the player is in a room. */
const TOKEN_REFRESH_MS = 5 * 60_000

/**
 * While the player is in a room, closing the tab frees the seat right away
 * through navigator.sendBeacon (POST /api/rooms/{code}/leave). The beacon
 * carries the session's access token, which cannot be fetched while the page
 * is closing, so it is kept fresh here.
 */
export function useLeaveBeacon(): void {
  const roomCode = useRoomStore((state) => state.room?.code ?? null)
  const playerId = useAuthStore((state) => state.identity?.id ?? null)

  useEffect(() => {
    if (!roomCode || !playerId) return
    void getAccessToken()
    const refresh = setInterval(() => void getAccessToken(), TOKEN_REFRESH_MS)
    const unbind = bindLeaveBeacon(roomCode, () => useRoomStore.getState().room?.code === roomCode)
    return () => {
      clearInterval(refresh)
      unbind()
    }
  }, [roomCode, playerId])
}
