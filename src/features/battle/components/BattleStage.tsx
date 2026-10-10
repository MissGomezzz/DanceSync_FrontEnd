import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useServerTime } from '../../../shared/hooks/useCountdown'
import { useConnectionStatus } from '../../../shared/lib/connectionStatus'
import { wordTally, wordsWonOf } from '../../../shared/lib/standings'
import { Button } from '../../../shared/ui/atoms/Button'
import { ConnectionBanner } from '../../../shared/ui/molecules/ConnectionBanner'
import { useAuthStore } from '../../auth/store/authStore'
import { CameraPermissionPrompt } from '../../camera/components/CameraPermissionPrompt'
import { useBattleVideo } from '../../camera/hooks/useBattleVideo'
import { RoomUnavailableView } from '../../rooms/components/RoomUnavailableView'
import { LeaveRoomButton } from '../../rooms/components/LeaveRoomButton'
import { useKickedRedirect } from '../../rooms/hooks/useKickedRedirect'
import { EndAnnouncement } from '../../results/components/EndAnnouncement'
import { MatchResults } from '../../results/components/MatchResults'
import { useScoreboardSync } from '../../scoreboard/hooks/useScoreboardSync'
import { useRoom, useRoomError, useRoomJoinError, useRoomStore } from '../../rooms/store/roomStore'
import { WordRaceOverlay } from '../../wordRace/components/WordRaceOverlay'
import { useWordRaceSync } from '../../wordRace/hooks/useWordRaceSync'
import { useWordRaceWins } from '../../wordRace/store/wordRaceStore'
import { SongPlayer, YOUTUBE_API_UNAVAILABLE } from '../../songSelection/components/SongPlayer'
import { BattleStageView } from './BattleStageView'
import { StartCountdown } from './StartCountdown'

interface BattleStageProps {
  roomCode: string
}

export function BattleStage({ roomCode }: BattleStageProps) {
  const navigate = useNavigate()
  const room = useRoom()
  const error = useRoomError()
  const joinError = useRoomJoinError()
  const joinRoom = useRoomStore((state) => state.joinRoom)
  const leaveRoom = useRoomStore((state) => state.leaveRoom)
  const setError = useRoomStore((state) => state.setError)
  const rematch = useRoomStore((state) => state.rematch)
  const [rematching, setRematching] = useState(false)
  const myId = useAuthStore((state) => state.identity?.id ?? null)
  const { dancerVideos, needsCameraPrompt } = useBattleVideo(roomCode)
  const wordWins = useWordRaceWins()
  const connection = useConnectionStatus()
  // Bound before the (re)join below, so a word already on screen is not missed.
  useWordRaceSync(roomCode)
  useScoreboardSync(roomCode)
  useKickedRedirect(roomCode)

  // An error left by the lobby (for example a failed song pick) must not show up here.
  useEffect(() => setError(null), [roomCode, setError])

  useEffect(() => {
    // Idempotent rejoin keeps the page working after a refresh mid-battle.
    void joinRoom(roomCode)
  }, [roomCode, joinRoom])

  useEffect(() => {
    // Back in the lobby: a rematch (or a room that was reset while away).
    if (room?.code === roomCode && room.status === 'waiting') {
      navigate(`/rooms/${roomCode}`, { replace: true })
    }
  }, [room, roomCode, navigate])

  const handleLeave = () => {
    // Best effort, see RoomLobby: never wait for the server to leave the page.
    void leaveRoom()
    navigate('/home', { replace: true })
  }

  const handleRematch = async () => {
    // One request at a time: a double click must not send two rematches.
    if (rematching) return
    setRematching(true)
    try {
      // On success the room comes back "waiting" and the effect above opens the lobby.
      await rematch()
    } finally {
      setRematching(false)
    }
  }

  const inRoom = room?.code === roomCode
  const battle = inRoom ? room.battle : null
  // Anchored on the local monotonic clock when each room payload arrives, so the
  // song starts in sync even when this device's wall clock is off.
  const songStartAt = useServerTime(battle?.startsInMs, battle, battle?.startedAt ?? null)

  if (!inRoom && joinError) {
    return <RoomUnavailableView roomCode={roomCode} reason={joinError} onBack={() => navigate('/home')} />
  }
  const song = battle?.song ?? null
  const songVideo =
    inRoom && room.status === 'battling' && song?.youtubeId ? (
      <SongPlayer
        videoId={song.youtubeId}
        startAt={songStartAt}
        // The song's duration is the length of the battle clip.
        durationSeconds={song.durationSeconds}
        onError={(code) => setError(songErrorMessage(code))}
      />
    ) : null

  const results =
    inRoom && room.status === 'finished' ? (
      <MatchResults
        room={room}
        myId={myId}
        actions={
          <>
            {room.hostId === myId ? (
              <Button onClick={() => void handleRematch()} disabled={rematching}>
                {rematching ? 'Starting rematch...' : 'Rematch'}
              </Button>
            ) : (
              <p className="self-center text-sm text-slate-500">The host can start a rematch.</p>
            )}
            <LeaveRoomButton onLeave={handleLeave} />
          </>
        }
      />
    ) : null

  return (
    <>
      <BattleStageView
        songVideo={songVideo}
        roomCode={roomCode}
        room={inRoom ? room : null}
        error={error}
        connectionBanner={<ConnectionBanner status={connection} />}
        dancerVideos={dancerVideos}
        cameraPrompt={needsCameraPrompt ? <CameraPermissionPrompt /> : null}
        wordRace={<WordRaceOverlay />}
        wordWins={wordTally(wordsWonOf(battle), wordWins)}
        onLeave={handleLeave}
        results={results}
      />
      {/* Same start instant as the song player, so "Dance!" lands on the first beat. */}
      <StartCountdown battle={inRoom && room.status === 'battling' ? battle : null} startAt={songStartAt} />
      <EndAnnouncement room={inRoom ? room : null} />
    </>
  )
}

function songErrorMessage(code: number): string {
  if (code === 101 || code === 150) return 'This song video cannot be embedded.'
  if (code === YOUTUBE_API_UNAVAILABLE) return 'The song video could not be loaded. Check your connection.'
  return 'The song video could not be loaded.'
}
