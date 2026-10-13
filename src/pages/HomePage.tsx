import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { defaultGuestName, useAuthStore } from '../features/auth/store/authStore'
import {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  useRoomError,
  useRoomNotice,
  useRoomStore,
} from '../features/rooms/store/roomStore'
import { Button } from '../shared/ui/atoms/Button'
import { Input } from '../shared/ui/atoms/Input'

export function HomePage() {
  const navigate = useNavigate()
  const identity = useAuthStore((state) => state.identity)
  const setDisplayName = useAuthStore((state) => state.setDisplayName)
  const createRoom = useRoomStore((state) => state.createRoom)
  const leaveRoom = useRoomStore((state) => state.leaveRoom)
  const roomError = useRoomError()
  const notice = useRoomNotice()
  const dismissNotice = useRoomStore((state) => state.dismissNotice)

  const [name, setName] = useState(() => identity?.displayName ?? defaultGuestName())
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // Reaching home with a room still in the store (logo, Back button) means the
    // player left it without "Leave room": free the seat instead of keeping it.
    if (useRoomStore.getState().room) void leaveRoom()
  }, [leaveRoom])

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
        <h1 className="text-gradient-brand mx-auto w-fit text-5xl font-extrabold tracking-tight">DanceSync</h1>
        <p className="mt-3 max-w-md text-ink-muted">
          Join a room with up to {MAX_PLAYERS} players. Each player chooses to dance or to spectate: at least{' '}
          {MIN_PLAYERS_TO_START} dancers compete while the spectators watch and vote for the winner.
        </p>
      </header>

      {notice && (
        <div
          role="status"
          className="flex w-full max-w-sm items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700"
        >
          <span>{notice}</span>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={dismissNotice}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-soft">
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
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-soft">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
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
        {roomError && <p className="text-sm font-medium text-rose-700">{roomError}</p>}
      </div>
    </main>
  )
}
