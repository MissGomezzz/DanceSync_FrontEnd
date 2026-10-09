import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../shared/lib/env'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../store/roomStore'
import { useLeaveBeacon } from './useLeaveBeacon'

const { emitWithAck } = vi.hoisted(() => ({ emitWithAck: vi.fn() }))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const room: Room = {
  code: 'ROOM01',
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

const sendBeacon = vi.fn(() => true)

function Probe() {
  useLeaveBeacon()
  return null
}

const closeTab = () => act(() => void window.dispatchEvent(new Event('pagehide')))

beforeEach(() => {
  sendBeacon.mockClear()
  emitWithAck.mockReset()
  emitWithAck.mockReturnValue(new Promise(() => {}))
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true })
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
})

afterEach(() => {
  useRoomStore.setState({ room: null })
})

describe('useLeaveBeacon', () => {
  it('frees the seat with a beacon when the tab closes while in a room', () => {
    useRoomStore.setState({ room })
    render(<Probe />)

    closeTab()

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith(`${env.apiUrl}/api/rooms/ROOM01/leave`, JSON.stringify({ playerId: 'me', reason: 'pagehide' }))
  })

  it('sends nothing outside a room', () => {
    render(<Probe />)

    closeTab()

    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('sends nothing after an explicit "Leave room" (room:leave already sent)', async () => {
    useRoomStore.setState({ room })
    render(<Probe />)

    await act(async () => void useRoomStore.getState().leaveRoom())
    closeTab()

    expect(emitWithAck).toHaveBeenCalledWith('room:leave', { roomCode: 'ROOM01', playerId: 'me' })
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('checks the seat when the page hides, even before the listener is unbound', () => {
    useRoomStore.setState({ room })
    render(<Probe />)

    // The store is cleared, but React has not re-rendered yet.
    useRoomStore.setState({ room: null })
    window.dispatchEvent(new Event('pagehide'))

    expect(sendBeacon).not.toHaveBeenCalled()
  })
})
