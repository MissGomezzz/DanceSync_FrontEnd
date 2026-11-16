import type { ReactNode } from 'react'
import type { Room, RoomStatus } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { VideoTile } from '../../camera/components/VideoTile'
import type { DancerVideo } from '../../camera/hooks/useBattleVideo'
import { LeaveRoomButton } from '../../rooms/components/LeaveRoomButton'

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
  /**
   * Word race: a full-screen layer for dancers (portalled to the body) or a
   * banner pinned to the top of the stage for spectators.
   */
  wordRace: ReactNode
  /**
   * Word race rounds won per dancer id (the same count the ranking scores); a
   * dancer without an entry shows no tally.
   */
  wordWins: Record<string, number>
  onLeave: () => void
  songVideo?: ReactNode
  /** Slim "time left" clock right under the song video, for dancers and spectators alike. */
  songTime?: ReactNode
  /**
   * Panels shown right after the song video and before the camera tiles (the
   * vote and the live ranking on a phone); null where the page has a sidebar for them.
   */
  songPanels?: ReactNode
  /** Final results dashboard once the battle finished (it carries its own leave button); null before. */
  results?: ReactNode
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
  songTime = null,
  songPanels = null,
  results = null,
}: BattleStageViewProps) {
  return (
    // No padding of its own: the page already keeps the gutter (12 px on phones).
    <section className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Battle in room {roomCode}</h1>
        {room && (
          <Badge tone={room.status === 'battling' ? 'success' : 'accent'}>{statusLabels[room.status]}</Badge>
        )}
      </header>

      {room?.battle?.song && (
        <p className="text-sm text-ink-muted">
          Song: <span className="font-semibold text-ink">{room.battle.song.title}</span> by {room.battle.song.artist}
        </p>
      )}

      {connectionBanner}

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

      {results}

      {wordRace}

      {/*
        Side by side only from xl: between lg and xl the sidebar already takes
        20rem, and a second split there left the song video too small.
      */}
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        {/* Music video, with the song clock under it */}
        <div className="flex min-w-0 flex-col gap-2">
          {songVideo ? (
            <div className="w-full overflow-hidden rounded-2xl bg-black shadow-soft">
              {songVideo}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl bg-black p-4 text-center text-sm text-white/80 shadow-soft">
              {songPlaceholder(room)}
            </div>
          )}
          {songTime}
        </div>

        {songPanels && <div className="flex min-w-0 flex-col gap-3">{songPanels}</div>}

        {/* Dancer cameras */}
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:content-start">
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
            <p className="text-sm text-ink-soft sm:col-span-2 xl:col-span-1">
              Waiting for the battle to start.
            </p>
          )}
        </div>
      </div>

      {!results && (
        <footer className="flex justify-end gap-3">
          <LeaveRoomButton onLeave={onLeave} />
        </footer>
      )}
    </section>
  )
}

/** What the song area says when there is no video to play. */
function songPlaceholder(room: Room | null): string {
  if (room?.status === 'finished') return 'The battle is over.'
  if (room?.status === 'battling' && room.battle?.song && !room.battle.song.youtubeId) return 'This song has no video.'
  return 'The music video will appear when the battle starts.'
}
