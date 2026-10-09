import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocketDomainError } from '../../../shared/lib/socket'
import type { Battle, Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { initRoomSync, useRoomStore } from '../../rooms/store/roomStore'
import { useVoteStore } from '../store/voteStore'
import { VotePanel } from './VotePanel'

const { emitWithAck, handlers } = vi.hoisted(() => ({
  emitWithAck: vi.fn(),
  handlers: new Map<string, (payload: unknown) => void>(),
}))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => handlers.set(event, handler)),
    off: vi.fn(),
    io: { on: vi.fn() },
  },
  SocketDomainError: class extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

function battlingRoom(battle: Partial<Battle> = {}, overrides: Partial<Room> = {}): Room {
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
      startedAt: '2026-01-01T00:00:00.000Z',
      startsInMs: -5_000,
      finishedAt: null,
      result: null,
      ...battle,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const voteButton = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
const pressed = (name: string) => voteButton(name).getAttribute('aria-pressed')

/** The server answers each vote:cast with the voter's current vote. */
function serverAcksVotes() {
  emitWithAck.mockImplementation((_event: string, payload: { dancerId: string | null }) =>
    Promise.resolve({ dancerId: payload.dancerId }),
  )
}

beforeEach(() => {
  emitWithAck.mockReset()
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
  useVoteStore.getState().reset()
})

afterEach(() => {
  vi.useRealTimers()
  useRoomStore.setState({ room: null })
})

describe('VotePanel for a spectator', () => {
  it('casts, moves and withdraws the vote by tapping dancer names', async () => {
    const user = userEvent.setup()
    serverAcksVotes()
    useRoomStore.setState({ room: battlingRoom() })
    render(<VotePanel />)

    expect(pressed('Alice')).toBe('false')
    expect(pressed('Bob')).toBe('false')

    await user.click(voteButton('Alice'))
    expect(emitWithAck).toHaveBeenLastCalledWith('vote:cast', { roomCode: 'ROOM01', voterId: 'me', dancerId: 'a' })
    expect(pressed('Alice')).toBe('true')
    expect(screen.getByText(/Your vote:/).textContent).toBe('Your vote: Alice')

    await user.click(voteButton('Bob'))
    expect(emitWithAck).toHaveBeenLastCalledWith('vote:cast', { roomCode: 'ROOM01', voterId: 'me', dancerId: 'b' })
    expect(pressed('Alice')).toBe('false')
    expect(pressed('Bob')).toBe('true')
    expect(screen.getByText(/Your vote:/).textContent).toBe('Your vote: Bob')

    await user.click(voteButton('Bob'))
    expect(emitWithAck).toHaveBeenLastCalledWith('vote:cast', { roomCode: 'ROOM01', voterId: 'me', dancerId: null })
    expect(pressed('Bob')).toBe('false')
    expect(screen.queryByText(/Your vote:/)).toBeNull()
  })

  it('sends one vote at a time and locks the buttons until the server answers', async () => {
    const user = userEvent.setup()
    let answer: (value: { dancerId: string | null }) => void = () => {}
    emitWithAck.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    useRoomStore.setState({ room: battlingRoom() })
    render(<VotePanel />)

    await user.click(voteButton('Alice'))
    await user.click(voteButton('Bob'))

    expect(emitWithAck).toHaveBeenCalledTimes(1)
    expect(voteButton('Alice').disabled).toBe(true)
    expect(voteButton('Bob').disabled).toBe(true)

    await act(async () => answer({ dancerId: 'a' }))
    expect(voteButton('Bob').disabled).toBe(false)
    expect(pressed('Alice')).toBe('true')
  })

  it('names the dancers from the battle roster, even one missing from the player list', () => {
    const room = battlingRoom({ roster: [{ id: 'a', displayName: 'Alice' }, { id: 'b', displayName: 'Bobby' }] })
    room.players = room.players.filter((p) => p.id !== 'b')
    useRoomStore.setState({ room })
    render(<VotePanel />)

    expect(voteButton('Bobby')).toBeTruthy()
  })

  it('is disabled with a countdown before the start, then opens', () => {
    vi.useFakeTimers()
    useRoomStore.setState({ room: battlingRoom({ startsInMs: 3_000, endsInMs: 123_000 }) })
    render(<VotePanel />)

    expect(screen.getByText('Voting opens when the battle starts, in 3s.')).toBeTruthy()
    expect(voteButton('Alice').disabled).toBe(true)

    act(() => vi.advanceTimersByTime(3_100))

    expect(screen.queryByText(/Voting opens/)).toBeNull()
    expect(screen.getByText('Votes close in 120s')).toBeTruthy()
    expect(voteButton('Alice').disabled).toBe(false)
  })

  it('is disabled once the battle is finished, still showing the vote', () => {
    useVoteStore.getState().receiveMine({ roomCode: 'ROOM01', dancerId: 'a' })
    useRoomStore.setState({
      room: battlingRoom({ finishedAt: '2026-01-01T00:03:00.000Z', endReason: 'song-end' }, { status: 'finished' }),
    })
    render(<VotePanel />)

    expect(screen.getByText('Voting is closed: the battle is over.')).toBeTruthy()
    expect(voteButton('Alice').disabled).toBe(true)
    expect(voteButton('Bob').disabled).toBe(true)
    expect(pressed('Alice')).toBe('true')
  })

  it.each([
    ['INVALID_VOTER', "Only spectators can vote. Dancers can't vote."],
    ['BATTLE_NOT_STARTED', 'The battle has not started yet. You can vote once the music begins.'],
    ['BATTLE_FINISHED', 'The battle is over, so voting is closed.'],
  ])('explains a %s rejection in plain words and keeps the previous vote', async (code, message) => {
    const user = userEvent.setup()
    emitWithAck.mockRejectedValue(new SocketDomainError(code, 'raw server message'))
    useRoomStore.setState({ room: battlingRoom() })
    render(<VotePanel />)

    await user.click(voteButton('Alice'))

    expect(screen.getByRole('alert').textContent).toBe(message)
    expect(pressed('Alice')).toBe('false')
  })

  it('follows vote:mine for this room and ignores it for another room', () => {
    initRoomSync()
    useRoomStore.setState({ room: battlingRoom() })
    render(<VotePanel />)

    act(() => handlers.get('vote:mine')?.({ roomCode: 'OTHER1', dancerId: 'a' }))
    expect(pressed('Alice')).toBe('false')

    act(() => handlers.get('vote:mine')?.({ roomCode: 'ROOM01', dancerId: 'b' }))
    expect(pressed('Bob')).toBe('true')

    act(() => handlers.get('vote:mine')?.({ roomCode: 'ROOM01', dancerId: null }))
    expect(pressed('Bob')).toBe('false')
  })

  it('drops a vote for a dancer who left the battle', () => {
    useVoteStore.getState().receiveMine({ roomCode: 'ROOM01', dancerId: 'c' })
    useRoomStore.setState({ room: battlingRoom() })
    render(<VotePanel />)

    expect(screen.queryByText(/Your vote:/)).toBeNull()
  })
})

describe('VotePanel for a dancer', () => {
  it("explains that dancers can't vote and never sends a vote", async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ identity: { id: 'a', displayName: 'Alice' } })
    useRoomStore.setState({ room: battlingRoom() })
    render(<VotePanel />)

    expect(screen.getByText("Dancers can't vote.")).toBeTruthy()
    expect(voteButton('Bob').disabled).toBe(true)
    await user.click(voteButton('Bob'))
    expect(emitWithAck).not.toHaveBeenCalled()
  })
})
