import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../../auth/store/authStore'
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  useRoom,
  useRoomError,
  useRoomStore,
} from '../store/roomStore'
import { RoomLobbyView } from './RoomLobbyView'

interface RoomLobbyProps {
  roomCode: string
}

export function RoomLobby({ roomCode }: RoomLobbyProps) {
  const navigate = useNavigate()
  const room = useRoom()
  const error = useRoomError()
  const joinRoom = useRoomStore((state) => state.joinRoom)
  const leaveRoom = useRoomStore((state) => state.leaveRoom)
  const startBattle = useRoomStore((state) => state.startBattle)
  const myId = useAuthStore((state) => state.identity?.id)

  useEffect(() => {
    // Idempotent on the server, so refreshing the page simply rejoins.
    void joinRoom(roomCode)
  }, [roomCode, joinRoom])

  useEffect(() => {
    if (room?.code === roomCode && room.status !== 'waiting') {
      navigate(`/battle/${roomCode}`)
    }
  }, [room, roomCode, navigate])

  const handleLeave = async () => {
    await leaveRoom()
    navigate('/')
  }

  const inRoom = room?.code === roomCode
  const players = inRoom ? room.players : []
  const isHost = inRoom && myId !== undefined && room.hostId === myId
  const canStart = isHost && players.length >= MIN_PLAYERS_TO_START
  const startHint = isHost && players.length < MIN_PLAYERS_TO_START
    ? `At least ${MIN_PLAYERS_TO_START} players are needed to start.`
    : null

  return (
    <RoomLobbyView
      roomCode={roomCode}
      players={players}
      dancers={inRoom ? (room.dancers ?? []) : []}
      spectators={inRoom ? room.spectators : []}
      hostId={inRoom ? room.hostId : null}
      maxPlayers={MAX_PLAYERS}
      isHost={isHost}
      canStart={canStart}
      startHint={startHint}
      error={error}
      onStartBattle={() => void startBattle()}
      onLeave={() => void handleLeave()}
    />
  )
}
