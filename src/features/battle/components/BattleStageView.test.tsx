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

  it('shows the song panels right after the song video and before the camera tiles', () => {
    render(
      <BattleStageView
        roomCode="ROOM01"
        room={null}
        error={null}
        dancerVideos={[video('a'), video('b')]}
        cameraPrompt={null}
        wordRace={null}
        wordWins={{}}
        onLeave={() => {}}
        songVideo={<p>Song video</p>}
        songPanels={<p>Vote panel</p>}
      />,
    )

    const follows = (earlier: HTMLElement, later: HTMLElement) =>
      Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING)
    const panels = screen.getByText('Vote panel')
    expect(follows(screen.getByText('Song video'), panels)).toBe(true)
    expect(follows(panels, screen.getAllByRole('figure')[0])).toBe(true)
  })

  it('renders no panel slot where the page has a sidebar', () => {
    renderStage([video('a')])

    const cameras = screen.getByRole('figure').parentElement as HTMLElement
    // Only the song area and the cameras share the grid.
    expect(cameras.parentElement?.children).toHaveLength(2)
  })

  it('splits the song and the cameras side by side only from xl, and adds no gutter of its own', () => {
    const { container } = renderStage([video('a')])

    const cameras = screen.getByRole('figure').parentElement as HTMLElement
    const grid = cameras.parentElement as HTMLElement
    expect(grid.className).toContain('xl:grid-cols-')
    expect(grid.className).not.toContain('lg:grid-cols-')
    expect(cameras.className).toContain('xl:grid-cols-1')
    // The page owns the gutter: a second padding here wasted width on phones.
    expect((container.firstElementChild as HTMLElement).className).not.toMatch(/(^|\s)(sm:)?p-\d/)
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

  it('swaps the stage footer for the results dashboard, which carries its own leave button', () => {
    const { rerender } = renderStage([], {}, roomWith({}))
    expect(screen.getByRole('button', { name: 'Leave room' })).toBeTruthy()

    rerender(
      <BattleStageView
        roomCode="ROOM01"
        room={roomWith({}, 'finished')}
        error={null}
        dancerVideos={[]}
        cameraPrompt={null}
        wordRace={null}
        wordWins={{}}
        onLeave={() => {}}
        results={<p>Results dashboard</p>}
      />,
    )
    expect(screen.getByText('Results dashboard')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Leave room' })).toBeNull()
  })
})
