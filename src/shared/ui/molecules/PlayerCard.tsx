import type { Player } from '../../types'
import { Badge } from '../atoms/Badge'

interface PlayerCardProps {
  player: Player
}

export function PlayerCard({ player }: PlayerCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
      <span className="font-medium text-slate-100">{player.displayName}</span>
      <Badge tone={player.role === 'dancer' ? 'accent' : 'neutral'}>{player.role}</Badge>
    </div>
  )
}
