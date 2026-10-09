import { Navigate, useParams } from 'react-router'
import { useRoom } from '../../rooms/store/roomStore'
import { ChatPanel } from '../../chat/components/ChatPanel'
import { LiveScoreboard } from '../../scoreboard/components/LiveScoreboard'
import { VotePanel } from '../../voting/components/VotePanel'
import { BattleStage } from '../components/BattleStage'

export function BattlePage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const room = useRoom()

  if (!roomCode) {
    return <Navigate to="/home" replace />
  }

  const code = roomCode.toUpperCase()
  const inBattle = room?.code === code && room.battle !== null && room.status !== 'waiting'

  return (
    <main className="grid min-h-screen gap-6 p-6 lg:grid-cols-[1fr_20rem]">
      <BattleStage roomCode={code} />
      <aside className="flex flex-col gap-6">
        {inBattle && room.status === 'battling' && <LiveScoreboard />}
        {inBattle && <VotePanel />}
        <ChatPanel roomCode={code} />
      </aside>
    </main>
  )
}
