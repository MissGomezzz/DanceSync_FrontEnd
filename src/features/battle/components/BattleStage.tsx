import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { CameraPermissionPrompt } from '../../camera/components/CameraPermissionPrompt'
import { useBattleVideo } from '../../camera/hooks/useBattleVideo'
import { RoomUnavailableView } from '../../rooms/components/RoomUnavailableView'
import { useRoom, useRoomError, useRoomJoinError, useRoomStore } from '../../rooms/store/roomStore'
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

  useEffect(() => {
    // Idempotent rejoin keeps the page working after a refresh mid-battle.
    void joinRoom(roomCode)
  }, [roomCode, joinRoom])

  useEffect(() => {
    if (room?.code === roomCode && room.status === 'waiting') {
      navigate(`/rooms/${roomCode}`)
    }
  }, [room, roomCode, navigate])

  const handleLeave = async () => {
    await leaveRoom()
    navigate('/home')
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
      dancerVideos={dancerVideos}
      cameraPrompt={needsCameraPrompt ? <CameraPermissionPrompt /> : null}
      onLeave={() => void handleLeave()}
    />
  )
}
