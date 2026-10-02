import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../shared/types'
import { useAuthStore } from '../features/auth/store/authStore'
import { useRoomStore } from '../features/rooms/store/roomStore'
import { HomePage } from './HomePage'

const { emitWithAck } = vi.hoisted(() => ({ emitWithAck: vi.fn() }))

vi.mock('../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const staleRoom: Room = {
  code: 'AAAAAA',
  hostId: 'me',
  players: [{ id: 'me', displayName: 'Me', role: 'dancer' }],
  dancers: null,
  spectators: [],
  status: 'waiting',
  battle: null,
  songSelection: null,
  selectedSong: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  emitWithAck.mockReset().mockResolvedValue(null)
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
})

describe('HomePage', () => {
  it('leaves a room the player navigated away from without "Leave room"', () => {
    useRoomStore.setState({ room: staleRoom })
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(emitWithAck).toHaveBeenCalledWith('room:leave', { roomCode: 'AAAAAA', playerId: 'me' })
    expect(useRoomStore.getState().room).toBeNull()
  })

  it('does nothing when no room is held', () => {
    useRoomStore.setState({ room: null })
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(emitWithAck).not.toHaveBeenCalled()
  })
})
