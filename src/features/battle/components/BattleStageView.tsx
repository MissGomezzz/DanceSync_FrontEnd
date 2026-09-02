import type { BattleScore, BattleStatus } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'

interface BattleStageViewProps {
  roomId: string
  status: BattleStatus
  scores: BattleScore[]
  onStart: () => void
  onFinish: () => void
  onBackToLobby: () => void
}

const statusLabels: Record<BattleStatus, string> = {
  idle: 'Waiting to start',
  countdown: 'Get ready',
  dancing: 'Dancing',
  finished: 'Battle finished',
}

export function BattleStageView({ roomId, status, scores, onStart, onFinish, onBackToLobby }: BattleStageViewProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battle in room {roomId}</h1>
        <Badge tone={status === 'dancing' ? 'success' : 'accent'}>{statusLabels[status]}</Badge>
      </header>

      <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-slate-500">
        Dance stage placeholder
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {scores.length === 0 && <p className="text-sm text-slate-500">No scores yet.</p>}
        {scores.map((score) => (
          <div key={score.playerId} className="flex justify-between rounded-lg bg-slate-900 px-4 py-3">
            <span>{score.playerId}</span>
            <span className="font-semibold">{score.points}</span>
          </div>
        ))}
      </div>

      <footer className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onBackToLobby}>
          Back to lobby
        </Button>
        {status === 'idle' && <Button onClick={onStart}>Start</Button>}
        {status === 'dancing' && (
          <Button variant="secondary" onClick={onFinish}>
            Finish
          </Button>
        )}
      </footer>
    </section>
  )
}
