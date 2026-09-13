import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useRoom, useRoomError, useRoomStore } from '../../rooms/store/roomStore'
import { BattleStageView } from './BattleStageView'

interface BattleStageProps {
  roomCode: string
}

export function BattleStage({ roomCode }: BattleStageProps) {
  const navigate = useNavigate()
  const room = useRoom()
  const error = useRoomError()
  const joinRoom = useRoomStore((state) => state.joinRoom)
  const leaveRoom = useRoomStore((state) => state.leaveRoom)

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
    navigate('/')
  }

  const inRoom = room?.code === roomCode

  return (
    <BattleStageView
      roomCode={roomCode}
      room={inRoom ? room : null}
      error={error}
      onLeave={() => void handleLeave()}
    />
  )
}
