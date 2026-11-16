import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../../shared/types'
import { useRoomStore } from '../../rooms/store/roomStore'
import { BattlePage } from './BattlePage'

vi.mock('../components/BattleStage', () => ({
  BattleStage: ({ roomCode }: { roomCode: string }) => <div>stage {roomCode}</div>,
}))
vi.mock('../components/PlayersPanel', () => ({ PlayersPanel: () => <div>players</div> }))
vi.mock('../../chat/components/ChatPanel', () => ({
  ChatPanel: ({ roomCode }: { roomCode: string }) => <div>chat {roomCode}</div>,
}))
vi.mock('../../scoreboard/components/LiveScoreboard', () => ({ LiveScoreboard: () => <div>scoreboard</div> }))
vi.mock('../../voting/components/VotePanel', () => ({ VotePanel: () => <div>votes</div> }))

const NOW = '2026-01-01T00:00:00.000Z'

function room(overrides: Partial<Room> = {}): Room {
  const dancer = { id: 'a', displayName: 'Ana', role: 'dancer' as const }
  return {
    code: 'ROOM01',
    hostId: 'a',
    players: [dancer],
    dancers: [dancer],
    spectators: [],
    status: 'battling',
    battle: {
      id: 'b1',
      roomCode: 'ROOM01',
      dancerIds: ['a'],
      song: null,
      startedAt: NOW,
      finishedAt: null,
      result: null,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: NOW,
    ...overrides,
  }
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/battle/:roomCode?" element={<BattlePage />} />
        <Route path="/home" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useRoomStore.setState({ room: null })
})

describe('BattlePage', () => {
  it('sends the user home without a room code', () => {
    renderAt('/battle')
    expect(screen.getByText('home page')).toBeTruthy()
  })

  it('shows every battle panel while the battle is running, with an upper-case code', () => {
    useRoomStore.setState({ room: room() })
    renderAt('/battle/room01')

    expect(screen.getByText('stage ROOM01')).toBeTruthy()
    expect(screen.getByText('chat ROOM01')).toBeTruthy()
    for (const panel of ['scoreboard', 'votes', 'players']) expect(screen.getByText(panel)).toBeTruthy()
  })

  it('hides the live scoreboard once the battle is no longer running', () => {
    useRoomStore.setState({ room: room({ status: 'finished' }) })
    renderAt('/battle/ROOM01')

    expect(screen.queryByText('scoreboard')).toBeNull()
    expect(screen.getByText('votes')).toBeTruthy()
    expect(screen.getByText('players')).toBeTruthy()
  })

  it.each([
    ['another room', room({ code: 'OTHER1' })],
    ['a room without a battle', room({ battle: null })],
    ['a waiting room', room({ status: 'waiting' })],
    ['no room', null],
  ])('shows only the stage and the chat for %s', (_label, current) => {
    useRoomStore.setState({ room: current })
    renderAt('/battle/ROOM01')

    expect(screen.getByText('stage ROOM01')).toBeTruthy()
    expect(screen.getByText('chat ROOM01')).toBeTruthy()
    for (const panel of ['scoreboard', 'votes', 'players']) expect(screen.queryByText(panel)).toBeNull()
  })
})
