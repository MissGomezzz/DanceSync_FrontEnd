import { Navigate, useParams } from 'react-router'
import { RoomLobby } from '../components/RoomLobby'

export function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>()

  if (!roomCode) {
    return <Navigate to="/home" replace />
  }

  return (
    <main className="min-h-screen">
      <RoomLobby roomCode={roomCode.toUpperCase()} />
    </main>
  )
}
