import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useConnectionStatus } from '../../../shared/lib/connectionStatus'
import { ConnectionBanner } from '../../../shared/ui/molecules/ConnectionBanner'
import { CameraPermissionPrompt } from '../../camera/components/CameraPermissionPrompt'
import { useBattleVideo } from '../../camera/hooks/useBattleVideo'
import { RoomUnavailableView } from '../../rooms/components/RoomUnavailableView'
import { useRoom, useRoomError, useRoomJoinError, useRoomStore } from '../../rooms/store/roomStore'
import { WordRaceOverlay } from '../../wordRace/components/WordRaceOverlay'
import { useWordRaceSync } from '../../wordRace/hooks/useWordRaceSync'
import { useWordRaceWins } from '../../wordRace/store/wordRaceStore'
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
  const { dancerVideos, needsCameraPrompt } = useBattleVideo(roomCode)
  const wordWins = useWordRaceWins()
  const connection = useConnectionStatus()
  // Bound before the (re)join below, so a word already on screen is not missed.
  useWordRaceSync(roomCode)

  useEffect(() => {
    // Idempotent rejoin keeps the page working after a refresh mid-battle.
    void joinRoom(roomCode)
  }, [roomCode, joinRoom])

  useEffect(() => {
    if (room?.code === roomCode && room.status === 'waiting') {
      navigate(`/rooms/${roomCode}`)
    }
  }, [room, roomCode, navigate])

  const handleLeave = () => {
    // Best effort, see RoomLobby: never wait for the server to leave the page.
    void leaveRoom()
    navigate('/home', { replace: true })
  }

  const inRoom = room?.code === roomCode
  if (!inRoom && joinError) {
    return <RoomUnavailableView roomCode={roomCode} reason={joinError} onBack={() => navigate('/home')} />
  }

  return (
    <BattleStageView
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
