import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Battle, Room, Standing } from '../../../shared/types'
import type { MatchRecord } from '../api/matchesApi'
import { MatchResults } from './MatchResults'

const { httpGet } = vi.hoisted(() => ({ httpGet: vi.fn() }))
vi.mock('../../../shared/api/httpClient', () => ({ httpClient: { get: httpGet } }))

const standing = (dancerId: string, displayName: string, votes: number, wordsWon: number, rank: number): Standing => ({
  dancerId,
  displayName,
  votes,
  wordsWon,
  score: 2 * votes + wordsWon,
  rank,
})

function finishedRoom(battle: Partial<Battle> = {}): Room {
  const dancers = [
    { id: 'a', displayName: 'Ana', role: 'dancer' as const },
    { id: 'b', displayName: 'Ben', role: 'dancer' as const },
  ]
  return {
    code: 'ROOM01',
    hostId: 'a',
    players: dancers,
    dancers,
    spectators: [],
    status: 'finished',
    battle: {
      id: 'b1',
      roomCode: 'ROOM01',
      dancerIds: ['a', 'b'],
      song: null,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:03:00.000Z',
      result: null,
      ...battle,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const cells = (row: HTMLElement) => [...row.querySelectorAll('td')].map((cell) => cell.textContent)
const podium = () => within(screen.getByRole('list', { name: 'Podium' })).getAllByRole('listitem')

beforeEach(() => {
  httpGet.mockReset()
})

describe('MatchResults', () => {
  it('shows the podium, the full table with the gap to the winner, and highlights the winner', () => {
    const standings = [
      standing('c', 'Cy', 3, 1, 1),
      standing('a', 'Ana', 2, 1, 2),
      standing('b', 'Ben', 1, 0, 3),
      standing('d', 'Dee', 0, 1, 4),
    ]
    render(<MatchResults room={finishedRoom({ result: { standings, winnerId: 'c' }, endReason: 'song-end' })} myId="a" />)

    expect(screen.getByText('Winner: Cy')).toBeTruthy()
    expect(screen.getByText('The song ended')).toBeTruthy()
    expect(podium().map((item) => item.textContent)).toEqual(['1stCy7 pts', '2ndAna(you)5 pts', '3rdBen2 pts'])
    expect(tableRows().map(cells)).toEqual([
      ['1st', 'Cy', '3', '1', '7', 'Leader'],
      ['2nd', 'Ana(you)', '2', '1', '5', '−2 pts'],
      ['3rd', 'Ben', '1', '0', '2', '−5 pts'],
      ['4th', 'Dee', '0', '1', '1', '−6 pts'],
    ])
    expect(tableRows().map((row) => row.dataset.winner)).toEqual(['true', 'false', 'false', 'false'])
    expect(podium().map((item) => item.dataset.winner)).toEqual(['true', 'false', 'false'])
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('announces a tie and highlights every tied leader', () => {
    const standings = [standing('a', 'Ana', 1, 0, 1), standing('b', 'Ben', 1, 0, 1)]
    render(
      <MatchResults
        room={finishedRoom({ result: { standings, winnerId: null }, endReason: 'not-enough-dancers' })}
        myId={null}
      />,
    )

    expect(screen.getByText('It is a tie!')).toBeTruthy()
    expect(screen.queryByText(/Winner:/)).toBeNull()
    expect(screen.getByText('Not enough dancers left')).toBeTruthy()
    expect(tableRows().map((row) => row.dataset.winner)).toEqual(['true', 'true'])
    expect(tableRows().map((row) => cells(row)[5])).toEqual(['Leader', 'Leader'])
  })

  it('rebuilds the ranking from the legacy scores, naming a dancer who left from the roster', () => {
    const room = finishedRoom({
      roster: [
        { id: 'a', displayName: 'Alice' },
        { id: 'b', displayName: 'Bob' },
      ],
      result: { scores: { a: 9, b: 8, gone: 1 }, winnerId: 'a' },
    })
    room.players = [{ id: 'b', displayName: 'Bob', role: 'dancer' }]
    render(<MatchResults room={room} myId={null} />)

    expect(screen.getByText('Winner: Alice')).toBeTruthy()
    expect(tableRows().map((row) => cells(row).slice(0, 2))).toEqual([
      ['1st', 'Alice'],
      ['2nd', 'Bob'],
      ['3rd', 'Former dancer'],
    ])
  })

  it('falls back to the results endpoint when the room carries no standings (after a refresh)', async () => {
    const match: MatchRecord = {
      id: 'b1',
      winnerPlayerId: 'b',
      endReason: 'song-end',
      participants: [
        { playerId: 'a', displayName: 'Ana', role: 'dancer', votes: 0, wordsWon: 2, score: 2, rank: 2 },
        { playerId: 'b', displayName: 'Ben', role: 'dancer', votes: 2, wordsWon: 0, score: 4, rank: 1 },
        { playerId: 's', displayName: 'Spec', role: 'spectator', votes: 0, wordsWon: 0, score: 0, rank: 0 },
      ],
    }
    httpGet.mockResolvedValue(match)
    render(<MatchResults room={finishedRoom()} myId={null} />)

    expect(screen.getByText('Loading the results...')).toBeTruthy()
    expect(await screen.findByText('Winner: Ben')).toBeTruthy()
    expect(httpGet).toHaveBeenCalledWith('/api/matches/b1', expect.objectContaining({ signal: expect.anything() }))
    expect(tableRows().map((row) => cells(row).slice(0, 2))).toEqual([
      ['1st', 'Ben'],
      ['2nd', 'Ana'],
    ])
    expect(screen.getByText('The song ended')).toBeTruthy()
  })

  it('says so when the results endpoint cannot be reached', async () => {
    httpGet.mockRejectedValue(new Error('offline'))
    render(<MatchResults room={finishedRoom()} myId={null} />)

    expect(await screen.findByText('The results could not be loaded.')).toBeTruthy()
  })

  it('renders the actions it is given', () => {
    render(
      <MatchResults
        room={finishedRoom({ result: { standings: [standing('a', 'Ana', 0, 0, 1)], winnerId: 'a' } })}
        myId={null}
        actions={<button type="button">Leave room</button>}
      />,
    )

    expect(screen.getByRole('button', { name: 'Leave room' })).toBeTruthy()
  })
})
