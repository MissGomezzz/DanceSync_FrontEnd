import { Navigate, useParams } from 'react-router'
import { useRoom } from '../../rooms/store/roomStore'
import { ChatPanel } from '../../chat/components/ChatPanel'
import { RatingPanel } from '../../rating/components/RatingPanel'
import { BattleStage } from '../components/BattleStage'

export function BattlePage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const room = useRoom()

  if (!roomCode) {
    return <Navigate to="/home" replace />
  }

  const code = roomCode.toUpperCase()
  const showRating = room?.code === code && room.status === 'battling'

  return (
    <main className="grid min-h-screen gap-6 p-6 lg:grid-cols-[1fr_20rem]">
      <BattleStage roomCode={code} />
      <aside className="flex flex-col gap-6">
        <ChatPanel roomCode={code} />
        {showRating && <RatingPanel />}
      </aside>
    </main>
  )
}
