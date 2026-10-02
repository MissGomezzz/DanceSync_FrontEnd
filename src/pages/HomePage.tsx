import { useState } from 'react'
import { useNavigate } from 'react-router'
import { defaultGuestName, useAuthStore } from '../features/auth/store/authStore'
import { MAX_PLAYERS, MIN_PLAYERS_TO_START, useRoomError, useRoomStore } from '../features/rooms/store/roomStore'
import { Button } from '../shared/ui/atoms/Button'
import { Input } from '../shared/ui/atoms/Input'

export function HomePage() {
  const navigate = useNavigate()
  const identity = useAuthStore((state) => state.identity)
  const setDisplayName = useAuthStore((state) => state.setDisplayName)
  const createRoom = useRoomStore((state) => state.createRoom)
  const roomError = useRoomError()

  const [name, setName] = useState(() => identity?.displayName ?? defaultGuestName())
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateRoom = async () => {
    setCreating(true)
    try {
      const room = await createRoom(name)
      if (room) {
        navigate(`/rooms/${room.code}`)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleJoinRoom = () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length === 0) return
    setDisplayName(name)
    navigate(`/rooms/${code}`)
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
      <header className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-brand-red">DanceSync</h1>
        <p className="mt-3 max-w-md text-slate-400">
          Join a room with up to {MAX_PLAYERS} players. Each player chooses to dance or to spectate: at least{' '}
          {MIN_PLAYERS_TO_START} dancers compete while the spectators watch and vote for the winner.
        </p>
      </header>

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <Input
          id="display-name"
          label="Display name"
          placeholder="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button onClick={handleCreateRoom} disabled={creating || name.trim().length === 0}>
          {creating ? 'Creating room...' : 'Create room'}
        </Button>
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
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
        />
        <Button
          variant="secondary"
          onClick={handleJoinRoom}
          disabled={joinCode.trim().length === 0 || name.trim().length === 0}
        >
          Join room
        </Button>
        {roomError && <p className="text-sm text-rose-400">{roomError}</p>}
      </div>
    </main>
  )
}
