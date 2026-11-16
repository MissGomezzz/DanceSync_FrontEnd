import { useState, type ReactNode } from 'react'
import type { Player } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { PlayerCard } from '../../../shared/ui/molecules/PlayerCard'
import { LeaveRoomButton } from './LeaveRoomButton'

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
  /** Why the battle is not starting yet, for the host and for everyone else; null when there is nothing to say. */
  startHint: string | null
  error: string | null
  /** The player's own controls (role, ready, song), shown right under the room title. */
  controls?: ReactNode
  onStartBattle: () => void
  onLeave: () => void
  /** Host only: removes a player after an inline confirmation; absent for everyone else. */
  onKick?: (playerId: string) => void
  /** Player whose removal is waiting for the server; every "Remove" is disabled meanwhile. */
  kickingPlayerId?: string | null
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
  controls = null,
  onStartBattle,
  onLeave,
  onKick,
  kickingPlayerId = null,
}: RoomLobbyViewProps) {
  const undecided = players.filter((player) => player.role === 'undecided')

  const renderPlayer = (player: Player) => (
    <li key={player.id}>
      <PlayerCard
        player={player}
        isHost={player.id === hostId}
        actions={
          isHost && onKick && player.id !== hostId ? (
            <KickControl
              playerName={player.displayName}
              pending={kickingPlayerId !== null}
              onConfirm={() => onKick(player.id)}
            />
          ) : null
        }
      />
    </li>
  )

  return (
    <section className="flex w-full flex-col gap-4 sm:gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-ink">Room {roomCode}</h1>
          <p className="text-sm text-ink-muted">
            {players.length} / {maxPlayers} players
          </p>
        </div>
        <Badge tone="accent">Lobby</Badge>
      </header>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

      {controls}

      {/* Every player appears once, under the role they chose. */}
      {players.length === 0 ? (
        <p className="text-sm text-ink-soft">Joining room...</p>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-6">
          {undecided.length > 0 && (
            <PlayerGroup title="Choosing role" count={undecided.length}>
              {undecided.map(renderPlayer)}
            </PlayerGroup>
          )}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <PlayerGroup
              title="Dancers"
              count={dancers.length}
              empty={'No dancers yet. Players who choose "Dance" compete in the battle.'}
            >
              {dancers.map(renderPlayer)}
            </PlayerGroup>
            <PlayerGroup title="Spectators" count={spectators.length} empty="No spectators yet.">
              {spectators.map(renderPlayer)}
            </PlayerGroup>
          </div>
        </div>
      )}

      {/* Stacked on phones, so the hint gets the full width instead of a sliver beside the buttons. */}
      <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {startHint && (
          <p role="status" className="text-sm text-ink-muted sm:mr-auto">
            {startHint}
          </p>
        )}
        <div className="flex shrink-0 justify-end gap-3">
          <LeaveRoomButton onLeave={onLeave} />
          {isHost && (
            <Button onClick={onStartBattle} disabled={!canStart}>
              {startingBattle ? 'Starting...' : 'Start battle'}
            </Button>
          )}
        </div>
      </footer>
    </section>
  )
}

interface PlayerGroupProps {
  title: string
  count: number
  /** Shown instead of the list while the group has nobody. */
  empty?: string
  children: ReactNode
}

/** One role of the lobby: its heading with the head count, then the players. */
function PlayerGroup({ title, count, empty, children }: PlayerGroupProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        {title} ({count})
      </h2>
      {count === 0 ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={title}>
          {children}
        </ul>
      )}
    </div>
  )
}

interface KickControlProps {
  playerName: string
  pending: boolean
  onConfirm: () => void
}

const smallButton = 'px-2 py-1 text-xs'

/** "Remove", then an inline "Confirm" / "Cancel", so a misclick never removes anyone. */
function KickControl({ playerName, pending, onConfirm }: KickControlProps) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        className={smallButton}
        // The name starts with the visible label, so voice control still matches "Remove".
        aria-label={`Remove ${playerName}`}
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        Remove
      </Button>
    )
  }
  return (
    <span className="flex items-center gap-1">
      <Button
        className={smallButton}
        aria-label={pending ? `Removing ${playerName}` : `Confirm removing ${playerName}`}
        disabled={pending}
        onClick={onConfirm}
      >
        {pending ? 'Removing...' : 'Confirm'}
      </Button>
      <Button variant="ghost" className={smallButton} disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  )
}
