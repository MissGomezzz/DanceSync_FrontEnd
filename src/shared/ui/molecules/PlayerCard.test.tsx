import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Player } from '../../types'
import { PlayerCard } from './PlayerCard'

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 'ana',
  displayName: 'Ana',
  role: 'dancer',
  ...overrides,
})

describe('PlayerCard', () => {
  it.each([
    ['dancer', 'Dancer'],
    ['spectator', 'Spectator'],
    ['undecided', 'Choosing role'],
  ] as const)('labels the %s role as "%s"', (role, label) => {
    render(<PlayerCard player={player({ role })} />)

    expect(screen.getByText(label)).toBeTruthy()
    // The wire value never reaches the screen.
    expect(screen.queryByText(role)).toBeNull()
  })

  it('shows the ready state and marks the host', () => {
    const { rerender } = render(<PlayerCard player={player()} />)
    expect(screen.getByText('Not ready')).toBeTruthy()
    expect(screen.queryByText('Host')).toBeNull()

    rerender(<PlayerCard player={player({ ready: true })} isHost />)
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByText('Host')).toBeTruthy()
  })

  it('renders the actions after the badges', () => {
    render(<PlayerCard player={player()} actions={<button type="button">Remove</button>} />)

    const remove = screen.getByRole('button', { name: 'Remove' })
    expect(remove.previousElementSibling?.textContent).toBe('Dancer')
  })

  it('wraps on a narrow screen and truncates a long name instead of overflowing', () => {
    const longName = 'Maximiliano Alejandro de la Fuente'
    render(<PlayerCard player={player({ displayName: longName })} />)

    const name = screen.getByText(longName)
    expect(name.className).toContain('truncate')
    expect(name.className).toContain('min-w-0')
    // The full name stays reachable when it is cut.
    expect(name.getAttribute('title')).toBe(longName)
    expect(name.parentElement?.className).toContain('flex-wrap')
  })
})
