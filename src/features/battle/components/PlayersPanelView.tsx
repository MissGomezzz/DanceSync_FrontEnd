import type { Player, PlayerRole } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'

interface PlayersPanelViewProps {
  players: Player[]
  hostId: string | null
  myId: string | null
}

const roleLabels: Record<PlayerRole, string> = {
  dancer: 'dancer',
  spectator: 'spectator',
  undecided: 'no role',
}

/** Everyone in the room during the battle, with their role, the host and a "you" marker. */
export function PlayersPanelView({ players, hostId, myId }: PlayersPanelViewProps) {
  return (
    <section
      aria-labelledby="players-heading"
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <h2 id="players-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Players ({players.length})
      </h2>
      <ul className="flex flex-col gap-1.5" aria-label="Players in the room">
        {players.map((player) => (
          <li key={player.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-slate-100">
              {player.displayName}
              {player.id === myId && <span className="ml-1 text-xs font-semibold text-emerald-300">(you)</span>}
            </span>
            <span className="flex shrink-0 gap-1.5">
              {player.id === hostId && <Badge tone="success">host</Badge>}
              <Badge tone={player.role === 'dancer' ? 'accent' : 'neutral'}>{roleLabels[player.role]}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
