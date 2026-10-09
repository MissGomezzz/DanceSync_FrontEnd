import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { PlayersPanel } from './PlayersPanel'

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck: vi.fn(),
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const room: Room = {
  code: 'ROOM01',
  hostId: 'a',
  players: [
    { id: 'a', displayName: 'Ana', role: 'dancer' },
    { id: 'b', displayName: 'Ben', role: 'dancer' },
    { id: 'me', displayName: 'Me', role: 'spectator' },
  ],
  dancers: null,
  spectators: [],
  status: 'battling',
  battle: null,
  songSelection: null,
  selectedSong: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

afterEach(() => useRoomStore.setState({ room: null }))

describe('PlayersPanel', () => {
  it('lists every player with their role, the host and a "you" marker', () => {
    useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
    useRoomStore.setState({ room })
    render(<PlayersPanel />)

    expect(screen.getByRole('heading', { name: 'Players (3)' })).toBeTruthy()
    const items = within(screen.getByRole('list', { name: 'Players in the room' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Anahostdancer', 'Bendancer', 'Me(you)spectator'])
  })
})
