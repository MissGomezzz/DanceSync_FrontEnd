import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room, SongSelection } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../../rooms/store/roomStore'
import { SongSelectionPanel } from './SongSelectionPanel'

const { emitWithAck } = vi.hoisted(() => ({ emitWithAck: vi.fn() }))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const NOW = new Date('2026-01-01T00:00:00.000Z')
const PHRASE = 'dale play'

function selection(overrides: Partial<SongSelection> = {}): SongSelection {
  return {
    phase: 'typing',
    challenge: {
      id: 'c1',
      phrase: PHRASE,
      startedAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 15_000).toISOString(),
    },
    participantIds: ['me', 'rival'],
    failedIds: [],
    chooserId: null,
    chooserReason: null,
    songOptions: [
      { id: 'song-1', title: 'Dance Monkey', artist: 'Tones and I', durationSeconds: 209 },
      { id: 'song-2', title: 'Bailando', artist: 'Enrique Iglesias', durationSeconds: 243 },
    ],
    ...overrides,
  }
}

function room(songSelection: SongSelection | null, hostId = 'me'): Room {
  return {
    code: 'ROOM01',
    hostId,
    players: [
      { id: 'me', displayName: 'Me', role: 'dancer' },
      { id: 'rival', displayName: 'Rival', role: 'dancer' },
      { id: 'fan', displayName: 'Fan', role: 'spectator' },
    ],
    dancers: null,
    spectators: [{ id: 'fan', displayName: 'Fan', role: 'spectator' }],
    status: 'waiting',
    battle: null,
    songSelection,
    selectedSong: null,
    createdAt: NOW.toISOString(),
  }
}

function renderAs(playerId: string, value: Room) {
  useAuthStore.setState({ identity: { id: playerId, displayName: playerId } })
  useRoomStore.setState({ room: value, error: null })
  return render(<SongSelectionPanel room={value} />)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
  emitWithAck.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Escenario 1: visualización de la palabra o frase', () => {
  it('el anfitrión inicia el minijuego desde el lobby', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    emitWithAck.mockResolvedValue(room(selection()))
    renderAs('me', room(null))
    await user.click(screen.getByRole('button', { name: 'Start song challenge' }))
    expect(emitWithAck).toHaveBeenCalledWith('song-challenge:start', { roomCode: 'ROOM01', requesterId: 'me' })
  })

  it('muestra la frase, el temporizador y un campo de texto con el foco', () => {
    renderAs('me', room(selection()))
    expect(screen.getByTestId('challenge-phrase')).toHaveProperty('textContent', PHRASE)
    expect(screen.getByRole('timer').textContent).toBe('15s')
    const input = screen.getByRole('textbox', { name: 'Type the phrase' })
    expect(input).toHaveProperty('disabled', false)
    expect(document.activeElement).toBe(input)
  })

  it('los espectadores ven la frase pero no pueden escribir', () => {
    renderAs('fan', room(selection()))
    expect(screen.getByTestId('challenge-phrase').textContent).toBe(PHRASE)
    expect(screen.getByRole('textbox')).toHaveProperty('disabled', true)
    expect(screen.getByRole('status').textContent).toMatch(/Only dancers/)
  })
})

describe('Escenario 2: escritura exitosa y elección de la canción', () => {
  it('envía la frase al presionar Enter', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    emitWithAck.mockResolvedValue({ room: room(selection({ phase: 'choosing', chooserId: 'me' })), outcome: 'accepted' })
    renderAs('me', room(selection()))
    await user.type(screen.getByRole('textbox'), `${PHRASE}{Enter}`)
    expect(emitWithAck).toHaveBeenCalledWith('song-challenge:submit', { roomCode: 'ROOM01', playerId: 'me', text: PHRASE })
    expect(useRoomStore.getState().room?.songSelection?.chooserId).toBe('me')
  })

  it('el ganador ve las canciones y puede elegir una', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    emitWithAck.mockResolvedValue(room(selection({ phase: 'done', chooserId: 'me' })))
    renderAs('me', room(selection({ phase: 'choosing', chooserId: 'me', chooserReason: 'typed' })))
    expect(screen.getByText('You won! Choose the song to dance')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Bailando/ }))
    expect(emitWithAck).toHaveBeenCalledWith('song:choose', { roomCode: 'ROOM01', playerId: 'me', songId: 'song-2' })
  })

  it('los demás jugadores ven quién está eligiendo y no ven botones', () => {
    renderAs('rival', room(selection({ phase: 'choosing', chooserId: 'me', chooserReason: 'typed' })))
    expect(screen.getByText('Me is choosing the song...')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Bailando/ })).toBeNull()
  })
})

