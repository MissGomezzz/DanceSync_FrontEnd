import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocketDomainError } from '../../../shared/lib/socket'
import type { Battle, Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { RatingPanel } from './RatingPanel'

const { emitWithAck } = vi.hoisted(() => ({ emitWithAck: vi.fn() }))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

function battlingRoom(battle: Partial<Battle> = {}): Room {
  const dancers = [
    { id: 'a', displayName: 'Alice', role: 'dancer' as const },
    { id: 'b', displayName: 'Bob', role: 'dancer' as const },
  ]
  const spectator = { id: 'me', displayName: 'Me', role: 'spectator' as const }
  return {
    code: 'ROOM01',
    hostId: 'a',
    players: [...dancers, spectator],
    dancers,
    spectators: [spectator],
    status: 'battling',
    battle: {
      id: 'b1',
      roomCode: 'ROOM01',
      dancerIds: ['a', 'b'],
      song: null,
      ratings: [],
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: null,
      result: null,
      ...battle,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const aliceStars = () => screen.getAllByRole('radio').slice(0, 5)

beforeEach(() => {
  emitWithAck.mockReset()
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
})

afterEach(() => {
  vi.useRealTimers()
  useRoomStore.setState({ room: null })
})

describe('RatingPanel rating window', () => {
  it('counts down to the start with rating disabled, then shows when ratings close', () => {
    vi.useFakeTimers()
    useRoomStore.setState({ room: battlingRoom({ startsInMs: 3_000, endsInMs: 123_000 }) })
    render(<RatingPanel />)

    expect(screen.getByText('The battle starts in 3s')).toBeTruthy()
    expect(aliceStars().every((star) => (star as HTMLButtonElement).disabled)).toBe(true)

    act(() => vi.advanceTimersByTime(3_100))

    expect(screen.queryByText(/The battle starts in/)).toBeNull()
    expect(screen.getByText('Ratings close in 120s')).toBeTruthy()
    expect(aliceStars().some((star) => (star as HTMLButtonElement).disabled)).toBe(false)
  })

  it('treats a negative startsInMs as a running battle', () => {
    useRoomStore.setState({ room: battlingRoom({ startsInMs: -10_000, endsInMs: 45_000 }) })
    render(<RatingPanel />)

    expect(screen.getByText('Ratings close in 45s')).toBeTruthy()
    expect((aliceStars()[0] as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows no timing and keeps rating open on servers that send neither value', () => {
    useRoomStore.setState({ room: battlingRoom() })
    render(<RatingPanel />)

    expect(screen.queryByText(/starts in|close in|closed/)).toBeNull()
    expect((aliceStars()[0] as HTMLButtonElement).disabled).toBe(false)
  })

  it('explains a BATTLE_NOT_STARTED rejection in plain words', async () => {
    const user = userEvent.setup()
    emitWithAck.mockRejectedValue(new SocketDomainError('BATTLE_NOT_STARTED', 'raw server message'))
    useRoomStore.setState({ room: battlingRoom() })
    render(<RatingPanel />)

    await user.click(aliceStars()[3])

    expect(emitWithAck).toHaveBeenCalledWith('rating:submit', { roomCode: 'ROOM01', raterId: 'me', dancerId: 'a', score: 4 })
    expect(screen.getByText('The battle has not started yet. You can rate once the music begins.')).toBeTruthy()
  })
})
