import { Navigate, useParams } from 'react-router'
import { ChatPanel } from '../../chat/components/ChatPanel'
import { RatingPanel } from '../../rating/components/RatingPanel'
import { BattleStage } from '../components/BattleStage'
import { useBattleStore } from '../store/battleStore'

export function BattlePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const status = useBattleStore((state) => state.status)

  if (!roomId) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="grid min-h-screen gap-6 p-6 lg:grid-cols-[1fr_20rem]">
      <BattleStage roomId={roomId} />
      <aside className="flex flex-col gap-6">
        <ChatPanel roomId={roomId} />
        {status === 'finished' && <RatingPanel />}
      </aside>
    </main>
  )
}
