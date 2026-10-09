import type { ReactNode } from 'react'
import type { Room, RoomStatus } from '../../../shared/types'
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
  /**
   * Word race rounds won per dancer id (the same count the ranking scores); a
   * dancer without an entry shows no tally.
   */
  wordWins: Record<string, number>
  onLeave: () => void
  songVideo?: ReactNode
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
  songVideo,
}: BattleStageViewProps) {
  return (
    <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 p-3 sm:p-4">
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

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        {/* Music video */}
        <div className="min-w-0">
          {songVideo ? (
            <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-black">
              {songVideo}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-4 text-center text-sm text-slate-400">
              {songPlaceholder(room)}
            </div>
          )}
        </div>

        {/* Dancer cameras */}
        <div className="relative grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
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
                        {wordWins[dancer.id]}{" "}
                        {wordWins[dancer.id] === 1 ? "word" : "words"}
                      </Badge>
                    )}
                    <Badge tone="accent">dancer</Badge>
                  </>
                }
                overlay={isMe ? cameraPrompt : null}
              />
            ))
          ) : (
            <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-1">
              Waiting for the battle to start.
            </p>
          )}
        </div>
      </div>

      {room?.status === 'finished' && (
        <ResultPanel room={room} />
      )}

      <footer className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onLeave}>
          Leave room
        </Button>
      </footer>
    </section>
  )
}

/** What the song area says when there is no video to play. */
function songPlaceholder(room: Room | null): string {
  if (room?.status === 'finished') return 'The battle is over.'
  if (room?.status === 'battling' && room.battle?.song && !room.battle.song.youtubeId) return 'This song has no video.'
  return 'The music video will appear when the battle starts.'
}

/** Shown for a dancer who left and is in no list that still carries their name. */
const FORMER_DANCER = 'Former dancer'

interface ResultRow {
  id: string
  name: string
  score: number
  bonus: number
}

/**
 * One row per scored dancer. Scores come from the result itself, so a dancer
 * who left after the battle (even the winner) is still listed; names come from
 * the roster snapshot taken at the battle start, then from the room.
 */
function resultRows(room: Room, scores: Record<string, number>): { rows: ResultRow[]; nameOf: (id: string) => string } {
  const names = new Map<string, string>()
  const roster = room.battle?.roster ?? []
  // Later sources win: the roster is the most reliable one.
  for (const player of room.players) names.set(player.id, player.displayName)
  for (const dancer of room.dancers ?? []) names.set(dancer.id, dancer.displayName)
  for (const dancer of roster) names.set(dancer.id, dancer.displayName)
  const nameOf = (id: string) => names.get(id) ?? FORMER_DANCER

  const ids = new Set([
    ...roster.map((dancer) => dancer.id).filter((id) => id in scores),
    ...(room.dancers ?? []).map((dancer) => dancer.id),
    ...Object.keys(scores),
  ])
  const bonusPoints = room.battle?.bonusPoints ?? {}
  const rows = [...ids].map((id) => ({ id, name: nameOf(id), score: scores[id] ?? 0, bonus: bonusPoints[id] ?? 0 }))
  return { rows, nameOf }
}

function ResultPanel({ room }: { room: Room }) {
  const result = room.battle?.result ?? null
  if (!result) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
        The battle ended without a rating result.
      </div>
    )
  }

  const { rows, nameOf } = resultRows(room, result.scores ?? {})

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Result</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id} className="flex justify-between rounded-lg bg-slate-900 px-4 py-3">
            <span>{row.name}</span>
            <span className="font-semibold">
              {row.score}
              {row.bonus > 0 && <span className="ml-2 text-xs font-normal text-emerald-300">(incl. +{row.bonus} bonus)</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold text-emerald-300">
        {result.winnerId ? `Winner: ${nameOf(result.winnerId)}` : 'It is a tie!'}
      </p>
    </div>
  )
}
