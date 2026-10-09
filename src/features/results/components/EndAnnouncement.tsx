import { useEffect, useState } from 'react'
import { nameResolver } from '../../../shared/lib/standings'
import type { Room } from '../../../shared/types'
import { endReasonText } from '../lib/endReason'
import { EndAnnouncementView } from './EndAnnouncementView'

/** How long the "Battle over!" overlay stays before the results dashboard shows. */
export const ANNOUNCEMENT_VISIBLE_MS = 3000

/**
 * Announces the end of the battle for ANNOUNCEMENT_VISIBLE_MS, or until the
 * player dismisses it. Each battle is announced once per page.
 */
export function EndAnnouncement({ room }: { room: Room | null }) {
  const battle = room?.status === 'finished' ? room.battle : null
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const visible = battle !== null && battle.id !== dismissedId
  const battleId = battle?.id ?? null

  useEffect(() => {
    if (!visible || battleId === null) return
    const timer = setTimeout(() => setDismissedId(battleId), ANNOUNCEMENT_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [visible, battleId])

  if (!visible || !room || !battle) return null

  return (
    <EndAnnouncementView
      outcome={outcomeText(room)}
      endReason={endReasonText(battle.endReason)}
      onDismiss={() => setDismissedId(battle.id)}
    />
  )
}

function outcomeText(room: Room): string | null {
  const result = room.battle?.result ?? null
  if (!result) return null
  // A null winner with a result means the top of the ranking is tied.
  return result.winnerId ? `${nameResolver(room)(result.winnerId)} wins!` : "It's a draw"
}
