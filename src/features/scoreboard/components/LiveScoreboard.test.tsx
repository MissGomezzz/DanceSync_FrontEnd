import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room, Standing } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { bindScoreboardSync } from '../lib/scoreboardSync'
import { CHANGE_VISIBLE_MS, useScoreboardStore } from '../store/scoreboardStore'
import { LiveScoreboard } from './LiveScoreboard'

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck: vi.fn(),
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const standing = (dancerId: string, displayName: string, votes: number, wordsWon: number, rank: number): Standing => ({
  dancerId,
  displayName,
  votes,
  wordsWon,
  score: 2 * votes + wordsWon,
  rank,
})

function battlingRoom(standings: Standing[], battleId = 'b1', code = 'ROOM01'): Room {
  const dancers = standings.map((s) => ({ id: s.dancerId, displayName: s.displayName, role: 'dancer' as const }))
  return {
    code,
    hostId: dancers[0]?.id ?? 'x',
    players: dancers,
    dancers,
    spectators: [],
    status: 'battling',
    battle: {
      id: battleId,
      roomCode: code,
      dancerIds: dancers.map((d) => d.id),
      song: null,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: null,
      result: null,
      standings,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const rows = () => screen.getAllByRole('row').slice(1)
const rowOf = (name: string) => rows().find((row) => within(row).queryByText(name)) as HTMLElement
const liveRegion = () => screen.getByRole('status')

let unbind: () => void = () => {}

function mount(room: Room) {
  useRoomStore.setState({ room })
  unbind = bindScoreboardSync(room.code)
  render(<LiveScoreboard />)
}

const push = (room: Room) => act(() => useRoomStore.getState().receiveRoom(room))

beforeEach(() => {
  useAuthStore.setState({ identity: { id: 'spectator', displayName: 'Spec' } })
})

afterEach(() => {
  unbind()
  vi.useRealTimers()
  useRoomStore.setState({ room: null })
})

describe('LiveScoreboard', () => {
  it('lists rank, name, votes, words and score in the server order', () => {
    mount(battlingRoom([standing('a', 'Ana', 2, 1, 1), standing('b', 'Ben', 1, 0, 2)]))

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Rank',
      'Dancer',
      'Votes',
      'Words',
      'Score',
    ])
    expect(rows().map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent))).toEqual([
      ['1st', 'Ana', '2', '1', '5'],
      ['2nd', 'Ben', '1', '0', '2'],
    ])
  })

  it('colours rows by rank (gold, silver, bronze, neutral) and gives tied dancers the same colour', () => {
    mount(
      battlingRoom([
        standing('a', 'Ana', 2, 0, 1),
        standing('b', 'Ben', 2, 0, 1),
        standing('c', 'Cy', 1, 0, 3),
        standing('d', 'Dee', 0, 0, 4),
      ]),
    )

    expect(rows().map((row) => row.dataset.rankTone)).toEqual(['gold', 'gold', 'bronze', 'neutral'])

    push(battlingRoom([standing('a', 'Ana', 3, 0, 1), standing('b', 'Ben', 2, 0, 2), standing('c', 'Cy', 1, 0, 3)]))
    expect(rows().map((row) => row.dataset.rankTone)).toEqual(['gold', 'silver', 'bronze'])
    expect(rowOf('Ben').className).toContain('transition-colors')
  })

  it('shows no change chips for the first standings (for example after a refresh)', () => {
    mount(battlingRoom([standing('a', 'Ana', 1, 0, 1), standing('b', 'Ben', 0, 0, 2)]))

    expect(screen.queryByText(/^[+−]\d/)).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(liveRegion().textContent).toBe('')
  })

  it('shows +N and the rank arrows for about 2 s when a vote moves a dancer up, and announces it', () => {
    vi.useFakeTimers()
    mount(battlingRoom([standing('b', 'Ben', 1, 0, 1), standing('a', 'Ana', 0, 1, 2)]))

    push(battlingRoom([standing('a', 'Ana', 1, 1, 1), standing('b', 'Ben', 1, 0, 2)]))

    const ana = rowOf('Ana')
    expect(within(ana).getByText('+2').dataset.delta).toBe('up')
    expect(within(ana).getByRole('img', { name: 'moved up' })).toBeTruthy()
    const ben = rowOf('Ben')
    expect(within(ben).getByRole('img', { name: 'moved down' })).toBeTruthy()
    expect(within(ben).queryByText(/^[+−]\d/)).toBeNull()
    expect(liveRegion().textContent).toBe('Ana +2, now 1st')

    act(() => vi.advanceTimersByTime(CHANGE_VISIBLE_MS))

    expect(screen.queryByText('+2')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows a red −N chip when a spectator moves their vote away', () => {
    mount(battlingRoom([standing('a', 'Ana', 2, 0, 1), standing('b', 'Ben', 1, 0, 2)]))

    push(battlingRoom([standing('a', 'Ana', 2, 0, 1), standing('b', 'Ben', 1, 0, 1), standing('c', 'Cy', 0, 0, 3)]))
    push(battlingRoom([standing('a', 'Ana', 1, 0, 1), standing('b', 'Ben', 1, 0, 1), standing('c', 'Cy', 0, 0, 3)]))

    const chip = within(rowOf('Ana')).getByText('−2')
    expect(chip.dataset.delta).toBe('down')
    expect(chip.className).toContain('rose')
    expect(liveRegion().textContent).toBe('Ana −2, now 1st')
  })

  it('ignores a repeated room payload with the same scores', () => {
    mount(battlingRoom([standing('a', 'Ana', 1, 0, 1)]))
    push(battlingRoom([standing('a', 'Ana', 2, 0, 1)]))
    expect(within(rowOf('Ana')).getByText('+2')).toBeTruthy()

    push(battlingRoom([standing('a', 'Ana', 2, 0, 1)]))
    expect(within(rowOf('Ana')).getByText('+2')).toBeTruthy()
    expect(liveRegion().textContent).toBe('Ana +2, now 1st')
  })

  it('starts a new baseline for another battle (rematch) and ignores other rooms', () => {
    mount(battlingRoom([standing('a', 'Ana', 3, 0, 1)]))

    push(battlingRoom([standing('a', 'Ana', 0, 0, 1)], 'b2'))
    expect(screen.queryByText(/^[+−]\d/)).toBeNull()

    act(() => useScoreboardStore.getState().applyStandings('b2', [standing('a', 'Ana', 0, 0, 1)]))
    useRoomStore.getState().receiveRoom(battlingRoom([standing('a', 'Ana', 9, 0, 1)], 'b2', 'OTHER1'))
    expect(screen.queryByText(/^[+−]\d/)).toBeNull()
  })

  it('marks the viewer’s own row', () => {
    useAuthStore.setState({ identity: { id: 'a', displayName: 'Ana' } })
    mount(battlingRoom([standing('a', 'Ana', 0, 0, 1), standing('b', 'Ben', 0, 0, 1)]))

    expect(within(rowOf('Ana')).getByText('(you)')).toBeTruthy()
    expect(within(rowOf('Ben')).queryByText('(you)')).toBeNull()
  })
})
