import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { bindWordRaceSync } from '../lib/wordRaceSync'
import { RESULT_VISIBLE_MS, useWordRaceStore } from '../store/wordRaceStore'
import type { WordRoundEndedEvent, WordRoundStartedEvent } from '../types'
import { WordRaceOverlay } from './WordRaceOverlay'

const { emitWithAck, handlers } = vi.hoisted(() => ({
  emitWithAck: vi.fn(),
  handlers: new Map<string, (payload: unknown) => void>(),
}))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => handlers.set(event, handler)),
    off: vi.fn((event: string) => handlers.delete(event)),
    io: { on: vi.fn() },
  },
  SocketDomainError: class extends Error {},
}))

const NOW = '2026-01-01T00:00:00.000Z'
const WORD = 'tambor'

const room: Room = {
  code: 'ROOM01',
  hostId: 'me',
  players: [
    { id: 'me', displayName: 'Me', role: 'dancer' },
    { id: 'rival', displayName: 'Rival', role: 'dancer' },
    { id: 'fan', displayName: 'Fan', role: 'spectator' },
  ],
  dancers: [
    { id: 'me', displayName: 'Me', role: 'dancer' },
    { id: 'rival', displayName: 'Rival', role: 'dancer' },
  ],
  spectators: [{ id: 'fan', displayName: 'Fan', role: 'spectator' }],
  status: 'battling',
  battle: {
    id: 'b',
    roomCode: 'ROOM01',
    dancerIds: ['me', 'rival'],
    song: null,
    startedAt: NOW,
    finishedAt: null,
    result: null,
  },
  songSelection: null,
  selectedSong: null,
  createdAt: NOW,
}

const started: WordRoundStartedEvent = {
  roomCode: 'ROOM01',
  roundId: 'b:2',
  roundNumber: 2,
  totalRounds: 3,
  word: WORD,
  expiresInMs: 10_000,
}

function ended(overrides: Partial<WordRoundEndedEvent> = {}): WordRoundEndedEvent {
  return {
    roomCode: 'ROOM01',
    roundId: 'b:2',
    roundNumber: 2,
    totalRounds: 3,
    word: WORD,
    winnerId: 'rival',
    winnerName: 'Rival',
    reason: 'won',
    wins: { me: 0, rival: 1 },
    ...overrides,
  }
}

/** Simulates a server event reaching the socket. */
function serverEmits(event: 'word:round-started' | 'word:round-ended', payload: unknown) {
  act(() => handlers.get(event)!(payload))
}

let unbind: () => void

function renderAs(playerId: string) {
  useAuthStore.setState({ identity: { id: playerId, displayName: playerId } })
  useRoomStore.setState({ room, error: null })
  unbind = bindWordRaceSync('ROOM01')
  return render(<WordRaceOverlay />)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  emitWithAck.mockReset()
})

afterEach(() => {
  unbind()
  vi.useRealTimers()
})

describe('WordRaceOverlay for a dancer', () => {
  it('shows the word, the round and a focused input', () => {
    renderAs('me')
    expect(screen.queryByRole('textbox')).toBeNull()
    serverEmits('word:round-started', started)
    expect(screen.getByTestId('word-race-word').textContent).toBe(WORD)
    expect(screen.getByText(/Round 2 \/ 3/)).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('10s')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Type the word' }))
  })

  it('lets the dancer retry after a typo and congratulates the winner', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAs('me')
    serverEmits('word:round-started', started)
    const input = screen.getByRole('textbox')

    emitWithAck.mockResolvedValueOnce({ outcome: 'incorrect', winnerId: null })
    await user.type(input, 'tambr{Enter}')
    expect(emitWithAck).toHaveBeenCalledWith('word:submit', { roomCode: 'ROOM01', playerId: 'me', roundId: 'b:2', text: 'tambr' })
    expect(screen.getByRole('alert').textContent).toBe('Not quite, try again')

    emitWithAck.mockResolvedValueOnce({ outcome: 'won', winnerId: 'me' })
    await user.clear(input)
    await user.type(input, `${WORD}{Enter}`)
    serverEmits('word:round-ended', ended({ winnerId: 'me', winnerName: 'Me', wins: { me: 1, rival: 0 } }))

    const banner = screen.getByRole('status')
    expect(banner.textContent).toBe('You were first! You win this round.')
    expect(banner.dataset.kind).toBe('won')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(useWordRaceStore.getState().wins).toEqual({ me: 1, rival: 0 })
  })

  it('tells a dancer who typed it too late who got there first', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    let resolveAck: (value: unknown) => void = () => {}
    emitWithAck.mockReturnValueOnce(new Promise((resolve) => (resolveAck = resolve)))
    renderAs('me')
    serverEmits('word:round-started', started)

    await user.type(screen.getByRole('textbox'), `${WORD}{Enter}`)
    // The winner's broadcast reaches us before the ack of our own (late) submission.
    serverEmits('word:round-ended', ended())
    expect(screen.getByRole('status').textContent).toBe('Too slow! Rival typed it first.')

    await act(async () => resolveAck({ outcome: 'late', winnerId: 'rival' }))
    expect(screen.getByRole('status').textContent).toBe('You typed it, but Rival got there first.')
    expect(screen.getByRole('status').dataset.kind).toBe('late')
  })

  it('does not let the word be pasted', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAs('me')
    serverEmits('word:round-started', started)
    const input = screen.getByRole('textbox')
    input.focus()
    await user.paste(WORD)
    expect(input).toHaveProperty('value', '')
  })

  it('hides the result banner after a few seconds', () => {
    renderAs('me')
    serverEmits('word:round-started', started)
    serverEmits('word:round-ended', ended({ reason: 'expired', winnerId: null, winnerName: null, wins: { me: 0, rival: 0 } }))
    expect(screen.getByRole('status').textContent).toBe(`Time's up! Nobody typed "${WORD}".`)
    act(() => vi.advanceTimersByTime(RESULT_VISIBLE_MS + 100))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('closes the word card when the battle finishes mid-round', () => {
    renderAs('me')
    serverEmits('word:round-started', started)
    expect(screen.getByRole('textbox')).toBeTruthy()

    act(() => useRoomStore.setState({ room: { ...room, status: 'finished' } }))

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByTestId('word-race-word')).toBeNull()
    expect(useWordRaceStore.getState().activeRound).toBeNull()
  })

  it('ignores events from another room', () => {
    renderAs('me')
    serverEmits('word:round-started', { ...started, roomCode: 'OTHER1' })
    expect(screen.queryByTestId('word-race-word')).toBeNull()
  })
})

describe('WordRaceOverlay for a spectator', () => {
  it('shows the word and the countdown without an input, then who won', () => {
    renderAs('fan')
    serverEmits('word:round-started', started)
    expect(screen.getByTestId('word-race-word').textContent).toBe(WORD)
    expect(screen.getByRole('timer')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Dancers are racing to type it...')).toBeTruthy()

    serverEmits('word:round-ended', ended())
    expect(screen.getByRole('status').textContent).toBe('Rival typed it first!')
    expect(screen.getByRole('status').dataset.kind).toBe('watching')
  })
})
