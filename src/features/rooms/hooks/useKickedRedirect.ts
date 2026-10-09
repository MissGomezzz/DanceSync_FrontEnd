import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useKickedFrom, useRoomStore } from '../store/roomStore'

/**
 * Sends the player home (replacing the room page in history) once the host
 * removed them from `roomCode`; the home page then shows the notice.
 */
export function useKickedRedirect(roomCode: string): void {
  const navigate = useNavigate()
  const kickedFrom = useKickedFrom()

  useEffect(() => {
    if (kickedFrom !== roomCode.toUpperCase()) return
    useRoomStore.getState().acknowledgeKick()
    navigate('/home', { replace: true })
  }, [kickedFrom, roomCode, navigate])
}
