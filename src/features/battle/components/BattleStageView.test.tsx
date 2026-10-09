import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Player, Room } from '../../../shared/types'
import type { DancerVideo } from '../../camera/hooks/useBattleVideo'
import { BattleStageView } from './BattleStageView'

const dancer = (id: string): Player => ({ id, displayName: id.toUpperCase(), role: 'dancer' })

function video(id: string, isMe = false): DancerVideo {
  return { dancer: dancer(id), isMe, stream: null, placeholder: `Waiting for ${id}` }
}

function roomWith(battle: Partial<NonNullable<Room['battle']>>, status: Room['status'] = 'battling'): Room {
  const dancers = [dancer('a'), dancer('b')]
  return {
    code: 'ROOM01',
    hostId: 'a',
    players: dancers,
    dancers,
    spectators: [],
    status,
    battle: {
      id: 'b1',
      roomCode: 'ROOM01',
      dancerIds: ['a', 'b'],
      song: null,
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

function renderStage(dancerVideos: DancerVideo[], wordWins: Record<string, number> = {}, room: Room | null = null) {
  return render(
    <BattleStageView
      roomCode="ROOM01"
      room={room}
      error={null}
      dancerVideos={dancerVideos}
      cameraPrompt={null}
      wordRace={null}
      wordWins={wordWins}
      onLeave={() => {}}
    />,
  )
}

describe('BattleStageView', () => {
  it('renders one tile per dancer in a two-column grid that wraps', () => {
    renderStage([video('a'), video('b', true), video('c'), video('d')])

    const tiles = screen.getAllByRole('figure')
    expect(tiles).toHaveLength(4)
    expect(tiles.map((tile) => within(tile).getByText(/^[ABCD]$/).textContent)).toEqual(['A', 'B', 'C', 'D'])
    expect(tiles[0].parentElement?.className).toContain('sm:grid-cols-2')
  })

  it('mirrors only the local preview and shows each dancer their own word tally', () => {
    renderStage([video('a'), video('b', true), video('c')], { a: 2, b: 1, c: 0 })

    const [a, b, c] = screen.getAllByRole('figure')
    expect(within(a).getByLabelText('A camera').className).not.toContain('-scale-x-100')
    expect(within(b).getByLabelText('B camera').className).toContain('-scale-x-100')
    expect(within(c).getByLabelText('C camera').className).not.toContain('-scale-x-100')

    expect(within(a).getByText('2 words')).toBeTruthy()
    expect(within(b).getByText('1 word')).toBeTruthy()
    expect(within(b).getByText('you')).toBeTruthy()
    expect(within(c).getByText('0 words')).toBeTruthy()
  })

  it('shows the bonus each dancer has earned so far, and nothing for one without bonus', () => {
    renderStage([video('a'), video('b')], {}, roomWith({ bonusPoints: { a: 2, b: 0 } }))

    const [a, b] = screen.getAllByRole('figure')
    expect(within(a).getByText('+2 bonus')).toBeTruthy()
    expect(within(b).queryByText(/bonus/)).toBeNull()
  })

  it('breaks the final score down into base and bonus', () => {
    const finished = roomWith(
      { bonusPoints: { a: 1, b: 0 }, result: { scores: { a: 9, b: 8 }, winnerId: 'a' } },
      'finished',
    )
    renderStage([video('a'), video('b')], {}, finished)

    expect(screen.getByText('(incl. +1 bonus)')).toBeTruthy()
    expect(screen.getByText('Winner: A')).toBeTruthy()
  })

  it('says the battle is over instead of promising a video once it finished', () => {
    renderStage([], {}, roomWith({ result: null }, 'finished'))

    expect(screen.getByText('The battle is over.')).toBeTruthy()
    expect(screen.queryByText(/will appear when the battle starts/)).toBeNull()
  })

  it('says so when the battle song has no video', () => {
    const song = { id: 's1', title: 'Song', artist: 'Artist', durationSeconds: 90 }
    renderStage([], {}, roomWith({ song }))

    expect(screen.getByText('This song has no video.')).toBeTruthy()
  })

  it('keeps the winner who left the room in the result, named from the battle roster', () => {
    const finished = roomWith(
      {
        roster: [
          { id: 'a', displayName: 'Alice' },
          { id: 'b', displayName: 'Bob' },
        ],
        result: { scores: { a: 9, b: 8 }, winnerId: 'a' },
      },
      'finished',
    )
    // Alice left after the battle: she is no longer a player nor a dancer.
    finished.players = [dancer('b')]
    finished.dancers = [dancer('b')]
    renderStage([], {}, finished)

    expect(screen.getByText('Winner: Alice')).toBeTruthy()
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('9')).toBeTruthy()
  })

  it('falls back to "Former dancer" without a roster, and still announces a tie', () => {
    const finished = roomWith({ result: { scores: { a: 7, b: 7 }, winnerId: null } }, 'finished')
    finished.players = [dancer('b')]
    finished.dancers = [dancer('b')]
    renderStage([], {}, finished)

    expect(screen.getByText('Former dancer')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.getByText('It is a tie!')).toBeTruthy()
  })
})
