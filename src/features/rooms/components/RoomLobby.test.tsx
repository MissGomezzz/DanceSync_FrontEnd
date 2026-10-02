import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../store/roomStore'
import { RoomLobby } from './RoomLobby'

const { emitWithAck } = vi.hoisted(() => ({ emitWithAck: vi.fn() }))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const NOW = '2026-01-01T00:00:00.000Z'

function lobby(overrides: Partial<Room> = {}): Room {
  return {
    code: 'ROOM01',
    hostId: 'me',
    players: [
      { id: 'me', displayName: 'Me', role: 'undecided' },
      { id: 'rival', displayName: 'Rival', role: 'dancer' },
    ],
    dancers: null,
    spectators: [],
    status: 'waiting',
    battle: null,
    songSelection: null,
    selectedSong: null,
    createdAt: NOW,
    ...overrides,
  }
}

/** Routes emitted events to per-event handlers; unknown events never answer. */
function serverAnswers(answers: Record<string, (payload: never) => Promise<unknown>>) {
  emitWithAck.mockImplementation((event: string, payload: never) => answers[event]?.(payload) ?? new Promise(() => {}))
}

function renderLobby() {
  return render(
    <MemoryRouter initialEntries={['/rooms/ROOM01']}>
      <Routes>
        <Route path="/rooms/:roomCode" element={<RoomLobby roomCode="ROOM01" />} />
        <Route path="/home" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  emitWithAck.mockReset()
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
  useRoomStore.setState({ room: null, error: null, joinError: null })
})

describe('joining the room', () => {
  it('turns "Joining room..." into an error with a retry when the join times out', async () => {
    const user = userEvent.setup()
    serverAnswers({
      'room:join': () => Promise.reject(new Error('The server did not respond. Check your connection.')),
    })
    renderLobby()

    expect(await screen.findByText('Cannot join room ROOM01')).toBeTruthy()
    expect(screen.getByText('The server did not respond. Check your connection.')).toBeTruthy()

    serverAnswers({ 'room:join': () => Promise.resolve(lobby()) })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Rival')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Cannot join room ROOM01')).toBeNull()
  })
})

describe('leaving the room', () => {
  it('goes home even when the server never answers the leave', async () => {
    const user = userEvent.setup()
    serverAnswers({ 'room:join': () => Promise.resolve(lobby()) })
    renderLobby()
    await screen.findAllByText('Rival')

    await user.click(screen.getByRole('button', { name: 'Leave room' }))

    expect(screen.getByText('Home page')).toBeTruthy()
    expect(emitWithAck).toHaveBeenCalledWith('room:leave', { roomCode: 'ROOM01', playerId: 'me' })
    expect(useRoomStore.getState().room).toBeNull()
  })
})
