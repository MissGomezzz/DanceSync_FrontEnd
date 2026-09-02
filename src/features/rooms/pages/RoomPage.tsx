import { Navigate, useParams } from 'react-router'
import { RoomLobby } from '../components/RoomLobby'

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()

  if (!roomId) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="min-h-screen">
      <RoomLobby roomId={roomId} />
    </main>
  )
}
