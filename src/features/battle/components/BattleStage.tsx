import { useNavigate } from 'react-router'
import { useBattleStore } from '../store/battleStore'
import { BattleStageView } from './BattleStageView'

interface BattleStageProps {
  roomId: string
}

export function BattleStage({ roomId }: BattleStageProps) {
  const navigate = useNavigate()
  const status = useBattleStore((state) => state.status)
  const scores = useBattleStore((state) => state.scores)
  const setStatus = useBattleStore((state) => state.setStatus)
  const reset = useBattleStore((state) => state.reset)

  const handleStart = () => {
    // Real-time synchronization through Socket.IO will drive these transitions later.
    setStatus('dancing')
  }

  const handleFinish = () => {
    setStatus('finished')
  }

  const handleBackToLobby = () => {
    reset()
    navigate(`/rooms/${roomId}`)
  }

  return (
    <BattleStageView
      roomId={roomId}
      status={status}
      scores={scores}
      onStart={handleStart}
      onFinish={handleFinish}
      onBackToLobby={handleBackToLobby}
    />
  )
}