describe('Escenario 3: escritura incorrecta o tiempo agotado', () => {
  it('tras una ortografía incorrecta el campo se bloquea y se explica que el turno pasa', () => {
    renderAs('me', room(selection({ failedIds: ['me'] })))
    expect(screen.getByRole('textbox')).toHaveProperty('disabled', true)
    expect(screen.getByRole('status').textContent).toMatch(/Incorrect phrase/)
  })

  it('cuando el temporizador llega a cero ya no se puede escribir', () => {
    renderAs('me', room(selection()))
    act(() => vi.advanceTimersByTime(15_100))
    expect(screen.getByRole('timer').textContent).toBe('0s')
    expect(screen.getByRole('textbox')).toHaveProperty('disabled', true)
    expect(screen.getByRole('status').textContent).toMatch(/Time's up/)
  })

  it('indica por qué otro jugador recibió el turno', () => {
    renderAs('rival', room(selection({ phase: 'choosing', chooserId: 'rival', chooserReason: 'timeout' })))
    expect(screen.getByText(/because time ran out/)).toBeTruthy()
  })
})

describe('Escenario 4: retroalimentación visual en tiempo real', () => {
  const statuses = () =>
    Array.from(screen.getByTestId('challenge-phrase').children, (el) => (el as HTMLElement).dataset.status![0]).join('')

  it('resalta caracteres correctos, incorrectos y pendientes mientras se escribe', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAs('me', room(selection()))
    const input = screen.getByRole('textbox')

    await user.type(input, 'dal')
    expect(statuses()).toBe('cccpppppp')
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(screen.getByText(/3 \/ 9 correct characters/)).toBeTruthy()

    await user.type(input, 'x')
    expect(statuses()).toBe('cccippppp')
    expect(input.getAttribute('aria-invalid')).toBe('true')

    await user.type(input, '{Backspace}e play')
    expect(statuses()).toBe('ccccccccc')
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })

  it('no permite pegar la frase', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAs('me', room(selection()))
    const input = screen.getByRole('textbox')
    input.focus()
    await user.paste(PHRASE)
    expect(input).toHaveProperty('value', '')
  })
})

describe('submission feedback and in-flight guards', () => {
  it('tells the dancer their attempt was used when the server rejects the phrase', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    emitWithAck.mockResolvedValue({ room: room(selection({ failedIds: ['me'] })), outcome: 'incorrect' })
    renderAs('me', room(selection()))
    await user.type(screen.getByRole('textbox'), 'dale plai{Enter}')
    expect(screen.getByRole('status').textContent).toMatch(/Not quite — you used your attempt/)
  })

  it('says time is up when the phrase arrives after the countdown', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    emitWithAck.mockResolvedValue({ room: room(selection()), outcome: 'expired' })
    renderAs('me', room(selection()))
    await user.type(screen.getByRole('textbox'), `${PHRASE}{Enter}`)
    expect(screen.getByRole('status').textContent).toMatch(/Time's up/)
  })

  it('sends one song pick and disables the songs until the server answers', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    emitWithAck.mockReturnValue(new Promise(() => {}))
    renderAs('me', room(selection({ phase: 'choosing', chooserId: 'me', chooserReason: 'typed' })))
    await user.click(screen.getByRole('button', { name: /Bailando/ }))
    await user.click(screen.getByRole('button', { name: /Dance Monkey/ }))
    expect(emitWithAck).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Dance Monkey/ })).toHaveProperty('disabled', true)
  })
})
