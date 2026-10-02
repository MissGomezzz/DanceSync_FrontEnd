import type { ReactNode } from 'react'
import type { Player, Room, RoomStatus } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'
import { VideoTile } from '../../camera/components/VideoTile'
import type { DancerVideo } from '../../camera/hooks/useBattleVideo'

interface BattleStageViewProps {
  roomCode: string
  room: Room | null
  error: string | null
  /** Notice shown while the real-time connection is down; renders nothing when connected. */
  connectionBanner?: ReactNode
  /** One camera tile per dancer; empty before the battle starts. */
  dancerVideos: DancerVideo[]
  /** Shown in the local dancer's tile until the camera is on; null otherwise. */
  cameraPrompt: ReactNode
  /** Word race overlay drawn on top of the dancer tiles. */
  wordRace: ReactNode
  /** Word race rounds won per dancer id; a dancer without an entry shows no tally. */
  wordWins: Record<string, number>
  onLeave: () => void
}

const statusLabels: Record<RoomStatus, string> = {
  waiting: 'Waiting to start',
  battling: 'Battle in progress',
  finished: 'Battle finished',
}

export function BattleStageView({
  roomCode,
  room,
  error,
  connectionBanner = null,
  dancerVideos,
  cameraPrompt,
  wordRace,
  wordWins,
  onLeave,
}: BattleStageViewProps) {
  const dancers = room?.dancers ?? null
  const result = room?.battle?.result ?? null

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battle in room {roomCode}</h1>
        {room && (
          <Badge tone={room.status === 'battling' ? 'success' : 'accent'}>{statusLabels[room.status]}</Badge>
        )}
      </header>

      {room?.battle?.song && (
        <p className="text-sm text-slate-400">
          Song: <span className="font-semibold text-slate-100">{room.battle.song.title}</span> by {room.battle.song.artist}
        </p>
      )}

      {connectionBanner}

      {error && <p className="rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</p>}

      <div className="relative grid gap-4 sm:grid-cols-2">
        {wordRace}
        {dancerVideos.length > 0 ? (
          dancerVideos.map(({ dancer, isMe, stream, placeholder }) => (
            <VideoTile
              key={dancer.id}
              label={dancer.displayName}
              stream={stream}
              mirrored={isMe}
              placeholder={placeholder}
              badges={
                <>
                  {isMe && <Badge tone="success">you</Badge>}
                  {wordWins[dancer.id] !== undefined && (
                    <Badge>
                      {wordWins[dancer.id]} {wordWins[dancer.id] === 1 ? 'word' : 'words'}
                    </Badge>
                  )}
                  <Badge tone="accent">dancer</Badge>
                </>
              }
              overlay={isMe ? cameraPrompt : null}
            />
          ))
        ) : (
          <p className="text-sm text-slate-500 sm:col-span-2">Waiting for the battle to start.</p>
        )}
      </div>

      {room?.status === 'finished' && <ResultPanel dancers={dancers} result={result} />}

      <footer className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onLeave}>
          Leave room
        </Button>
      </footer>
    </section>
  )
}

interface ResultPanelProps {
  dancers: Player[] | null
  result: { scores: Record<string, number>; winnerId: string | null } | null
}

function ResultPanel({ dancers, result }: ResultPanelProps) {
  if (!result || !dancers) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
        The battle ended early, so there is no result.
      </div>
    )
  }

  const winner = result.winnerId ? dancers.find((d) => d.id === result.winnerId) : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Result</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {dancers.map((dancer) => (
          <div key={dancer.id} className="flex justify-between rounded-lg bg-slate-900 px-4 py-3">
            <span>{dancer.displayName}</span>
            <span className="font-semibold">{result.scores[dancer.id] ?? 0}</span>
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold text-emerald-300">
        {winner ? `Winner: ${winner.displayName}` : 'It is a tie!'}
      </p>
    </div>
  )
}
