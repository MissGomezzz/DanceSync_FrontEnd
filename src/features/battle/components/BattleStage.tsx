import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useServerTime } from '../../../shared/hooks/useCountdown'
import { useConnectionStatus } from '../../../shared/lib/connectionStatus'
import { ConnectionBanner } from '../../../shared/ui/molecules/ConnectionBanner'
import { CameraPermissionPrompt } from '../../camera/components/CameraPermissionPrompt'
import { useBattleVideo } from '../../camera/hooks/useBattleVideo'
import { RoomUnavailableView } from '../../rooms/components/RoomUnavailableView'
import { useKickedRedirect } from '../../rooms/hooks/useKickedRedirect'
import { useRoom, useRoomError, useRoomJoinError, useRoomStore } from '../../rooms/store/roomStore'
import { WordRaceOverlay } from '../../wordRace/components/WordRaceOverlay'
import { useWordRaceSync } from '../../wordRace/hooks/useWordRaceSync'
import { useWordRaceWins } from '../../wordRace/store/wordRaceStore'
import { SongPlayer, YOUTUBE_API_UNAVAILABLE } from '../../songSelection/components/SongPlayer'
import { BattleStageView } from './BattleStageView'

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
  const { dancerVideos, needsCameraPrompt } = useBattleVideo(roomCode)
  const wordWins = useWordRaceWins()
  const connection = useConnectionStatus()
  // Bound before the (re)join below, so a word already on screen is not missed.
  useWordRaceSync(roomCode)
  useKickedRedirect(roomCode)

  // An error left by the lobby (for example a failed song pick) must not show up here.
  useEffect(() => setError(null), [roomCode, setError])

  useEffect(() => {
    // Idempotent rejoin keeps the page working after a refresh mid-battle.
    void joinRoom(roomCode)
  }, [roomCode, joinRoom])

  useEffect(() => {
    if (room?.code === roomCode && room.status === 'waiting') {
      navigate(`/rooms/${roomCode}`, { replace: true })
    }
  }, [room, roomCode, navigate])

  const handleLeave = () => {
    // Best effort, see RoomLobby: never wait for the server to leave the page.
    void leaveRoom()
    navigate('/home', { replace: true })
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

  return (
    <BattleStageView
      songVideo={songVideo}
      roomCode={roomCode}
      room={inRoom ? room : null}
      error={error}
      connectionBanner={<ConnectionBanner status={connection} />}
      dancerVideos={dancerVideos}
      cameraPrompt={needsCameraPrompt ? <CameraPermissionPrompt /> : null}
      wordRace={<WordRaceOverlay />}
      wordWins={wordWins}
      onLeave={handleLeave}
    />
  )
}

function songErrorMessage(code: number): string {
  if (code === 101 || code === 150) return 'This song video cannot be embedded.'
  if (code === YOUTUBE_API_UNAVAILABLE) return 'The song video could not be loaded. Check your connection.'
  return 'The song video could not be loaded.'
}
