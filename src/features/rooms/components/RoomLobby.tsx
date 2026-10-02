import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../../auth/store/authStore'
import { SongSelectionPanel } from '../../songSelection/components/SongSelectionPanel'
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  useRoom,
  useRoomError,
  useRoomStore,
} from '../store/roomStore'
import { RoleSelector } from './RoleSelector'
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
  const selectRole = useRoomStore((state) => state.selectRole)
  const myId = useAuthStore((state) => state.identity?.id)

  const [joining, setJoining] = useState(true)

  useEffect(() => {
    setJoining(true)
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
  const me = players.find((p) => p.id === myId)
  const dancerCount = players.filter((p) => p.role === 'dancer').length
  const isHost = inRoom && myId !== undefined && room.hostId === myId
  const songPhase = inRoom ? room.songSelection?.phase : undefined
  const choosingSong = songPhase === 'typing' || songPhase === 'choosing'
  const canStart = isHost && dancerCount >= MIN_PLAYERS_TO_START && !choosingSong
  const startHint = !isHost
    ? null
    : dancerCount < MIN_PLAYERS_TO_START
      ? `At least ${MIN_PLAYERS_TO_START} players must choose "Dance" to start.`
      : choosingSong
        ? 'Wait until the song has been chosen.'
        : null

  return (
    <div className="flex flex-col gap-6 p-6">
      {inRoom && (
        <RoleSelector
          myRole={me?.role}
          onSelectDancer={() => void selectRole('dancer')}
          onSelectSpectator={() => void selectRole('spectator')}
        />
      )}
      {inRoom && <SongSelectionPanel room={room} />}
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
        error={inRoom ? error : null}
        onStartBattle={() => void startBattle()}
        onLeave={() => void handleLeave()}
      />
    </div>
  )
}