import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useConnectionStatus } from '../../../shared/lib/connectionStatus'
import { ConnectionBanner } from '../../../shared/ui/molecules/ConnectionBanner'
import { useAuthStore } from '../../auth/store/authStore'
import { SongSelectionPanel } from '../../songSelection/components/SongSelectionPanel'
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  useRoom,
  useRoomError,
  useRoomJoinError,
  useRoomStore,
} from '../store/roomStore'
import { RoleSelector } from './RoleSelector'
import { RoomUnavailableView } from './RoomUnavailableView'
import { RoomLobbyView } from './RoomLobbyView'

interface RoomLobbyProps {
  roomCode: string
}

export function RoomLobby({ roomCode }: RoomLobbyProps) {
  const navigate = useNavigate()
  const room = useRoom()
  const error = useRoomError()
  const joinError = useRoomJoinError()
  const joinRoom = useRoomStore((state) => state.joinRoom)
  const leaveRoom = useRoomStore((state) => state.leaveRoom)
  const startBattle = useRoomStore((state) => state.startBattle)
  const selectRole = useRoomStore((state) => state.selectRole)
  const myId = useAuthStore((state) => state.identity?.id)
  const connection = useConnectionStatus()

  const [joining, setJoining] = useState(true)
  const [rolePending, setRolePending] = useState(false)
  // Bumped by "Try again" to rerun the join effect.
  const [joinAttempt, setJoinAttempt] = useState(0)

  useEffect(() => {
    setJoining(true)
    void joinRoom(roomCode).finally(() => setJoining(false))
  }, [roomCode, joinRoom, joinAttempt])

  useEffect(() => {
    if (room?.code === roomCode && room.status !== 'waiting') {
      // Replace: Back from the battle must not land on a lobby that bounces forward again.
      navigate(`/battle/${roomCode}`, { replace: true })
    }
  }, [room, roomCode, navigate])

  const handleLeave = () => {
    // Best effort: leaveRoom clears the local room at once, so a failed or slow
    // server answer never keeps the player on this page.
    void leaveRoom()
    navigate('/home', { replace: true })
  }

  const handleSelectRole = async (role: 'dancer' | 'spectator') => {
    if (rolePending) return
    setRolePending(true)
    try {
      await selectRole(role)
    } finally {
      setRolePending(false)
    }
  }

  const inRoom = room?.code === roomCode

  if (!joining && !inRoom && joinError) {
    return (
      <RoomUnavailableView
        roomCode={roomCode}
        reason={joinError}
        onBack={() => navigate('/home')}
        onRetry={() => setJoinAttempt((n) => n + 1)}
      />
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
      <ConnectionBanner status={connection} />
      {inRoom && (
        <RoleSelector
          myRole={me?.role}
          pending={rolePending}
          onSelectDancer={() => void handleSelectRole('dancer')}
          onSelectSpectator={() => void handleSelectRole('spectator')}
        />
      )}
      {inRoom && <SongSelectionPanel room={room} />}
      <RoomLobbyView
        roomCode={roomCode}
        players={players}
        // room.dancers is only filled when the battle starts; in the lobby the
        // roles each player chose are the source of truth.
        dancers={players.filter((p) => p.role === 'dancer')}
        spectators={players.filter((p) => p.role === 'spectator')}
        hostId={inRoom ? room.hostId : null}
        maxPlayers={MAX_PLAYERS}
        isHost={isHost}
        canStart={canStart}
        startHint={startHint}
        error={inRoom ? error : null}
        onStartBattle={() => void startBattle()}
        onLeave={handleLeave}
      />
    </div>
  )
}