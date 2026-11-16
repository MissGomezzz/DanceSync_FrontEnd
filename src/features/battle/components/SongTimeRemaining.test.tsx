import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Battle } from '../../../shared/types'
import { SongTimeRemaining } from './SongTimeRemaining'

function battle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 'b1',
    roomCode: 'ROOM01',
    dancerIds: ['a', 'b'],
    song: { id: 's1', title: 'Song', artist: 'Artist', durationSeconds: 120 },
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    result: null,
    endsInMs: 90_000,
    ...overrides,
  }
}

const clock = () => screen.getByRole('timer')
const barWidth = () => screen.getByTestId('song-time-bar').style.width

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
})

afterEach(() => vi.useRealTimers())

describe('SongTimeRemaining', () => {
  it("shows the time left from the server's endsInMs, with a bar for the share of the song", () => {
    render(<SongTimeRemaining battle={battle()} />)

    expect(clock().textContent).toBe('Song time: 1:30 left')
    expect(barWidth()).toBe('75%')
  })

  it('counts down on the local monotonic clock, whatever the wall clock says', () => {
    // A device whose wall clock is a day off still counts the same 90 s.
    vi.setSystemTime(new Date('2030-06-01T12:00:00.000Z'))
    render(<SongTimeRemaining battle={battle()} />)

    act(() => vi.advanceTimersByTime(30_000))

    expect(clock().textContent).toBe('Song time: 1:00 left')
    expect(barWidth()).toBe('50%')
  })

  it('re-anchors on every room payload the server sends', () => {
    const { rerender } = render(<SongTimeRemaining battle={battle()} />)
    act(() => vi.advanceTimersByTime(10_000))
    expect(clock().textContent).toBe('Song time: 1:20 left')

    rerender(<SongTimeRemaining battle={battle({ endsInMs: 45_000 })} />)

    expect(clock().textContent).toBe('Song time: 0:45 left')
  })

  it('turns red for the last seconds and says the song is ending at zero', () => {
    render(<SongTimeRemaining battle={battle({ endsInMs: 12_000 })} />)
    expect(clock().className).toContain('text-ink-muted')

    act(() => vi.advanceTimersByTime(2_500))
    expect(clock().textContent).toBe('Song time: 0:10 left')
    expect(clock().className).toContain('text-rose-700')
    expect(screen.getByTestId('song-time-bar').className).toContain('bg-rose-500')

    act(() => vi.advanceTimersByTime(20_000))
    expect(clock().textContent).toBe('Song ending…')
    expect(barWidth()).toBe('0%')
  })

  it('never shows more than the length of the song while the start countdown runs', () => {
    render(<SongTimeRemaining battle={battle({ endsInMs: 125_000 })} />)

    expect(clock().textContent).toBe('Song time: 2:00 left')
    expect(barWidth()).toBe('100%')
  })

  it('shows the label without a bar when the song is unknown', () => {
    render(<SongTimeRemaining battle={battle({ song: null })} />)

    expect(clock().textContent).toBe('Song time: 1:30 left')
    expect(screen.queryByTestId('song-time-bar')).toBeNull()
  })

  it.each([
    ['there is no running battle', null],
    ['the server sends no deadline', battle({ endsInMs: undefined })],
    ['the battle has no deadline', battle({ endsInMs: null })],
  ])('shows nothing when %s', (_label, current) => {
    render(<SongTimeRemaining battle={current} />)
    expect(screen.queryByRole('timer')).toBeNull()
  })
})
