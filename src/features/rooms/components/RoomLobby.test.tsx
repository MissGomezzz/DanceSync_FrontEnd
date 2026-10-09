import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../../../shared/types'
import { useAuthStore } from '../../auth/store/authStore'
import { useRoomStore } from '../store/roomStore'
import { RoomLobby } from './RoomLobby'

const { emitWithAck } = vi.hoisted(() => ({ emitWithAck: vi.fn() }))

vi.mock('../../../shared/lib/socket', () => ({
  emitWithAck,
  connectSocket: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn(), io: { on: vi.fn() } },
  SocketDomainError: class extends Error {},
}))

const NOW = '2026-01-01T00:00:00.000Z'

function lobby(overrides: Partial<Room> = {}): Room {
  return {
    code: 'ROOM01',
    hostId: 'me',
    players: [
      { id: 'me', displayName: 'Me', role: 'undecided' },
      { id: 'rival', displayName: 'Rival', role: 'dancer' },
    ],
    dancers: null,
    spectators: [],
    status: 'waiting',
    battle: null,
    songSelection: null,
    selectedSong: null,
    createdAt: NOW,
    ...overrides,
  }
}

/** Routes emitted events to per-event handlers; unknown events never answer. */
function serverAnswers(answers: Record<string, (payload: never) => Promise<unknown>>) {
  emitWithAck.mockImplementation((event: string, payload: never) => answers[event]?.(payload) ?? new Promise(() => {}))
}

function renderLobby() {
  return render(
    <MemoryRouter initialEntries={['/rooms/ROOM01']}>
      <Routes>
        <Route path="/rooms/:roomCode" element={<RoomLobby roomCode="ROOM01" />} />
        <Route path="/home" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  emitWithAck.mockReset()
  useAuthStore.setState({ identity: { id: 'me', displayName: 'Me' } })
  useRoomStore.setState({ room: null, error: null, joinError: null })
})

describe('joining the room', () => {
  it('turns "Joining room..." into an error with a retry when the join times out', async () => {
    const user = userEvent.setup()
    serverAnswers({
      'room:join': () => Promise.reject(new Error('The server did not respond. Check your connection.')),
    })
    renderLobby()

    expect(await screen.findByText('Cannot join room ROOM01')).toBeTruthy()
    expect(screen.getByText('The server did not respond. Check your connection.')).toBeTruthy()

    serverAnswers({ 'room:join': () => Promise.resolve(lobby()) })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findAllByText('Rival')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Cannot join room ROOM01')).toBeNull()
  })
})

describe('leaving the room', () => {
  it('goes home even when the server never answers the leave', async () => {
    const user = userEvent.setup()
    serverAnswers({ 'room:join': () => Promise.resolve(lobby()) })
    renderLobby()
    await screen.findAllByText('Rival')

    await user.click(screen.getByRole('button', { name: 'Leave room' }))

    expect(screen.getByText('Home page')).toBeTruthy()
    expect(emitWithAck).toHaveBeenCalledWith('room:leave', { roomCode: 'ROOM01', playerId: 'me' })
    expect(useRoomStore.getState().room).toBeNull()
  })
})

