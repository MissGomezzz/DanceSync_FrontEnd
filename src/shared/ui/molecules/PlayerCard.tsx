import type { ReactNode } from 'react'
import type { Player, PlayerRole } from '../../types'
import { Badge } from '../atoms/Badge'

interface PlayerCardProps {
  player: Player
  isHost?: boolean
  /** Extra controls at the end of the card, e.g. the host's "Remove" button. */
  actions?: ReactNode
}

const roleLabels: Record<PlayerRole, string> = {
  dancer: 'Dancer',
  spectator: 'Spectator',
  undecided: 'Choosing role',
}

const roleTones: Record<PlayerRole, 'accent' | 'teal' | 'neutral'> = {
  dancer: 'accent',
  spectator: 'teal',
  undecided: 'neutral',
}

/**
 * The name keeps one line and truncates; when the badges and the actions do not
 * fit beside it (a phone), they wrap under the name instead of overflowing.
 */
export function PlayerCard({ player, isHost = false, actions = null }: PlayerCardProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
      <span className="min-w-0 flex-1 basis-24 truncate font-medium text-ink" title={player.displayName}>
        {player.displayName}
      </span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isHost && <Badge tone="sun">Host</Badge>}
        <Badge tone={player.ready ? 'success' : 'neutral'}>{player.ready ? 'Ready' : 'Not ready'}</Badge>
        <Badge tone={roleTones[player.role]}>{roleLabels[player.role]}</Badge>
        {actions}
      </div>
    </div>
  )
}
