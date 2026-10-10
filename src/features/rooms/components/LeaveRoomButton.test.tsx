import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEAVE_FEEDBACK_MS, LeaveRoomButton } from './LeaveRoomButton'

describe('LeaveRoomButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a red, disabled "Leaving…" state first and leaves once after the feedback delay', () => {
    const onLeave = vi.fn()
    render(<LeaveRoomButton onLeave={onLeave} />)

    const button = screen.getByRole('button', { name: 'Leave room' })
    expect(button.className).not.toContain('rose')

    fireEvent.click(button)
    fireEvent.click(button)

    expect(button.textContent).toBe('Leaving…')
    expect(button).toHaveProperty('disabled', true)
    expect(button.dataset.leaving).toBe('true')
    expect(button.className).toContain('bg-rose-700')
    expect(onLeave).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(LEAVE_FEEDBACK_MS))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('still leaves right away when it unmounts during the delay', () => {
    const onLeave = vi.fn()
    const { unmount } = render(<LeaveRoomButton onLeave={onLeave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }))
    unmount()

    expect(onLeave).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(LEAVE_FEEDBACK_MS))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
