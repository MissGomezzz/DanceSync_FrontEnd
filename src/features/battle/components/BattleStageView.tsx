import type { Player, Room, RoomStatus } from '../../../shared/types'
import { Badge } from '../../../shared/ui/atoms/Badge'
import { Button } from '../../../shared/ui/atoms/Button'

interface BattleStageViewProps {
  roomCode: string
  room: Room | null
  error: string | null
  onLeave: () => void
}

const statusLabels: Record<RoomStatus, string> = {
  waiting: 'Waiting to start',
  battling: 'Battle in progress',
  finished: 'Battle finished',
}

export function BattleStageView({ roomCode, room, error, onLeave }: BattleStageViewProps) {
  const dancers = room?.dancers ?? null
  const result = room?.battle?.result ?? null

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Battle in room {roomCode}</h1>
        {room && (
          <Badge tone={room.status === 'battling' ? 'success' : 'accent'}>{statusLabels[room.status]}</Badge>
        )}
      </header>

      {error && <p className="rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {dancers ? (
          dancers.map((dancer) => <DancerSlot key={dancer.id} dancer={dancer} />)
        ) : (
          <p className="text-sm text-slate-500 sm:col-span-2">Waiting for the battle to start.</p>
        )}
      </div>

      <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-slate-500">
        Dance stage placeholder
      </div>

      {room?.status === 'finished' && <ResultPanel dancers={dancers} result={result} />}

      <footer className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onLeave}>
          Leave room
        </Button>
      </footer>
    </section>
  )
}

function DancerSlot({ dancer }: { dancer: Player }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-fuchsia-900/60 bg-slate-900 px-4 py-4">
      <span className="text-lg font-semibold text-slate-100">{dancer.displayName}</span>
      <Badge tone="accent">dancer</Badge>
    </div>
  )
}

interface ResultPanelProps {
  dancers: [Player, Player] | null
  result: { scores: Record<string, number>; winnerId: string | null } | null
}

function ResultPanel({ dancers, result }: ResultPanelProps) {
  if (!result || !dancers) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-400">
        The battle ended early, so there is no result.
      </div>
    )
  }

  const winner = result.winnerId ? dancers.find((d) => d.id === result.winnerId) : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Result</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {dancers.map((dancer) => (
          <div key={dancer.id} className="flex justify-between rounded-lg bg-slate-900 px-4 py-3">
            <span>{dancer.displayName}</span>
            <span className="font-semibold">{result.scores[dancer.id] ?? 0}</span>
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold text-emerald-300">
        {winner ? `Winner: ${winner.displayName}` : 'It is a tie!'}
      </p>
    </div>
  )
}
