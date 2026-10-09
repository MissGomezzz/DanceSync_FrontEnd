import { liveStandings } from '../../../shared/lib/standings'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoom } from '../../rooms/store/roomStore'
import { useScoreAnnouncement, useScoreChanges } from '../store/scoreboardStore'
import { LiveScoreboardView } from './LiveScoreboardView'

/**
 * Live ranking for dancers and spectators. The changes come from the scoreboard
 * store, fed by useScoreboardSync (mounted by the battle stage).
 */
export function LiveScoreboard() {
  const room = useRoom()
  const myId = useAuthStore((state) => state.identity?.id ?? null)
  const changes = useScoreChanges()
  const announcement = useScoreAnnouncement()

  if (!room?.battle) return null

  return (
    <LiveScoreboardView
      standings={liveStandings(room)}
      changes={changes}
      announcement={announcement}
      myId={myId}
    />
  )
}
