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
  const dancers = room?.dancers ?? null
  const result = room?.battle?.result ?? null

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
                    {(room?.battle?.bonusPoints?.[dancer.id] ?? 0) > 0 && (
                      <Badge tone="success">
                        +{room?.battle?.bonusPoints?.[dancer.id]} bonus
                      </Badge>
                    )}
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
        <ResultPanel dancers={dancers} result={result} bonusPoints={room.battle?.bonusPoints ?? {}} />
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

interface ResultPanelProps {
  dancers: Player[] | null
  result: { scores: Record<string, number>; winnerId: string | null } | null
  /** Word race bonus already included in each total, shown as a breakdown. */
  bonusPoints: Record<string, number>
}

function ResultPanel({ dancers, result, bonusPoints }: ResultPanelProps) {
  if (!result || !dancers) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
        The battle ended without a rating result.
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
            <span className="font-semibold">
              {result.scores[dancer.id] ?? 0}
              {(bonusPoints[dancer.id] ?? 0) > 0 && (
                <span className="ml-2 text-xs font-normal text-emerald-300">(incl. +{bonusPoints[dancer.id]} bonus)</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold text-emerald-300">
        {winner ? `Winner: ${winner.displayName}` : 'It is a tie!'}
      </p>
    </div>
  )
}
