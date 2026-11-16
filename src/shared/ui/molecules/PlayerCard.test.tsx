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

  it('renders the actions after the badges, at the right end of their row', () => {
    render(<PlayerCard player={player()} actions={<button type="button">Remove</button>} />)

    const actions = screen.getByRole('button', { name: 'Remove' }).parentElement as HTMLElement
    expect(actions.previousElementSibling?.textContent).toBe('Dancer')
    // Pushed to the end when the badges row wraps under the name and takes the full width.
    expect(actions.className).toContain('ml-auto')
    expect((actions.parentElement as HTMLElement).className.split(' ')).toContain('grow')
  })

  it('adds no empty actions slot to a card without actions', () => {
    render(<PlayerCard player={player()} />)
    expect(screen.getByText('Dancer').nextElementSibling).toBeNull()
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
    // A tight gap between the name row and the wrapped badges row.
    expect(name.parentElement?.className.split(' ')).toContain('gap-y-1')
  })
})
