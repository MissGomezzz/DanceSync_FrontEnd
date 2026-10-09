import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LeaveRoomButton } from './LeaveRoomButton'

describe('LeaveRoomButton', () => {
  it('turns into a red, disabled "Leaving…" button once pressed and leaves only once', async () => {
    const user = userEvent.setup()
    const onLeave = vi.fn()
    render(<LeaveRoomButton onLeave={onLeave} />)

    const button = screen.getByRole('button', { name: 'Leave room' })
    expect(button.className).not.toContain('rose')

    await user.click(button)
    await user.click(button)

    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(button.textContent).toBe('Leaving…')
    expect(button).toHaveProperty('disabled', true)
    expect(button.dataset.leaving).toBe('true')
    expect(button.className).toContain('bg-rose-700')
  })
})
