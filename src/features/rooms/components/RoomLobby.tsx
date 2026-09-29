import { useEffect, useState } from 'react'
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

  const [joining, setJoining] = useState(true)

  useEffect(() => {
    setJoining(true)
    // Idempotent on the server, so refreshing the page simply rejoins.
    void joinRoom(roomCode).finally(() => setJoining(false))
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

  // Distinct "not found" screen: no room, not loading, and a real error came back.
  if (!joining && !inRoom && error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-rose-400">{error}</p>
        <p className="text-sm text-slate-500">Room code "{roomCode}" doesn't exist or is no longer open.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-light"
        >
          Back to home
        </button>
      </main>
    )
  }

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
      error={null}
      onStartBattle={() => void startBattle()}
      onLeave={() => void handleLeave()}
    />
  )
}