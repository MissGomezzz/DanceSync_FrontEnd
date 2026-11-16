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
 *
 * The name takes (nearly) all the spare width, so on one row the badges sit at
 * the right edge; once wrapped, the badges row is alone on its line, grows to
 * the full width and pushes the actions to its right end.
 */
export function PlayerCard({ player, isHost = false, actions = null }: PlayerCardProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
      <span className="min-w-0 grow-[999] basis-24 truncate font-medium text-ink" title={player.displayName}>
        {player.displayName}
      </span>
      <div className="flex grow flex-wrap items-center gap-2">
        {isHost && <Badge tone="sun">Host</Badge>}
        <Badge tone={player.ready ? 'success' : 'neutral'}>{player.ready ? 'Ready' : 'Not ready'}</Badge>
        <Badge tone={roleTones[player.role]}>{roleLabels[player.role]}</Badge>
        {actions && <span className="ml-auto flex items-center">{actions}</span>}
      </div>
    </div>
  )
}