describe('choosing a role', () => {
  it('keeps both roles visible and lets the player switch while waiting', async () => {
    const user = userEvent.setup()
    let answerRole: (room: Room) => void = () => {}
    serverAnswers({
      'room:join': () => Promise.resolve(lobby()),
      'role:select': () => new Promise<Room>((resolve) => (answerRole = resolve)),
    })
    renderLobby()
    await screen.findAllByText('Rival')

    const dance = screen.getByRole('button', { name: 'Dance (camera required)' })
    const spectate = screen.getByRole('button', { name: 'Spectate' })
    expect(dance.getAttribute('aria-pressed')).toBe('false')
    expect(spectate.getAttribute('aria-pressed')).toBe('false')

    await user.click(dance)
    expect(emitWithAck).toHaveBeenCalledWith('role:select', { roomCode: 'ROOM01', playerId: 'me', role: 'dancer' })
    // Disabled while the server has not answered, so a double click sends one request.
    expect(dance).toHaveProperty('disabled', true)
    expect(spectate).toHaveProperty('disabled', true)
    await act(async () => answerRole(lobby({ players: [{ id: 'me', displayName: 'Me', role: 'dancer' }] })))

    expect(dance.getAttribute('aria-pressed')).toBe('true')
    expect(spectate).toHaveProperty('disabled', false)

    await user.click(spectate)
    expect(emitWithAck).toHaveBeenLastCalledWith('role:select', { roomCode: 'ROOM01', playerId: 'me', role: 'spectator' })
    await act(async () => answerRole(lobby({ players: [{ id: 'me', displayName: 'Me', role: 'spectator' }] })))

    expect(spectate.getAttribute('aria-pressed')).toBe('true')
    expect(dance.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('marking yourself ready', () => {
  it('turns ready on and off, locks the button while waiting and shows the state on the player card', async () => {
    const user = userEvent.setup()
    let answerReady: (room: Room) => void = () => {}
    serverAnswers({
      'room:join': () => Promise.resolve(lobby()),
      'player:ready': () => new Promise<Room>((resolve) => (answerReady = resolve)),
    })
    renderLobby()
    await screen.findAllByText('Rival')

    const button = screen.getByRole('button', { name: "I'm ready" })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    // Everyone, spectators included, must be ready: the copy is not about dancing.
    expect(screen.getByText('Mark yourself ready when you are ready to start.')).toBeTruthy()

    await user.click(button)
    expect(emitWithAck).toHaveBeenCalledWith('player:ready', { roomCode: 'ROOM01', playerId: 'me', ready: true })
    // Disabled while the server has not answered, so a double click sends one request.
    expect(button).toHaveProperty('disabled', true)
    await act(async () =>
      answerReady(
        lobby({
          players: [
            { id: 'me', displayName: 'Me', role: 'undecided', ready: true },
            { id: 'rival', displayName: 'Rival', role: 'dancer' },
          ],
        }),
      ),
    )

    expect(button.getAttribute('aria-pressed')).toBe('true')
    // The label stays put; only the pressed state tells it apart.
    expect(screen.getByRole('button', { name: "I'm ready" })).toBe(button)
    expect(button).toHaveProperty('disabled', false)
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0)

    await user.click(button)
    expect(emitWithAck).toHaveBeenLastCalledWith('player:ready', { roomCode: 'ROOM01', playerId: 'me', ready: false })
    await act(async () => answerReady(lobby()))

    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: "I'm ready" })).toBe(button)
    expect(screen.queryByText('Ready')).toBeNull()
  })

  it("shows another player's ready state when the server broadcasts it", async () => {
    serverAnswers({ 'room:join': () => Promise.resolve(lobby()) })
    renderLobby()
    await screen.findAllByText('Rival')
    expect(screen.queryByText('Ready')).toBeNull()

    act(() =>
      useRoomStore.getState().receiveRoom(
        lobby({
          players: [
            { id: 'me', displayName: 'Me', role: 'undecided' },
            { id: 'rival', displayName: 'Rival', role: 'dancer', ready: true },
          ],
        }),
      ),
    )

    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0)
  })
})

describe('starting the battle', () => {
  const twoDancers = (ready: { me: boolean; rival: boolean }, overrides: Partial<Room> = {}) =>
    lobby({
      players: [
        { id: 'me', displayName: 'Me', role: 'dancer', ready: ready.me },
        { id: 'rival', displayName: 'Rival', role: 'dancer', ready: ready.rival },
      ],
      ...overrides,
    })

  it('keeps "Start battle" disabled and names who is missing until everyone is ready', async () => {
    serverAnswers({ 'room:join': () => Promise.resolve(twoDancers({ me: true, rival: false })) })
    renderLobby()
    await screen.findAllByText('Rival')

    expect(screen.getByRole('button', { name: 'Start battle' })).toHaveProperty('disabled', true)
    expect(screen.getByText('Waiting for Rival to be ready.')).toBeTruthy()

    act(() => useRoomStore.getState().receiveRoom(twoDancers({ me: true, rival: true })))

    expect(screen.getByRole('button', { name: 'Start battle' })).toHaveProperty('disabled', false)
    expect(screen.queryByText(/Waiting for/)).toBeNull()
  })

  it('opens the song challenge first instead of starting the battle', async () => {
    const user = userEvent.setup()
    serverAnswers({
      'room:join': () => Promise.resolve(twoDancers({ me: true, rival: true })),
      'song-challenge:start': () => new Promise(() => {}),
    })
    renderLobby()
    await screen.findAllByText('Rival')

    await user.click(screen.getByRole('button', { name: 'Start battle' }))

    expect(emitWithAck).toHaveBeenCalledWith('song-challenge:start', { roomCode: 'ROOM01', requesterId: 'me' })
    expect(emitWithAck).not.toHaveBeenCalledWith('battle:start', expect.anything())
  })

  it('starts the battle directly when the song was already chosen', async () => {
    const user = userEvent.setup()
    const song = { id: 'song-1', title: 'Dance Monkey', artist: 'Tones and I', durationSeconds: 209 }
    serverAnswers({
      'room:join': () => Promise.resolve(twoDancers({ me: true, rival: true }, { selectedSong: song })),
      'battle:start': () => new Promise(() => {}),
    })
    renderLobby()
    await screen.findAllByText('Rival')

    await user.click(screen.getByRole('button', { name: 'Start battle' }))

    expect(emitWithAck).toHaveBeenCalledWith('battle:start', { roomCode: 'ROOM01', requesterId: 'me' })
    expect(emitWithAck).not.toHaveBeenCalledWith('song-challenge:start', expect.anything())
  })
})
