import type { ReactNode } from 'react'
import type { Player } from '../../types'
import { Badge } from '../atoms/Badge'

interface PlayerCardProps {
  player: Player
  isHost?: boolean
  /** Extra controls at the end of the card, e.g. the host's "Remove" button. */
  actions?: ReactNode
}

export function PlayerCard({ player, isHost = false, actions = null }: PlayerCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
      <span className="font-medium text-ink">{player.displayName}</span>
      <div className="flex items-center gap-2">
        {isHost && <Badge tone="sun">Host</Badge>}
        <Badge tone={player.ready ? 'success' : 'neutral'}>{player.ready ? 'Ready' : 'Not ready'}</Badge>
        <Badge tone={player.role === 'dancer' ? 'accent' : 'teal'}>{player.role}</Badge>
        {actions}
      </div>
    </div>
  )
}
