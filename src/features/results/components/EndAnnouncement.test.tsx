import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Battle, Room } from '../../../shared/types'
import { ANNOUNCEMENT_VISIBLE_MS, EndAnnouncement } from './EndAnnouncement'

function room(status: Room['status'], battle: Partial<Battle> = {}): Room {
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
    status,
    battle: {
      id: 'b1',
      roomCode: 'ROOM01',
      dancerIds: ['a', 'b'],
      song: null,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: status === 'finished' ? '2026-01-01T00:03:00.000Z' : null,
      result: null,
      ...battle,
    },
    songSelection: null,
    selectedSong: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const anaWins = { result: { winnerId: 'a', standings: [] }, endReason: 'song-end' as const }

afterEach(() => vi.useRealTimers())

describe('EndAnnouncement', () => {
  it('appears when the battle finishes, names the winner and the reason, and goes away after about 3 s', () => {
    vi.useFakeTimers()
    const { rerender } = render(<EndAnnouncement room={room('battling')} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    rerender(<EndAnnouncement room={room('finished', anaWins)} />)

    const dialog = screen.getByRole('dialog', { name: 'Battle over!' })
    expect(dialog.textContent).toContain('Ana wins!')
    expect(dialog.textContent).toContain('The song ended')

    act(() => vi.advanceTimersByTime(ANNOUNCEMENT_VISIBLE_MS))
    expect(screen.queryByRole('dialog')).toBeNull()

    // Another payload of the same finished battle does not announce it again.
    rerender(<EndAnnouncement room={room('finished', { ...anaWins, endReason: 'song-end' })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("says it's a draw when nobody won", () => {
    render(
      <EndAnnouncement room={room('finished', { result: { winnerId: null }, endReason: 'not-enough-dancers' })} />,
    )

    expect(screen.getByText("It's a draw")).toBeTruthy()
    expect(screen.getByText('Not enough dancers left')).toBeTruthy()
  })

  it('can be dismissed right away with the button or Escape', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<EndAnnouncement room={room('finished', anaWins)} />)

    await user.click(screen.getByRole('button', { name: 'See the results' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    rerender(<EndAnnouncement room={room('finished', { ...anaWins, id: 'b2' })} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
