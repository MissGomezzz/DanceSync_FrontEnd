import { act, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../../shared/types'
import { useRoomStore } from '../../rooms/store/roomStore'
import { BattlePage } from './BattlePage'

vi.mock('../components/BattleStage', () => ({
  BattleStage: ({ roomCode, songPanels }: { roomCode: string; songPanels?: ReactNode }) => (
    <section aria-label="stage">
      <p>stage {roomCode}</p>
      {songPanels}
    </section>
  ),
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

/** A controllable window.matchMedia for the sidebar breakpoint; jsdom has none (the phone layout). */
function stubSidebar(matches: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  return (next: boolean) => {
    media.matches = next
    listeners.forEach((listener) => listener())
  }
}

const stage = () => screen.getByRole('region', { name: 'stage' })
const sidebar = () => screen.getByRole('complementary')
const texts = (container: HTMLElement) => [...container.children].map((child) => child.textContent)

beforeEach(() => {
  useRoomStore.setState({ room: null })
})

afterEach(() => vi.unstubAllGlobals())

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

  it('on a phone, puts the vote and the ranking under the song video, not in the column below', () => {
    useRoomStore.setState({ room: room() })
    renderAt('/battle/ROOM01')

    // Inside the stage (which places them between the song video and the cameras), vote first.
    expect(texts(stage())).toEqual(['stage ROOM01', 'votes', 'scoreboard'])
    expect(texts(sidebar())).toEqual(['players', 'chat ROOM01'])
  })

  it('with a sidebar (lg and up), keeps the ranking and the vote at the top of the sidebar', () => {
    stubSidebar(true)
    useRoomStore.setState({ room: room() })
    renderAt('/battle/ROOM01')

    expect(texts(stage())).toEqual(['stage ROOM01'])
    expect(texts(sidebar())).toEqual(['scoreboard', 'votes', 'players', 'chat ROOM01'])
  })

  it('moves the panels when the window crosses the sidebar breakpoint', () => {
    const setSidebar = stubSidebar(false)
    useRoomStore.setState({ room: room() })
    renderAt('/battle/ROOM01')
    expect(within(stage()).getByText('votes')).toBeTruthy()

    act(() => setSidebar(true))

    expect(within(stage()).queryByText('votes')).toBeNull()
    expect(within(sidebar()).getByText('votes')).toBeTruthy()
    // Each panel is on the page exactly once.
    expect(screen.getAllByText('votes')).toHaveLength(1)
    expect(screen.getAllByText('scoreboard')).toHaveLength(1)
  })

  it('uses the small gutter on phones', () => {
    renderAt('/battle/ROOM01')

    const main = screen.getByRole('main')
    expect(main.className.split(' ')).toEqual(expect.arrayContaining(['p-3', 'sm:p-6']))
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
