import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../shared/ui/atoms/Button'
import { Input } from '../shared/ui/atoms/Input'

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function HomePage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')

  const handleCreateRoom = () => {
    // Room creation will call the rooms service; for now a local id is generated.
    navigate(`/rooms/${generateRoomId()}`)
  }

  const handleJoinRoom = () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length === 0) return
    navigate(`/rooms/${code}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <header className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-fuchsia-400">DanceSync</h1>
        <p className="mt-3 max-w-md text-slate-400">
          Join a room with up to 8 players. Two dancers battle in real time while spectators chat and rate the
          performance.
        </p>
      </header>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <Button onClick={handleCreateRoom}>Create room</Button>
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          or
          <span className="h-px flex-1 bg-slate-800" />
        </div>
        <Input
          id="join-code"
          label="Room code"
          placeholder="ABC123"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value)}
        />
        <Button variant="secondary" onClick={handleJoinRoom} disabled={joinCode.trim().length === 0}>
          Join room
        </Button>
      </div>
    </main>
  )
}
