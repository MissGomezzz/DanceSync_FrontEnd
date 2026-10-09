import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocketDomainError } from '../../../shared/lib/socket'
import type { BattleResult, Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { useScoreboardStore } from '../../scoreboard/store/scoreboardStore'
import { useVoteStore } from '../../voting/store/voteStore'
import { useWordRaceStore } from '../../wordRace/store/wordRaceStore'
import { BattleStage } from './BattleStage'

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
vi.mock('../../camera/hooks/useBattleVideo', () => ({
  useBattleVideo: () => ({ dancerVideos: [], needsCameraPrompt: false }),
}))
vi.mock('../../wordRace/hooks/useWordRaceSync', () => ({ useWordRaceSync: () => {} }))
vi.mock('../../wordRace/components/WordRaceOverlay', () => ({ WordRaceOverlay: () => null }))

const result: BattleResult = {
  winnerId: 'host',
  standings: [
    { dancerId: 'host', displayName: 'Hana', votes: 2, wordsWon: 1, score: 5, rank: 1 },
    { dancerId: 'rival', displayName: 'Rio', votes: 0, wordsWon: 2, score: 2, rank: 2 },
  ],
}

function room(status: Room['status'], overrides: Partial<Room> = {}): Room {
  const dancers = [
    { id: 'host', displayName: 'Hana', role: 'dancer' as const },
    { id: 'rival', displayName: 'Rio', role: 'dancer' as const },
  ]
  return {
    code: 'ROOM01',
    hostId: 'host',
    players: dancers,
    dancers,
    spectators: [],
    status,
    battle:
      status === 'waiting'
        ? null
        : {
            id: 'b1',
            roomCode: 'ROOM01',
            dancerIds: ['host', 'rival'],
            song: null,
            startedAt: '2026-01-01T00:00:00.000Z',
            finishedAt: '2026-01-01T00:03:00.000Z',
            endReason: 'song-end',
            result,
          },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function LobbyStub() {
  const location = useLocation()
  return <p>Lobby page {location.pathname}</p>
}

async function renderFinished(myId: string) {
  useAuthStore.setState({ identity: { id: myId, displayName: myId } })
  const finished = room('finished')
  useRoomStore.setState({ room: finished })
  render(
    <MemoryRouter initialEntries={['/battle/ROOM01']}>
      <Routes>
        <Route path="/battle/:roomCode" element={<BattleStage roomCode="ROOM01" />} />
        <Route path="/rooms/:roomCode" element={<LobbyStub />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
  return finished
}

/** Routes emitted events to per-event handlers; unknown events never answer. */
function serverAnswers(answers: Record<string, (payload: never) => Promise<unknown>>) {
  emitWithAck.mockImplementation((event: string, payload: never) => answers[event]?.(payload) ?? new Promise(() => {}))
}

beforeEach(() => {
  emitWithAck.mockReset()
})

afterEach(() => {
  useRoomStore.setState({ room: null, error: null, joinError: null })
})

describe('rematch', () => {
  it('lets the host start one rematch, resets the battle stores and goes back to the lobby', async () => {
    const user = userEvent.setup()
    let answerRematch: (room: Room) => void = () => {}
    serverAnswers({
      'room:join': () => Promise.resolve(room('finished')),
      'room:rematch': () => new Promise<Room>((resolve) => (answerRematch = resolve)),
    })
    await renderFinished('host')
    // Leftovers of the battle that just finished.
    useVoteStore.getState().receiveMine({ roomCode: 'ROOM01', dancerId: 'host' })
    useWordRaceStore.setState({ wins: { host: 1 } })
    useScoreboardStore.getState().applyStandings('b1', result.standings ?? [])

    const rematch = screen.getByRole('button', { name: 'Rematch' })
    await user.click(rematch)
    await user.click(rematch)

    expect(emitWithAck.mock.calls.filter(([event]) => event === 'room:rematch')).toEqual([
      ['room:rematch', { roomCode: 'ROOM01', requesterId: 'host' }],
    ])
    expect(screen.getByRole('button', { name: 'Starting rematch...' })).toHaveProperty('disabled', true)

    await act(async () => answerRematch(room('waiting', { lastResult: result })))

    expect(screen.getByText('Lobby page /rooms/ROOM01')).toBeTruthy()
    expect(useVoteStore.getState().dancerId).toBeNull()
    expect(useWordRaceStore.getState().wins).toEqual({})
    expect(useScoreboardStore.getState().battleId).toBeNull()
  })

  it('shows no rematch button to other players, only a hint and the leave button', async () => {
    serverAnswers({ 'room:join': () => Promise.resolve(room('finished')) })
    await renderFinished('rival')

    expect(screen.queryByRole('button', { name: 'Rematch' })).toBeNull()
    expect(screen.getByText('The host can start a rematch.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Leave room' })).toBeTruthy()
  })

  it.each([
    ['NOT_HOST', 'Only the host can start a rematch.'],
    ['ROOM_NOT_FINISHED', 'The battle is not over yet, so a rematch cannot start.'],
  ])('explains a %s rejection and stays on the results', async (code, message) => {
    const user = userEvent.setup()
    serverAnswers({
      'room:join': () => Promise.resolve(room('finished')),
      'room:rematch': () => Promise.reject(new SocketDomainError(code, 'raw')),
    })
    await renderFinished('host')

    await user.click(screen.getByRole('button', { name: 'Rematch' }))

    expect(screen.getByText(message)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rematch' })).toHaveProperty('disabled', false)
    expect(screen.queryByText(/Lobby page/)).toBeNull()
  })
})
