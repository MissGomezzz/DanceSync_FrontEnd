import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown, useServerDeadline, useServerTime } from './useCountdown'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
})

afterEach(() => vi.useRealTimers())

describe('useCountdown', () => {
  it('counts down to the deadline and stops at zero', () => {
    const deadline = performance.now() + 1_000
    const { result } = renderHook(() => useCountdown(deadline))
    expect(result.current).toBe(1_000)

    act(() => vi.advanceTimersByTime(400))
    expect(result.current).toBe(600)

    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current).toBe(0)
  })

  it('is zero without a deadline, and restarts from a new one at once', () => {
    const { result, rerender } = renderHook(({ deadline }: { deadline: number | null }) => useCountdown(deadline), {
      initialProps: { deadline: null as number | null },
    })
    expect(result.current).toBe(0)

    act(() => vi.advanceTimersByTime(2_000))
    rerender({ deadline: performance.now() + 3_000 })

    expect(result.current).toBe(3_000)
  })
})

describe('useServerDeadline', () => {
  it('turns the server\'s "time left" into a local deadline when the payload arrives', () => {
    const { result } = renderHook(() => useServerDeadline(40_000, { id: 'battle' }))
    expect(result.current).toBe(performance.now() + 40_000)
  })

  it('anchors on the moment the payload was first seen, also for a hook that mounts later', () => {
    const payload = { id: 'battle' }
    const first = renderHook(() => useServerDeadline(40_000, payload))
    const deadline = first.result.current

    // A panel that mounts 10 s later (the layout changed) reads the same payload:
    // its 40 s were counted from the arrival, so 30 s are left, not 40.
    act(() => vi.advanceTimersByTime(10_000))
    const late = renderHook(() => useCountdown(useServerDeadline(40_000, payload)))

    expect(late.result.current).toBe(30_000)
    expect(first.result.current).toBe(deadline)
  })

  it('re-anchors when a new payload arrives', () => {
    const { result, rerender } = renderHook(
      ({ leftMs, payload }: { leftMs: number; payload: object }) => useServerDeadline(leftMs, payload),
      { initialProps: { leftMs: 40_000, payload: { version: 1 } as object } },
    )
    const first = result.current

    act(() => vi.advanceTimersByTime(10_000))
    rerender({ leftMs: 25_000, payload: { version: 2 } })

    expect(result.current).toBe(performance.now() + 25_000)
    expect(result.current).not.toBe(first)
  })

  it('anchors a payload that is not an object on the moment the hook mounts', () => {
    renderHook(() => useServerDeadline(5_000, 'challenge-1'))
    act(() => vi.advanceTimersByTime(2_000))

    const { result } = renderHook(() => useServerDeadline(5_000, 'challenge-1'))

    expect(result.current).toBe(performance.now() + 5_000)
  })

  it('is null when the server sent no deadline, and "now" for one that already passed', () => {
    expect(renderHook(() => useServerDeadline(null, { id: 'a' })).result.current).toBeNull()
    expect(renderHook(() => useServerDeadline(-3_000, { id: 'b' })).result.current).toBe(performance.now())
  })

  it('falls back to the absolute date only when the relative value is missing', () => {
    const expiresAt = new Date(Date.now() + 8_000).toISOString()

    const { result } = renderHook(() => useServerDeadline(undefined, { id: 'c' }, expiresAt))
    expect(result.current).toBeCloseTo(performance.now() + 8_000, 0)

    expect(renderHook(() => useServerDeadline(undefined, { id: 'd' }, 'not a date')).result.current).toBeNull()
  })
})

describe('useServerTime', () => {
  it('places a moment that already happened in the past of the local clock', () => {
    const { result } = renderHook(() => useServerTime(-30_000, { id: 'battle' }))
    expect(result.current).toBe(performance.now() - 30_000)
  })

  it('is null when nothing is known about the moment', () => {
    expect(renderHook(() => useServerTime(undefined, null)).result.current).toBeNull()
  })
})
