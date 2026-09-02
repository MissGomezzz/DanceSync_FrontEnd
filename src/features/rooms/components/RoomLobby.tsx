import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { MAX_DANCERS, MAX_PLAYERS, selectDancers, selectSpectators, useRoomStore } from '../store/roomStore'
import { RoomLobbyView } from './RoomLobbyView'

interface RoomLobbyProps {
  roomId: string
}

export function RoomLobby({ roomId }: RoomLobbyProps) {
  const navigate = useNavigate()
  const setRoom = useRoomStore((state) => state.setRoom)
  const leaveRoom = useRoomStore((state) => state.leaveRoom)
  const dancers = useRoomStore(selectDancers)
  const spectators = useRoomStore(selectSpectators)

  useEffect(() => {
    // The room membership will be synchronized with the backend later.
    setRoom(roomId)
  }, [roomId, setRoom])

  const handleStartBattle = () => {
    navigate(`/battle/${roomId}`)
  }

  const handleLeave = () => {
    leaveRoom()
    navigate('/')
  }

  return (
    <RoomLobbyView
      roomId={roomId}
      dancers={dancers}
      spectators={spectators}
      maxPlayers={MAX_PLAYERS}
      canStart={dancers.length === MAX_DANCERS}
      onStartBattle={handleStartBattle}
      onLeave={handleLeave}
    />
  )
}
