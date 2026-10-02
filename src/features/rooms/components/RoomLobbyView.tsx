import type { Player } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { PlayerCard } from '../../../shared/ui/molecules/PlayerCard'

interface RoomLobbyViewProps {
  roomCode: string
  players: Player[]
  dancers: Player[]
  spectators: Player[]
  hostId: string | null
  maxPlayers: number
  isHost: boolean
  canStart: boolean
  /** battle:start was sent and the server has not answered yet. */
  startingBattle?: boolean
  startHint: string | null
  error: string | null
  onStartBattle: () => void
  onLeave: () => void
}

export function RoomLobbyView({
  roomCode,
  players,
  dancers,
  spectators,
  hostId,
  maxPlayers,
  isHost,
  canStart,
  startingBattle = false,
  startHint,
  error,
  onStartBattle,
  onLeave,
}: RoomLobbyViewProps) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Room {roomCode}</h1>
          <p className="text-sm text-slate-400">
            {players.length} / {maxPlayers} players
          </p>
        </div>
        <Badge tone="accent">Lobby</Badge>
      </header>

      {error && <p className="rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</p>}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Players</h2>
        {players.length === 0 && <p className="text-sm text-slate-500">Joining room...</p>}
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} isHost={player.id === hostId} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Dancers</h2>
          {dancers.length === 0 && (
            <p className="text-sm text-slate-500">No dancers yet. Players who choose "Dance" compete in the battle.</p>
          )}
          {dancers.map((player) => (
            <PlayerCard key={player.id} player={player} isHost={player.id === hostId} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Spectators</h2>
          {spectators.length === 0 && <p className="text-sm text-slate-500">No spectators yet.</p>}
          {spectators.map((player) => (
            <PlayerCard key={player.id} player={player} isHost={player.id === hostId} />
          ))}
        </div>
      </div>

      <footer className="flex items-center justify-end gap-3">
        {startHint && <p className="text-sm text-slate-500">{startHint}</p>}
        <Button variant="ghost" onClick={onLeave}>
          Leave room
        </Button>
        {isHost && (
          <Button onClick={onStartBattle} disabled={!canStart}>
            {startingBattle ? 'Starting...' : 'Start battle'}
          </Button>
        )}
      </footer>
    </section>
  )
}
