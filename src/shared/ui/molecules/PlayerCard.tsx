import type { Player } from '../../types'
import { Badge } from '../atoms/Badge'

interface PlayerCardProps {
  player: Player
  isHost?: boolean
}

export function PlayerCard({ player, isHost = false }: PlayerCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
      <span className="font-medium text-slate-100">{player.displayName}</span>
      <div className="flex items-center gap-2">
        {isHost && <Badge tone="success">Host</Badge>}
        <Badge tone={player.role === 'dancer' ? 'accent' : 'neutral'}>{player.role}</Badge>
      </div>
    </div>
  )
}
