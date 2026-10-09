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
import { ReadyButton } from './ReadyButton'
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
  const startSongChallenge = useRoomStore((state) => state.startSongChallenge)
  const selectRole = useRoomStore((state) => state.selectRole)
  const setReady = useRoomStore((state) => state.setReady)
  const setError = useRoomStore((state) => state.setError)
  const myId = useAuthStore((state) => state.identity?.id)
  const connection = useConnectionStatus()

  const [rolePending, setRolePending] = useState(false)
  const [readyPending, setReadyPending] = useState(false)
  const [startingBattle, setStartingBattle] = useState(false)

  // An error left by another page must not show up in this lobby.
  useEffect(() => setError(null), [roomCode, setError])
  // Bumped by "Try again" to rerun the join effect.
  const [joinAttempt, setJoinAttempt] = useState(0)
  // The join (room code + attempt) that last settled; any other one is still in flight.
  const joinKey = `${roomCode}#${joinAttempt}`
  const [settledJoinKey, setSettledJoinKey] = useState<string | null>(null)
  const joining = settledJoinKey !== joinKey

  useEffect(() => {
    void joinRoom(roomCode).finally(() => setSettledJoinKey(joinKey))
  }, [roomCode, joinRoom, joinKey])

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

  const handleToggleReady = async () => {
    if (readyPending) return
    setReadyPending(true)
    try {
      await setReady(!me?.ready)
    } finally {
      setReadyPending(false)
    }
  }

  const handleStartBattle = async () => {
    if (startingBattle) return
    setStartingBattle(true)
    try {
      // Starting a battle begins with the song challenge; the server starts the battle
      // itself once the song is chosen. With a song already chosen (the battle could not
      // start when it was picked) only the battle is left to start.
      if (room?.selectedSong) await startBattle()
      else await startSongChallenge()
    } finally {
      setStartingBattle(false)
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
  const waitingFor = players.filter((p) => !p.ready)
  const canStart = isHost && dancerCount >= MIN_PLAYERS_TO_START && !choosingSong && waitingFor.length === 0
  const startHint = !isHost
    ? null
    : dancerCount < MIN_PLAYERS_TO_START
      ? `At least ${MIN_PLAYERS_TO_START} players must choose "Dance" to start.`
      : choosingSong
        ? 'Wait until the song has been chosen.'
        : waitingFor.length > 0
          ? `Waiting for ${waitingFor.map((p) => p.displayName).join(', ')} to be ready.`
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
      {inRoom && <ReadyButton ready={me?.ready === true} pending={readyPending} onToggle={() => void handleToggleReady()} />}
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
        canStart={canStart && !startingBattle}
        startingBattle={startingBattle}
        startHint={startHint}
        error={inRoom ? error : null}
        onStartBattle={() => void handleStartBattle()}
        onLeave={handleLeave}
      />
    </div>
  )
}