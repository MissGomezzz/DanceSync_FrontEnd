import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnectionStore } from '../../lib/connectionStatus'
import { ConnectionBanner } from './ConnectionBanner'

beforeEach(() => {
  useConnectionStore.setState({ status: 'connected', blockedUntil: null, slowDownUntil: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ConnectionBanner', () => {
  it('shows nothing while connected and nothing was dropped', () => {
    const { container } = render(<ConnectionBanner status="connected" />)
    expect(container.innerHTML).toBe('')
  })

  it('keeps the usual notices while connecting or reconnecting', () => {
    const { rerender } = render(<ConnectionBanner status="connecting" />)
    expect(screen.getByRole('status').textContent).toContain('Connecting to the server...')
    rerender(<ConnectionBanner status="disconnected" />)
    expect(screen.getByRole('status').textContent).toContain('Reconnecting to the server...')
  })

  it('asks the user to slow down when the server dropped some events (SEG-3)', () => {
    act(() => useConnectionStore.getState().setSlowDown(4000))
    render(<ConnectionBanner status="connected" />)
    expect(screen.getByRole('status').textContent).toContain('You are going too fast')
  })

  it('counts down the seconds while the server refuses this client (SEG-3)', () => {
    act(() => useConnectionStore.getState().setBlocked(12_000))
    render(<ConnectionBanner status="blocked" />)
    expect(screen.getByRole('status').textContent).toContain('You can continue in 12 s.')
  })

  it('says it is reconnecting once the block is over', () => {
    act(() => useConnectionStore.getState().setBlocked(0))
    render(<ConnectionBanner status="blocked" />)
    expect(screen.getByRole('status').textContent).toContain('Reconnecting to the server...')
  })
})
