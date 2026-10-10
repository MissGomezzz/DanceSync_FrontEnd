import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useServerTime } from '../../../shared/hooks/useCountdown'
import type { Battle } from '../../../shared/types'
import { DANCE_CUE_MS, StartCountdown } from './StartCountdown'

function battleWith(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 'b1',
    roomCode: 'ROOM01',
    dancerIds: ['me', 'rival'],
    song: { id: 's1', title: 'Song', artist: 'Artist', durationSeconds: 120, youtubeId: 'yt1' },
    startedAt: '2026-01-01T00:00:05.000Z',
    finishedAt: null,
    result: null,
    startsInMs: 5_000,
    ...overrides,
  }
}

/** Anchors startsInMs the way BattleStage does for the song player. */
function Harness({ battle }: { battle: Battle | null }) {
  const startAt = useServerTime(battle?.startsInMs, battle, battle?.startedAt ?? null)
  return <StartCountdown battle={battle} startAt={startAt} />
}

const shown = () => screen.queryByRole('status')?.textContent ?? null
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StartCountdown', () => {
  it('counts "Get ready", 3, 2, 1 and "Dance!" down to the song start, then disappears', () => {
    render(<Harness battle={battleWith({ startsInMs: 5_000 })} />)
    const layer = screen.getByTestId('start-countdown')
    // Portalled to the body, over the whole page.
    expect(layer.parentElement).toBe(document.body)
    expect(shown()).toBe('Get ready')

    advance(1_900)
    expect(shown()).toBe('Get ready')
    advance(200) // 2.9 s left
    expect(shown()).toBe('3')
    advance(1_000)
    expect(shown()).toBe('2')
    advance(1_000)
    expect(shown()).toBe('1')
    advance(1_000) // the song has just started
    expect(shown()).toBe('Dance!')
    advance(DANCE_CUE_MS)
    expect(screen.queryByTestId('start-countdown')).toBeNull()

    // Later room payloads of the same battle do not bring it back.
    advance(5_000)
    expect(screen.queryByTestId('start-countdown')).toBeNull()
  })

  it('keeps counting to the same deadline when a new room payload re-anchors it', () => {
    const { rerender } = render(<Harness battle={battleWith({ startsInMs: 5_000 })} />)
    advance(3_000)
    // A vote update 3 s later: the server now says 2 s to go.
    rerender(<Harness battle={battleWith({ startsInMs: 2_000 })} />)
    expect(shown()).toBe('2')
    advance(2_000)
    expect(shown()).toBe('Dance!')
  })

  it('shows nothing when the battle already started (a refresh mid-battle)', () => {
    render(<Harness battle={battleWith({ startsInMs: -200 })} />)
    expect(screen.queryByTestId('start-countdown')).toBeNull()
  })

  it('shows nothing at the exact start or without a running battle', () => {
    const { rerender } = render(<Harness battle={battleWith({ startsInMs: 0 })} />)
    expect(screen.queryByTestId('start-countdown')).toBeNull()
    // BattleStage passes null once the room is finished (or not battling).
    rerender(<Harness battle={null} />)
    expect(screen.queryByTestId('start-countdown')).toBeNull()
  })

  it('closes when the battle finishes during the countdown', () => {
    const { rerender } = render(<Harness battle={battleWith()} />)
    expect(shown()).toBe('Get ready')
    rerender(<Harness battle={null} />)
    expect(screen.queryByTestId('start-countdown')).toBeNull()
  })

  it('ignores a skewed wall clock', () => {
    // This device's clock runs 90 s ahead of the server: only startsInMs matters.
    vi.setSystemTime(Date.now() + 90_000)
    render(<Harness battle={battleWith({ startsInMs: 5_000 })} />)
    expect(shown()).toBe('Get ready')
    advance(2_100)
    expect(shown()).toBe('3')
  })
})
