import type { Player } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { PlayerCard } from '../../../shared/ui/molecules/PlayerCard'

interface RoomLobbyViewProps {
  roomId: string
  dancers: Player[]
  spectators: Player[]
  maxPlayers: number
  canStart: boolean
  onStartBattle: () => void
  onLeave: () => void
}

export function RoomLobbyView({
  roomId,
  dancers,
  spectators,
  maxPlayers,
  canStart,
  onStartBattle,
  onLeave,
}: RoomLobbyViewProps) {
  const totalPlayers = dancers.length + spectators.length

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Room {roomId}</h1>
          <p className="text-sm text-slate-400">
            {totalPlayers} / {maxPlayers} players
          </p>
        </div>
        <Badge tone="accent">Lobby</Badge>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Dancers</h2>
          {dancers.length === 0 && <p className="text-sm text-slate-500">Waiting for dancers.</p>}
          {dancers.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Spectators</h2>
          {spectators.length === 0 && <p className="text-sm text-slate-500">No spectators yet.</p>}
          {spectators.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </div>

      <footer className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onLeave}>
          Leave room
        </Button>
        <Button onClick={onStartBattle} disabled={!canStart}>
          Start battle
        </Button>
      </footer>
    </section>
  )
}
