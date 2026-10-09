import type { ReactNode } from 'react'
import { resultStandings } from '../../../shared/lib/standings'
import type { Room } from '../../../shared/types'
import { useMatchResults } from '../hooks/useMatchResults'
import { endReasonText } from '../lib/endReason'
import { ResultsDashboardView } from './ResultsDashboardView'

interface MatchResultsProps {
  /** A finished room. */
  room: Room
  myId: string | null
  actions?: ReactNode
}

/**
 * Final results dashboard. Built from the room payload (`battle.result`); a
 * client without standings in memory falls back to the stored match
 * (`GET /api/matches/{battleId}`), so a refresh still shows the results.
 */
export function MatchResults({ room, myId, actions }: MatchResultsProps) {
  const battle = room.battle
  const fromRoom = resultStandings(battle?.result, room)
  const fallbackId = fromRoom === null && battle ? battle.id : null
  const stored = useMatchResults(fallbackId)

  const standings = fromRoom ?? stored.results?.standings ?? null
  const winnerId = fromRoom ? (battle?.result?.winnerId ?? null) : (stored.results?.winnerId ?? null)
  const endReason = battle?.endReason ?? stored.results?.endReason ?? null

  return (
    <ResultsDashboardView
      standings={standings}
      winnerId={winnerId}
      endReason={endReasonText(endReason)}
      loading={stored.loading}
      failed={stored.failed}
      myId={myId}
      actions={actions}
    />
  )
}
