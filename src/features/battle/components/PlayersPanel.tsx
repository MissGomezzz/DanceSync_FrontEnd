import { useAuthStore } from '../../auth/store/authStore'
import { useRoom } from '../../rooms/store/roomStore'
import { PlayersPanelView } from './PlayersPanelView'

export function PlayersPanel() {
  const room = useRoom()
  const myId = useAuthStore((state) => state.identity?.id ?? null)
  if (!room) return null
  return <PlayersPanelView players={room.players} hostId={room.hostId} myId={myId} />
}
